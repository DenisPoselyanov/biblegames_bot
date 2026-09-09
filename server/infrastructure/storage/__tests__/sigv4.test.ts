import { describe, expect, it } from 'vitest';
import { signV4 } from '../sigv4';

/**
 * Vectors from the AWS `aws4_testsuite`. Credentials are the suite's public
 * fixtures (`AKIDEXAMPLE`), region `us-east-1`, service `service`.
 */
const CREDS = {
  region: 'us-east-1',
  service: 'service',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  date: new Date('2015-08-30T12:36:00Z'),
};

describe('signV4 — AWS aws4_testsuite vectors', () => {
  it('get-vanilla', () => {
    const { authorization } = signV4({
      ...CREDS,
      method: 'GET',
      url: 'https://example.amazonaws.com/',
    });
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31',
    );
  });

  it('get-vanilla-query-order-key-case (sorted canonical query)', () => {
    const { authorization } = signV4({
      ...CREDS,
      method: 'GET',
      url: 'https://example.amazonaws.com/?Param2=value2&Param1=value1',
    });
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500',
    );
  });
});

describe('signV4 — S3 mode', () => {
  it('adds and signs x-amz-content-sha256 when signPayloadHeader is set', () => {
    const signed = signV4({
      ...CREDS,
      method: 'PUT',
      url: 'https://s3.example.com/bucket/key.json',
      body: Buffer.from('{"ok":true}'),
      headers: { 'content-type': 'application/json' },
      signPayloadHeader: true,
    });
    expect(signed.headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.authorization).toContain('content-type;host;x-amz-content-sha256;x-amz-date');
  });

  it('is deterministic for a fixed date', () => {
    const args = {
      ...CREDS,
      method: 'GET' as const,
      url: 'https://s3.example.com/bucket/a/b.txt',
      signPayloadHeader: true,
    };
    expect(signV4(args).authorization).toBe(signV4(args).authorization);
  });
});
