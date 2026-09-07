/**
 * Structured logging (Phase 1 §16).
 *
 * One JSON object per line to stdout (`info`/`warn`) or stderr (`error`), always
 * carrying `{ ts, level, msg }` plus whatever safe fields the caller passes.
 * Never log raw Telegram initData, full profiles, wallet payloads, tokens or
 * `DATABASE_URL` — pass a `requestId` and coarse context instead.
 */

type Fields = Record<string, unknown>;

function emit(stream: 'out' | 'err', level: string, msg: string, fields?: Fields): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (stream === 'err') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const log = {
  info(msg: string, fields?: Fields): void {
    emit('out', 'info', msg, fields);
  },
  warn(msg: string, fields?: Fields): void {
    emit('out', 'warn', msg, fields);
  },
  error(msg: string, fields?: Fields): void {
    emit('err', 'error', msg, fields);
  },
};
