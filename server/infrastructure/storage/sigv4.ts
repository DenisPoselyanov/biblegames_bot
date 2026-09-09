/**
 * Minimal AWS Signature Version 4 (Phase 2 §19).
 *
 * Just enough to sign S3 REST requests with `fetch` — no `aws-sdk`, no
 * dependency. Pure functions; the network lives in `s3ObjectStore.ts`.
 *
 * Verified against the AWS `aws4_testsuite` `get-vanilla` vector.
 */
import { createHash, createHmac } from 'node:crypto';

export interface SigV4Input {
  method: string;
  /** Full URL (path-style or virtual-host — the host header is taken from it). */
  url: string;
  region: string;
  service: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** Raw request body. */
  body?: Buffer;
  /** Extra headers to sign (host and x-amz-date are always added). */
  headers?: Record<string, string>;
  /** Add + sign `x-amz-content-sha256` (required by S3, not by generic SigV4). */
  signPayloadHeader?: boolean;
  /** Defaults to now. */
  date?: Date;
}

const sha256Hex = (data: Buffer | string): string =>
  createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string): Buffer =>
  createHmac('sha256', key).update(data, 'utf8').digest();

function amzDates(date: Date): { amzDate: string; dateStamp: string } {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/** Encode a URI path segment per RFC 3986 (S3 canonical URI rules). */
function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalUri(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => encodeRfc3986(decodeURIComponent(seg)))
    .join('/');
}

function canonicalQuery(search: string): string {
  const params = new URLSearchParams(search);
  const pairs: Array<[string, string]> = [];
  for (const [k, v] of params) pairs.push([encodeRfc3986(k), encodeRfc3986(v)]);
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
  return pairs.map(([k, v]) => `${k}=${v}`).join('&');
}

export interface SignedRequest {
  headers: Record<string, string>;
  /** Convenience: the value of the `Authorization` header. */
  authorization: string;
}

export function signV4(input: SigV4Input): SignedRequest {
  const url = new URL(input.url);
  const date = input.date ?? new Date();
  const { amzDate, dateStamp } = amzDates(date);
  const body = input.body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(body);

  // Normalise every header name to lower-case up front so canonicalisation is a
  // straight sort — no case-insensitive lookups.
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers ?? {})) headers[k.toLowerCase()] = v;
  headers.host = url.host;
  headers['x-amz-date'] = amzDate;
  if (input.signPayloadHeader) headers['x-amz-content-sha256'] = payloadHash;
  if (input.sessionToken) headers['x-amz-security-token'] = input.sessionToken;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((h) => `${h}:${headers[h].trim().replace(/\s+/g, ' ')}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQuery(url.search.replace(/^\?/, '')),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, dateStamp), input.region), input.service),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { headers: { ...headers, authorization }, authorization };
}
