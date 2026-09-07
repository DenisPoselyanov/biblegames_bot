import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyTelegramInitData } from './telegramInitData';
import { signInitData, TEST_BOT_TOKEN } from '../__tests__/helpers/telegramFixture';

const USER = { id: 42, first_name: 'Ada', last_name: 'Lovelace', username: 'ada', language_code: 'uk' };
const OPTS = { maxAgeSec: 3600 };

/** Valid signature but the `user` field is deliberately absent. */
function signWithoutUser(botToken: string, authDate: string): string {
  const dataCheckString = `auth_date=${authDate}`;
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const params = new URLSearchParams({ auth_date: authDate });
  params.set('hash', hash);
  return params.toString();
}

describe('verifyTelegramInitData', () => {
  it('accepts valid, fresh initData and returns a typed principal', () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER });
    const result = verifyTelegramInitData(initData, TEST_BOT_TOKEN, OPTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal).toMatchObject({
      userId: '42',
      telegramUserId: '42',
      displayName: 'Ada Lovelace',
      username: 'ada',
      languageCode: 'uk',
      authSource: 'telegram',
    });
    expect(result.principal.authenticatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('rejects a tampered hash', () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER });
    const tampered = initData.replace(/hash=([0-9a-f]+)/, (_m, h: string) =>
      'hash=' + h.slice(0, -1) + (h.endsWith('0') ? '1' : '0'),
    );
    const result = verifyTelegramInitData(tampered, TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'bad_hash' });
  });

  it('rejects initData signed with a different bot token', () => {
    const initData = signInitData({ botToken: 'other:token', user: USER });
    const result = verifyTelegramInitData(initData, TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'bad_hash' });
  });

  it('rejects missing hash', () => {
    const params = new URLSearchParams({
      user: JSON.stringify(USER),
      auth_date: String(Math.floor(Date.now() / 1000)),
    });
    const result = verifyTelegramInitData(params.toString(), TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'missing_hash' });
  });

  it('rejects a hash of the wrong length (timing-safe length guard)', () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER }).replace(
      /hash=[0-9a-f]+/,
      'hash=abcd',
    );
    const result = verifyTelegramInitData(initData, TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'bad_hash' });
  });

  it('rejects expired auth_date', () => {
    const old = new Date(Date.now() - 7200 * 1000);
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER, authDate: old });
    const result = verifyTelegramInitData(initData, TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'expired' });
  });

  it('rejects future-dated auth_date beyond clock skew', () => {
    const future = new Date(Date.now() + 3600 * 1000);
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER, authDate: future });
    const result = verifyTelegramInitData(initData, TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'expired' });
  });

  it('rejects a forged user payload (hash no longer matches)', () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER });
    const forged = initData.replace(
      encodeURIComponent(JSON.stringify(USER)),
      encodeURIComponent(JSON.stringify({ ...USER, id: 999 })),
    );
    const result = verifyTelegramInitData(forged, TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'bad_hash' });
  });

  it('rejects when the bot token is not configured', () => {
    const initData = signInitData({ botToken: TEST_BOT_TOKEN, user: USER });
    const result = verifyTelegramInitData(initData, '', OPTS);
    expect(result).toEqual({ ok: false, code: 'auth_not_configured' });
  });

  it('rejects initData with no user field', () => {
    const authDate = String(Math.floor(Date.now() / 1000));
    const result = verifyTelegramInitData(signWithoutUser(TEST_BOT_TOKEN, authDate), TEST_BOT_TOKEN, OPTS);
    expect(result).toEqual({ ok: false, code: 'missing_user' });
  });
});
