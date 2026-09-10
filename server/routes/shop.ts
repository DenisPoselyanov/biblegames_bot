/**
 * Server-authoritative cosmetic purchases (Phase 1 §7.1, §8, ADR-003).
 *
 * The client used to debit `coins` and push into `unlockedThemes` /
 * `unlockedAvatars` itself. Phase 1 DoD #6 forbids the client writing coins or
 * unlocks as final values, so a purchase is a command: the server looks up the
 * catalog price, posts a `spend` wallet entry (the ledger rejects an overdraw
 * and is idempotent on `(sourceType, sourceId)`), records ownership, and audits
 * the adjustment (§6.4).
 *
 * When a database is wired (ADR-016) the wallet spend, the `entitlements` grant,
 * the auto-equip preference write and the `aesthete` achievement all run in one
 * `db.transaction`, so a failure part-way rolls the whole purchase back.
 */

import { Router, type Request } from 'express';
import { shopContract } from '../../contracts/index';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validate';
import { AppError, UnauthorizedError } from '../lib/errors';
import { metrics } from '../lib/metrics';
import { buildAuditRecord, type AuditLog } from '../audit';
import { WalletError, type WalletLedger } from '../wallet';
import type { IdempotencyStore } from '../lib/idempotency';
import type { ServerStore } from '../db/store';
import type { Database } from '../infrastructure/database/client';
import type { Transaction as OpaqueTx } from '../domains/shared/context';
import { emptyProfile, type PreferencesCutover, type ProgressionCutover } from '../services/profileService';
import { getCosmeticThemeById, getAvatarById } from '../../src/data/cosmetics';

export interface ShopRouterDeps {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  auditLog: AuditLog;
  idempotency: IdempotencyStore;
  /**
   * Typed-preferences cutover (Phase 2 §18.2). A purchase auto-equips the item,
   * which is an `activeTheme` / `avatar` write — it must go through the same
   * typed store as `PATCH /me/preferences`, or `readProfile`'s overlay would
   * keep showing the pre-purchase cosmetic.
   */
  preferences?: PreferencesCutover;
  /** Progression / entitlement cutover (ADR-016). Present when a database is wired. */
  progression?: ProgressionCutover;
  /** Drizzle handle — present when a database is wired; opens the purchase transaction. */
  db?: Database;
}

function principal(req: Request): { userId: string; authSource: string | null } {
  if (!req.auth) throw new UnauthorizedError('missing_credentials', 'Authentication required');
  return { userId: req.auth.userId, authSource: req.auth.authSource ?? null };
}

function priceOf(kind: 'theme' | 'avatar', itemId: string): number | null {
  if (kind === 'theme') return getCosmeticThemeById(itemId)?.price ?? null;
  return getAvatarById(itemId)?.price ?? null;
}

interface PurchaseResult {
  ok: true;
  balance: number;
  unlockedThemes: string[];
  unlockedAvatars: string[];
  activeTheme: string;
  avatar: string;
  achievementsGranted: string[];
}

export function createShopRouter({
  dbStore,
  walletLedger,
  auditLog,
  idempotency,
  preferences,
  progression,
  db,
}: ShopRouterDeps): Router {
  const router = Router();
  const transactional = Boolean(db && progression);

  router.post(
    '/purchases',
    validateBody(shopContract.purchaseRequest, 'invalid_purchase'),
    asyncHandler(async (req, res) => {
      const { userId, authSource } = principal(req);
      const { kind, itemId, idempotencyKey } = req.body as shopContract.PurchaseRequest;

      const scopedKey = `shop.purchase:${userId}:${idempotencyKey}`;
      const cached = await idempotency.recall(scopedKey);
      if (cached) {
        metrics.inc('idempotency_replay_total', { surface: 'shop' });
        res.json(cached.result);
        return;
      }

      const price = priceOf(kind, itemId);
      if (price === null) throw new AppError('unknown_item', `No ${kind} "${itemId}"`, 400);

      const result =
        transactional && db && progression
          ? await purchaseTransactional({
              db,
              progression,
              preferences,
              walletLedger,
              userId,
              kind,
              itemId,
              price,
            })
          : await purchaseBlob({ dbStore, walletLedger, preferences, userId, kind, itemId, price });

      await auditLog.append(
        buildAuditRecord({
          actor: { userId, authSource },
          action: 'shop.purchase',
          target: itemId,
          result: 'ok',
          requestId: req.id,
          metadata: { kind, price, balanceAfter: result.balance },
        }),
      );

      await idempotency.remember(scopedKey, result);
      res.json(result);
    }),
  );

  return router;
}

const sourceIdFor = (kind: 'theme' | 'avatar', itemId: string): string => `shop.${kind}:${itemId}`;

function walletError(err: unknown): never {
  if (err instanceof WalletError && err.code === 'insufficient_funds') {
    metrics.inc('reward_failed_total', { reason: 'insufficient_funds' });
    throw new AppError('insufficient_funds', 'Not enough coins for this purchase', 409);
  }
  throw err;
}

