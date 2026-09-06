import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';
import { collectProductionConfigErrors, assertProductionConfig } from './productionValidation';

function prodConfig(overrides: NodeJS.ProcessEnv = {}) {
  return loadConfig({
    NODE_ENV: 'production',
    TELEGRAM_BOT_TOKEN: 'real:token',
    AUTH_MODE: 'telegram',
    CLIENT_ORIGIN: 'https://mini-app.example.com',
    STORAGE_PROVIDER: 'json',
    ...overrides,
  }).config;
}

describe('collectProductionConfigErrors', () => {
  it('passes a complete, safe production config', () => {
    expect(collectProductionConfigErrors(prodConfig())).toEqual([]);
    expect(() => assertProductionConfig(prodConfig())).not.toThrow();
  });

  it('is a no-op outside production', () => {
    const dev = loadConfig({ NODE_ENV: 'development' }).config;
    expect(collectProductionConfigErrors(dev)).toEqual([]);
  });

  it('blocks production when the bot token is missing', () => {
    const errors = collectProductionConfigErrors(prodConfig({ TELEGRAM_BOT_TOKEN: '' }));
    expect(errors.join(' ')).toMatch(/TELEGRAM_BOT_TOKEN/);
  });

  it('blocks production when AUTH_MODE is development', () => {
    const errors = collectProductionConfigErrors(prodConfig({ AUTH_MODE: 'development' }));
    expect(errors.join(' ')).toMatch(/AUTH_MODE/);
  });

  it('blocks production with a localhost client origin', () => {
    const errors = collectProductionConfigErrors(
      prodConfig({ CLIENT_ORIGIN: 'http://localhost:5173' }),
    );
    expect(errors.join(' ')).toMatch(/loopback|https/);
  });

  it.each([
    'http://app.example.com', // not https
    'https://127.0.0.1:8443',
    'https://[::1]',
    'https://sub.localhost',
    'not-a-url',
  ])('blocks unsafe production origin %s', (origin) => {
    const errors = collectProductionConfigErrors(prodConfig({ CLIENT_ORIGIN: origin }));
    expect(errors.join(' ')).toMatch(/CLIENT_ORIGIN/);
  });

  it('allows a normal https origin whose host merely contains "localhost" as a label prefix', () => {
    // `localhost.example.com` is a real external host, not loopback.
    expect(
      collectProductionConfigErrors(prodConfig({ CLIENT_ORIGIN: 'https://localhost.example.com' })),
    ).toEqual([]);
  });

  it('blocks production when STORAGE_PROVIDER=sql but DATABASE_URL is unset', () => {
    const errors = collectProductionConfigErrors(
      prodConfig({ STORAGE_PROVIDER: 'sql', DATABASE_URL: '' }),
    );
    expect(errors.join(' ')).toMatch(/DATABASE_URL/);
  });

  it('assertProductionConfig throws an aggregated error', () => {
    expect(() => assertProductionConfig(prodConfig({ TELEGRAM_BOT_TOKEN: '', AUTH_MODE: 'development' }))).toThrow(
      /invalid production configuration/i,
    );
  });
});
