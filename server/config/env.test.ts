import { describe, expect, it } from 'vitest';
import { loadConfig } from './env';
import { assertProductionConfig } from './productionValidation';

describe('loadConfig NODE_ENV parsing', () => {
  it('defaults to development when NODE_ENV is unset', () => {
    expect(loadConfig({}).config.nodeEnv).toBe('development');
  });

  it.each(['development', 'test', 'production'])('passes through %s', (v) => {
    expect(loadConfig({ NODE_ENV: v }).config.nodeEnv).toBe(v);
  });

  it('fails closed to production for an unrecognized NODE_ENV (with a warning)', () => {
    const { config, warnings } = loadConfig({ NODE_ENV: 'staging' });
    expect(config.nodeEnv).toBe('production');
    expect(config.isProduction).toBe(true);
    expect(warnings.join(' ')).toMatch(/staging/);
    // ...which means the production gate now runs and rejects the incomplete config.
    expect(() => assertProductionConfig(config)).toThrow(/invalid production configuration/i);
  });

  it('parses CLIENT_ORIGINS (plural, comma-separated)', () => {
    const { config } = loadConfig({ CLIENT_ORIGINS: 'https://a.example.com, https://b.example.com' });
    expect(config.clientOrigins).toEqual(['https://a.example.com', 'https://b.example.com']);
  });
});
