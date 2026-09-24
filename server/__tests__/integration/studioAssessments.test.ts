import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { RoleRegistry } from '../../authz/roleRegistry';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryQualityRepositories } from '../../domains/quality/inMemory';
import type { GoldenSample } from '../../domains/quality/goldenSample';
import { createMemoryStore } from '../helpers/memoryStore';

const subject = (id: string, hash = `h-${id}`) => ({
  questionId: id,
  contentHash: hash,
  themeId: 'pentateuch',
  difficulty: 'youth' as const,
  topicNodeId: null,
  text: `Питання ${id}?`,
  options: ['А', 'Б', 'В', 'Г'],
  correctIndex: 1,
  explanationShort: 'Коротко.',
  explanationDeep: null,
  reference: 'Бут. 1:1',
});

const sample: GoldenSample = {
  version: 1,
  seed: 't',
  size: 2,
  generatedAt: '2026-09-24T00:00:00.000Z',
  byStratum: { canon_mismatch: 1, reference: 0, language: 0, other_findings: 0, clean: 1 },
  items: [
    { stratum: 'canon_mismatch', subject: subject('g1'), findings: ['theme_canon_mismatch'] },
    { stratum: 'clean', subject: subject('g2'), findings: [] },
  ],
};

export const passCriteria = {
  answer_supported: 'pass',
  single_correct: 'pass',
  factual: 'pass',
  distractors: 'pass',
  topic_fit: 'pass',
  level_fit: 'pass',
  explanation_fit: 'pass',
  language: 'pass',
};

export function assessmentsApp(opts: { withSample?: boolean; withQuality?: boolean } = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  const auditLog = createMemoryAuditLog();
  const quality = createInMemoryQualityRepositories();
  const roleRegistry = new RoleRegistry([
    { userId: 'reviewer-1', roles: ['content_reviewer'] },
    { userId: 'plain-1', roles: [] },
  ]);
  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    auditLog,
    roleRegistry,
    quality: opts.withQuality === false ? undefined : quality,
    goldenSample: () => (opts.withSample === false ? null : sample),
  });
  return { app, auditLog, quality };
}

const as = (app: ReturnType<typeof assessmentsApp>['app'], userId: string) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', userId),
  put: (url: string, body?: object) => request(app).put(url).set('x-user-id', userId).send(body ?? {}),
});

describe('/api/v1/studio/assessments/golden (WS11c)', () => {
  it('403s a caller with no content role', async () => {
    const { app } = assessmentsApp();
    expect((await as(app, 'plain-1').get('/api/v1/studio/assessments/golden')).status).toBe(403);
  });

  it('reports a missing sample and a missing store honestly', async () => {
    const noSample = assessmentsApp({ withSample: false });
    expect((await as(noSample.app, 'reviewer-1').get('/api/v1/studio/assessments/golden')).body).toMatchObject({
      available: true,
      sampleMissing: true,
    });
    const noStore = assessmentsApp({ withQuality: false });
    expect((await as(noStore.app, 'reviewer-1').get('/api/v1/studio/assessments/golden')).body).toMatchObject({
      available: false,
    });
  });

  it('serves the sample without the stratum, saves a label and reports progress', async () => {
    const { app, auditLog, quality } = assessmentsApp();
    const empty = await as(app, 'reviewer-1').get('/api/v1/studio/assessments/golden');
    expect(empty.body.progress).toEqual({ labelled: 0, total: 2 });
    expect(empty.body.items[0]).not.toHaveProperty('stratum');
    expect(empty.body.items[0].label).toBeNull();

    const saved = await as(app, 'reviewer-1').put('/api/v1/studio/assessments/golden/g1', {
      verdict: 'reject',
      criteria: { ...passCriteria, factual: 'fail', topic_fit: 'fail' },
      notes: 'Такого вірша немає',
      suggestedDifficulty: null,
    });
    expect(saved.status).toBe(200);
    expect(saved.body.label).toMatchObject({ verdict: 'reject', notes: 'Такого вірша немає', assessor: 'reviewer-1' });

    const after = await as(app, 'reviewer-1').get('/api/v1/studio/assessments/golden');
    expect(after.body.progress).toEqual({ labelled: 1, total: 2 });
    expect(after.body.items[0].label).toMatchObject({ verdict: 'reject', stale: false });

    const [stored] = await quality.assessments.listGolden();
    expect(stored.subject.text).toBe('Питання g1?');
    expect(stored.meta).toEqual({ stratum: 'canon_mismatch' });
    expect(auditLog.records.some((e) => e.action === 'content.golden_label' && e.target === 'g1')).toBe(true);
  });

  it('rejects labels outside the sample and malformed labels', async () => {
    const { app } = assessmentsApp();
    const outside = await as(app, 'reviewer-1').put('/api/v1/studio/assessments/golden/zzz', {
      verdict: 'pass',
      criteria: passCriteria,
    });
    expect(outside.status).toBe(404);
    const partial = await as(app, 'reviewer-1').put('/api/v1/studio/assessments/golden/g1', {
      verdict: 'pass',
      criteria: { answer_supported: 'pass' },
    });
    expect(partial.status).toBe(400);
    const badVerdict = await as(app, 'reviewer-1').put('/api/v1/studio/assessments/golden/g1', {
      verdict: 'maybe',
      criteria: passCriteria,
    });
    expect(badVerdict.status).toBe(400);
  });
});

describe('/api/v1/studio/assessments/calibration (WS11c)', () => {
  it('compares AI verdicts with the golden labels on the same body', async () => {
    const { app, quality } = assessmentsApp();
    await as(app, 'reviewer-1').put('/api/v1/studio/assessments/golden/g1', {
      verdict: 'reject',
      criteria: { ...passCriteria, factual: 'fail' },
    });
    const empty = await as(app, 'reviewer-1').get('/api/v1/studio/assessments/calibration');
    expect(empty.body.report).toMatchObject({ goldenLabels: 1, pairs: 0, missingAi: 1, trusted: false });

    const [label] = await quality.assessments.listGolden();
    await quality.assessments.addAi({ ...label, source: 'ai', assessor: 'mock:model', verdict: 'pass', criteria: passCriteria as never, confidence: 0.9, meta: {} });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/assessments/calibration');
    expect(res.status).toBe(200);
    expect(res.body.report).toMatchObject({ pairs: 1, verdictAgreement: 0, confusion: { reject: { pass: 1 } } });
    expect(res.body.report.disagreements[0]).toMatchObject({ questionId: 'g1', golden: 'reject', ai: 'pass' });
  });
});
