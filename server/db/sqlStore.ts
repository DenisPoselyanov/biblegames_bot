import type { ServerStore } from './store';

type PgPool = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

let poolPromise: Promise<PgPool> | null = null;

async function getPool(): Promise<PgPool> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for sql storage provider');
  }
  if (!poolPromise) {
    poolPromise = (async () => {
      const moduleName = 'pg';
      const mod = (await import(moduleName)) as {
        Pool: new (opts: Record<string, unknown>) => PgPool;
      };
      return new mod.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });
    })();
  }
  return poolPromise;
}

export const sqlStore: ServerStore = {
  async getProfile(userId) {
    const pool = await getPool();
    const result = await pool.query(
      'select payload from player_profiles where user_id = $1 limit 1',
      [userId],
    );
    return (result.rows[0]?.payload as Record<string, unknown> | undefined) ?? null;
  },
  async setProfile(userId, profile) {
    const pool = await getPool();
    await pool.query(
      `insert into player_profiles(user_id, payload, updated_at)
       values($1, $2::jsonb, now())
       on conflict(user_id)
       do update set payload = excluded.payload, updated_at = now()`,
      [userId, JSON.stringify(profile)],
    );
  },
  async getStats(userId) {
    const pool = await getPool();
    const result = await pool.query(
      'select payload from player_stats where user_id = $1 limit 1',
      [userId],
    );
    return (result.rows[0]?.payload as Record<string, unknown> | undefined) ?? null;
  },
  async setStats(userId, stats) {
    const pool = await getPool();
    await pool.query(
      `insert into player_stats(user_id, payload, updated_at)
       values($1, $2::jsonb, now())
       on conflict(user_id)
       do update set payload = excluded.payload, updated_at = now()`,
      [userId, JSON.stringify(stats)],
    );
  },
  async getStudyAnswers(userId) {
    const pool = await getPool();
    const result = await pool.query(
      'select payload from study_answers where user_id = $1 order by answered_at asc',
      [userId],
    );
    return result.rows.map((row) => row.payload as Record<string, unknown>);
  },
  async setStudyAnswers(userId, answers) {
    const pool = await getPool();
    await pool.query('delete from study_answers where user_id = $1', [userId]);
    for (const item of answers) {
      await pool.query(
        `insert into study_answers(user_id, question_id, subtheme_id, is_correct, answered_at, payload)
         values($1, $2, $3, $4, $5::timestamptz, $6::jsonb)`,
        [
          userId,
          String(item.questionId ?? ''),
          String(item.subthemeId ?? ''),
          Boolean(item.isCorrect),
          String(item.answeredAt ?? new Date().toISOString()),
          JSON.stringify(item),
        ],
      );
    }
  },
  async appendTelemetry(userId, events) {
    const pool = await getPool();
    for (const event of events) {
      await pool.query(
        `insert into telemetry_events(user_id, event_name, created_at, payload)
         values($1, $2, $3::timestamptz, $4::jsonb)`,
        [
          userId,
          String(event.name ?? 'unknown'),
          String(event.createdAt ?? new Date().toISOString()),
          JSON.stringify(event.payload ?? {}),
        ],
      );
    }
  },
};
