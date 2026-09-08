import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createInMemoryIdentityRepositories } from '../domains/identity/inMemoryRepository';
import { createAttachPersistedIdentity } from './principalIdentity';

/** Let a resolved `upsertFromIdentity(...).then(...)` chain settle. */
const tick = () => new Promise((r) => setImmediate(r));

const req = (withAuth = true): Request =>
  ({
    auth: withAuth && {
      userId: 'u1',
      telegramUserId: 'tg1',
      displayName: 'Dana',
      username: 'dana',
      languageCode: 'uk',
      authenticatedAt: new Date().toISOString(),
      authSource: 'telegram',
    },
  }) as unknown as Request;

const res = {} as Response;

describe('attachPersistedIdentity', () => {
  it('upserts the principal into the identity store on first sight', async () => {
    const repos = createInMemoryIdentityRepositories();
    const mw = createAttachPersistedIdentity(repos.users);
    const next = vi.fn();

    mw(req(), res, next);
    await tick();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
    expect(await repos.users.getById('u1')).toMatchObject({
      id: 'u1',
      displayName: 'Dana',
      username: 'dana',
    });
    expect(
      await repos.users.getByExternalId({ provider: 'telegram', externalId: 'tg1' }),
    ).toMatchObject({ id: 'u1' });
  });

  it('skips the write within the TTL, then re-upserts once it elapses', async () => {
    const repos = createInMemoryIdentityRepositories();
    const spy = vi.spyOn(repos.users, 'upsertFromIdentity');
    let ms = 0;
    const mw = createAttachPersistedIdentity(repos.users, { now: () => ms, ttlMs: 1_000 });

    const run = async () => {
      mw(req(), res, vi.fn());
      await tick();
    };

    await run();
    await run();
    expect(spy).toHaveBeenCalledTimes(1);

    ms = 1_500;
    await run();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('is a no-op without a principal', () => {
    const repos = createInMemoryIdentityRepositories();
    const spy = vi.spyOn(repos.users, 'upsertFromIdentity');
    const mw = createAttachPersistedIdentity(repos.users);
    const next = vi.fn();

    mw(req(false), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it('continues the request (best-effort) when the store write throws', async () => {
    const repos = createInMemoryIdentityRepositories();
    vi.spyOn(repos.users, 'upsertFromIdentity').mockRejectedValue(new Error('db down'));
    const mw = createAttachPersistedIdentity(repos.users);
    const next = vi.fn();

    mw(req(), res, next);
    await tick();

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined(); // no error passed to next
  });
});
