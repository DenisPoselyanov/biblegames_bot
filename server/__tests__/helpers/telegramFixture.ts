import crypto from 'node:crypto';

export interface FixtureUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface SignInitDataOptions {
  botToken: string;
  user: FixtureUser;
  authDate?: Date;
  /** Extra top-level fields (e.g. query_id, start_param). */
  extra?: Record<string, string>;
}

/**
 * Produces a correctly-signed Telegram Web App `initData` string for tests,
 * using the same algorithm the server verifies against.
 */
export function signInitData(opts: SignInitDataOptions): string {
  const authDate = Math.floor((opts.authDate ?? new Date()).getTime() / 1000);
  const fields: Record<string, string> = {
    user: JSON.stringify(opts.user),
    auth_date: String(authDate),
    ...opts.extra,
  };

  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(opts.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams(fields);
  params.set('hash', hash);
  return params.toString();
}

export const TEST_BOT_TOKEN = '123456:TEST-BOT-TOKEN-abcdef';