async function purchaseTransactional(args: {
  db: Database;
  progression: ProgressionCutover;
  preferences?: PreferencesCutover;
  walletLedger: WalletLedger;
  userId: string;
  kind: 'theme' | 'avatar';
  itemId: string;
  price: number;
}): Promise<PurchaseResult> {
  const { db, progression, preferences, walletLedger, userId, kind, itemId, price } = args;
  const productKind = kind;

  const already = await progression.entitlements.findBySource('purchase', sourceIdFor(kind, itemId));
  if (already && already.status !== 'revoked') {
    throw new AppError('already_owned', `Already own this ${kind}`, 409);
  }

  return db.transaction(async (txHandle) => {
    const tx = txHandle as unknown as OpaqueTx;

    let balanceAfter: number;
    try {
      const { entry } = await walletLedger.post(
        {
          userId,
          type: 'spend',
          amount: -price,
          sourceType: kind === 'theme' ? 'shop.theme' : 'shop.avatar',
          sourceId: itemId,
          metadata: { kind },
        },
        tx,
      );
      balanceAfter = entry.balanceAfter;
    } catch (err) {
      walletError(err);
    }

    await progression.entitlements.grant(
      {
        userId,
        productId: itemId,
        productKind,
        sourceType: 'purchase',
        sourceId: sourceIdFor(kind, itemId),
      },
      tx,
    );

    const granted: string[] = [];
    if (kind === 'theme') {
      const existing = await progression.repos.achievements.list(userId, tx);
      if (!existing.some((g) => g.achievementId === 'aesthete')) {
        await progression.repos.achievements.grant(
          { userId, achievementId: 'aesthete', sourceType: 'shop.purchase', sourceId: itemId },
          tx,
        );
        granted.push('aesthete');
      }
    }

    // Auto-equip, on the same transaction so the whole purchase is atomic.
    if (preferences) {
      await preferences.repo.upsert(
        userId,
        kind === 'theme' ? { activeTheme: itemId } : { avatar: itemId },
        tx,
      );
    }

    const active = await progression.entitlements.listActive(userId, progression.now(), tx);
    const unlockedThemes = active.filter((e) => e.productKind === 'theme').map((e) => e.productId);
    const unlockedAvatars = active.filter((e) => e.productKind === 'avatar').map((e) => e.productId);

    return {
      ok: true as const,
      balance: balanceAfter,
      unlockedThemes,
      unlockedAvatars,
      activeTheme: kind === 'theme' ? itemId : '',
      avatar: kind === 'avatar' ? itemId : '',
      achievementsGranted: granted,
    };
  });
}

// --- Legacy whole-blob path (no database wired) -----------------------------

async function purchaseBlob(args: {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  preferences?: PreferencesCutover;
  userId: string;
  kind: 'theme' | 'avatar';
  itemId: string;
  price: number;
}): Promise<PurchaseResult> {
  const { dbStore, walletLedger, preferences, userId, kind, itemId, price } = args;
  const stored = (await dbStore.getProfile(userId)) ?? emptyProfile(userId);
  const ownedKey = kind === 'theme' ? 'unlockedThemes' : 'unlockedAvatars';
  const owned = Array.isArray(stored[ownedKey]) ? [...(stored[ownedKey] as string[])] : [];
  if (owned.includes(itemId)) {
    throw new AppError('already_owned', `Already own this ${kind}`, 409);
  }

  let balanceAfter: number;
  try {
    const { entry } = await walletLedger.post({
      userId,
      type: 'spend',
      amount: -price,
      sourceType: kind === 'theme' ? 'shop.theme' : 'shop.avatar',
      sourceId: itemId,
      metadata: { kind },
    });
    balanceAfter = entry.balanceAfter;
  } catch (err) {
    walletError(err);
  }

  owned.push(itemId);
  const achievements = Array.isArray(stored.achievements) ? [...(stored.achievements as string[])] : [];
  const granted: string[] = [];
  if (kind === 'theme' && !achievements.includes('aesthete')) {
    achievements.push('aesthete');
    granted.push('aesthete');
  }

  const nextProfile: Record<string, unknown> = {
    ...stored,
    coins: balanceAfter,
    [ownedKey]: owned,
    achievements,
    updatedAt: new Date().toISOString(),
  };
  if (kind === 'theme') nextProfile.activeTheme = itemId;
  else nextProfile.avatar = itemId;

  if (preferences) {
    await preferences.repo.upsert(userId, kind === 'theme' ? { activeTheme: itemId } : { avatar: itemId });
    if (preferences.legacyReadOnly) {
      if (kind === 'theme') delete nextProfile.activeTheme;
      else delete nextProfile.avatar;
    }
  }
  await dbStore.setProfile(userId, nextProfile);

  return {
    ok: true,
    balance: balanceAfter,
    unlockedThemes: kind === 'theme' ? owned : ((stored.unlockedThemes as string[]) ?? []),
    unlockedAvatars: kind === 'avatar' ? owned : ((stored.unlockedAvatars as string[]) ?? []),
    activeTheme: kind === 'theme' ? itemId : ((stored.activeTheme as string) ?? ''),
    avatar: kind === 'avatar' ? itemId : ((stored.avatar as string) ?? ''),
    achievementsGranted: granted,
  };
}
