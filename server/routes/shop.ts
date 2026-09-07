/**
 * Server-authoritative cosmetic purchases (Phase 1 §7.1, §8, ADR-003).
 *
 * The client used to debit `coins` and push into `unlockedThemes` /
 * `unlockedAvatars` itself. Phase 1 DoD #6 forbids the client writing coins or
 * unlocks as final values, so a purchase is now a command: the server looks up
 * the catalog price, posts a `spend` wallet entry (the ledger rejects an
 * overdraw and is idempotent on `(sourceType, sourceId)`), records ownership,
 * and audits the adjustment (§6.4).
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
import { emptyProfile } from '../services/profileService';
import { getCosmeticThemeById, getAvatarById } from '../../src/data/cosmetics';

export interface ShopRouterDeps {
  dbStore: ServerStore;
  walletLedger: WalletLedger;
  auditLog: AuditLog;
  idempotency: IdempotencyStore;
}

function principal(req: Request): { userId: string; authSource: string | null } {
  if (!req.auth) throw new UnauthorizedError('missing_credentials', 'Authentication required');
  return { userId: req.auth.userId, authSource: req.auth.authSource ?? null };
}

function priceOf(kind: 'theme' | 'avatar', itemId: string): number | null {
  if (kind === 'theme') return getCosmeticThemeById(itemId)?.price ?? null;
  return getAvatarById(itemId)?.price ?? null;
}

export function createShopRouter({
  dbStore,
  walletLedger,
  auditLog,
  idempotency,
}: ShopRouterDeps): Router {
  const router = Router();

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

      const stored = (await dbStore.getProfile(userId)) ?? emptyProfile(userId);
      const ownedKey = kind === 'theme' ? 'unlockedThemes' : 'unlockedAvatars';
      const owned = Array.isArray(stored[ownedKey]) ? [...(stored[ownedKey] as string[])] : [];
      if (owned.includes(itemId)) {
        throw new AppError('already_owned', `Already own this ${kind}`, 409);
      }

      const sourceType = kind === 'theme' ? 'shop.theme' : 'shop.avatar';
      let balanceAfter: number;
      try {
        const { entry } = await walletLedger.post({
          userId,
          type: 'spend',
          amount: -price,
          sourceType,
          sourceId: itemId,
          metadata: { kind },
        });
        balanceAfter = entry.balanceAfter;
      } catch (err) {
        if (err instanceof WalletError && err.code === 'insufficient_funds') {
          metrics.inc('reward_failed_total', { reason: 'insufficient_funds' });
          throw new AppError('insufficient_funds', 'Not enough coins for this purchase', 409);
        }
        throw err;
      }

      owned.push(itemId);
      const achievements = Array.isArray(stored.achievements)
        ? [...(stored.achievements as string[])]
        : [];
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
      await dbStore.setProfile(userId, nextProfile);

      await auditLog.append(
        buildAuditRecord({
          actor: { userId, authSource },
          action: 'shop.purchase',
          target: itemId,
          result: 'ok',
          requestId: req.id,
          metadata: { kind, price, balanceAfter },
        }),
      );

      const result = {
        ok: true,
        balance: balanceAfter,
        unlockedThemes: kind === 'theme' ? owned : (stored.unlockedThemes ?? []),
        unlockedAvatars: kind === 'avatar' ? owned : (stored.unlockedAvatars ?? []),
        activeTheme: nextProfile.activeTheme ?? stored.activeTheme ?? '',
        avatar: nextProfile.avatar ?? stored.avatar ?? '',
        achievementsGranted: granted,
      };
      await idempotency.remember(scopedKey, result);
      res.json(result);
    }),
  );

  return router;
}
