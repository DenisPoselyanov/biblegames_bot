import { randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';
import { getPool } from '../db/pgPool';
import type { Transaction as DrizzleTx } from '../infrastructure/database/client';
import type { Transaction as OpaqueTx } from '../domains/shared/context';
import {
  assertPostable,
  clampWalletLimit,
  WalletError,
  type WalletEntry,
  type WalletLedger,
  type WalletPostResult,
  type WalletTxnType,
} from './walletLedger';

/**
 * SQL wallet adapter (Phase 1 §8). `wallet_ledger` has `unique(source_type,
 * source_id)`. A `post` is one statement: it computes the current balance in a
 * CTE and only inserts when the result stays non-negative, so idempotency and
 * the no-overdraft rule both hold without an explicit transaction.
 *
 * When a caller passes `tx` (the reward hot path, ADR-016) the same statements
 * run on that Drizzle transaction's connection instead of a fresh pooled one, so
 * the ledger row commits or rolls back atomically with the caller's
 * `progression_state` / `entitlements` writes.
 */
function rowToEntry(row: Record<string, unknown>): WalletEntry {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    type: row.type as WalletEntry['type'],
    amount: Number(row.amount),
    balanceAfter: Number(row.balance_after),
    sourceType: String(row.source_type),
    sourceId: String(row.source_id),
    reversalOf: (row.reversal_of as string | null) ?? undefined,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };
}

const asTx = (tx?: OpaqueTx): DrizzleTx | undefined => tx as unknown as DrizzleTx | undefined;

/** Rebuild a `$1..$n` statement as a Drizzle `sql` fragment with bound params. */
function toDrizzleSql(text: string, params: unknown[]): SQL {
  const literals = text.split(/\$\d+/);
  const order = [...text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]) - 1);
  let acc = sql.raw(literals[0]);
  order.forEach((paramIndex, i) => {
    acc = sql`${acc}${params[paramIndex]}${sql.raw(literals[i + 1] ?? '')}`;
  });
  return acc;
}

/** One parametrised statement, on the tx connection when given, else the pool. */
async function runParametrised(
  tx: DrizzleTx | undefined,
  text: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  if (tx) {
    const result = await tx.execute(toDrizzleSql(text, params));
    return (result as { rows: Record<string, unknown>[] }).rows;
  }
  const pool = await getPool();
  const result = await pool.query(text, params);
  return result.rows as Record<string, unknown>[];
}

interface PostRowInput {
  id: string;
  userId: string;
  type: WalletTxnType;
  amount: number;
  sourceType: string;
  sourceId: string;
  reversalOf?: string;
  metadata?: Record<string, unknown>;
}

async function postRow(input: PostRowInput, tx?: OpaqueTx): Promise<WalletPostResult> {
  const drizzleTx = asTx(tx);
  const params = [
    input.id,
    input.userId,
    input.type,
    input.amount,
    input.sourceType,
    input.sourceId,
    input.reversalOf ?? null,
    JSON.stringify(input.metadata ?? {}),
  ];
  const inserted = await runParametrised(
    drizzleTx,
    `with bal as (
       select coalesce(sum(amount), 0)::bigint as balance
       from wallet_ledger where user_id = $2
     )
     insert into wallet_ledger(
       id, user_id, type, amount, balance_after, source_type, source_id, reversal_of, metadata)
     select $1, $2, $3, $4, bal.balance + $4, $5, $6, $7, $8::jsonb
     from bal
     where bal.balance + $4 >= 0
     on conflict (source_type, source_id) do nothing
     returning *`,
    params,
  );
  if (inserted[0]) {
    return { entry: rowToEntry(inserted[0]), replayed: false };
  }

  const existing = await runParametrised(
    drizzleTx,
    'select * from wallet_ledger where source_type = $1 and source_id = $2 limit 1',
    [input.sourceType, input.sourceId],
  );
  if (existing[0]) {
    return { entry: rowToEntry(existing[0]), replayed: true };
  }
  throw new WalletError('insufficient_funds', 'Wallet balance cannot go negative');
}

export function createSqlWalletLedger(): WalletLedger {
  return {
    async getBalance(userId, tx) {
      const rows = await runParametrised(
        asTx(tx),
        'select coalesce(sum(amount), 0)::bigint as balance from wallet_ledger where user_id = $1',
        [userId],
      );
      return Number(rows[0]?.balance ?? 0);
    },

    async listEntries(userId, opts) {
      const pool = await getPool();
      const result = await pool.query(
        `select * from wallet_ledger where user_id = $1
         order by created_at desc, id desc limit $2`,
        [userId, clampWalletLimit(opts?.limit)],
      );
      return result.rows.map(rowToEntry);
    },

    async post(input, tx) {
      assertPostable(input);
      return postRow({ ...input, id: randomUUID() }, tx);
    },

    async reverse(entryId, sourceId, metadata) {
      const pool = await getPool();
      const original = await pool.query('select * from wallet_ledger where id = $1 limit 1', [
        entryId,
      ]);
      if (!original.rows[0]) throw new WalletError('not_found', `No wallet entry ${entryId}`);
      const entry = rowToEntry(original.rows[0]);
      return postRow({
        id: randomUUID(),
        userId: entry.userId,
        type: 'reversal',
        amount: -entry.amount,
        sourceType: 'reversal',
        sourceId,
        reversalOf: entryId,
        metadata,
      });
    },
  };
}
