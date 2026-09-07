import { z } from 'zod';
import { cosmeticKindSchema } from '../enums/index';
import { idempotencyKey, nonNegativeInt } from '../schemas/primitives';

/** `/api/v1/shop/*` — server-authoritative cosmetic purchases (Phase 1 §7.1, ADR-003). */

/** `POST /api/v1/shop/purchases` */
export const purchaseRequest = z
  .object({
    kind: cosmeticKindSchema,
    itemId: z.string().trim().min(1).max(64),
    idempotencyKey,
  })
  .strict();
export type PurchaseRequest = z.infer<typeof purchaseRequest>;

export const purchaseResponse = z.object({
  ok: z.literal(true),
  balance: nonNegativeInt,
  unlockedThemes: z.array(z.string().max(64)),
  unlockedAvatars: z.array(z.string().max(64)),
  activeTheme: z.string().max(64),
  avatar: z.string().max(64),
  achievementsGranted: z.array(z.string().max(64)),
});
export type PurchaseResponse = z.infer<typeof purchaseResponse>;
