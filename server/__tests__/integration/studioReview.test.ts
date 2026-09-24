import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { RoleRegistry } from '../../authz/roleRegistry';
import { createMemoryAuditLog } from '../../audit';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { validateQuestionRevision } from '../../domains/content/revisionValidation';
import { createInMemoryLearningRepositories } from '../../domains/learning/inMemoryRepository';
import { createInMemoryScriptureEvidenceRepository } from '../../domains/shared/inMemoryScriptureEvidence';
import { createInMemoryValidationFindingRepository } from '../../domains/shared/inMemoryValidationFindings';
import { createMemoryStore } from '../helpers/memoryStore';

function reviewApp(opts: { withRepos?: boolean } = {}) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  const auditLog = createMemoryAuditLog();
  const repos = {
    content: createInMemoryContentRepositories(),
    learning: createInMemoryLearningRepositories(),
    findings: createInMemoryValidationFindingRepository(),
    scripture: createInMemoryScriptureEvidenceRepository(),
  };
  const roleRegistry = new RoleRegistry([
    { userId: 'reviewer-1', roles: ['content_reviewer'] },
    { userId: 'publisher-1', roles: ['content_publisher'] },
    { userId: 'plain-1', roles: [] },
  ]);
  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    auditLog,
    roleRegistry,
    studioReview: opts.withRepos === false ? undefined : repos,
  });
  return { app, auditLog, repos };
}

const as = (app: ReturnType<typeof reviewApp>['app'], userId: string) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', userId),
  post: (url: string, body?: object) =>
    request(app).post(url).set('x-user-id', userId).send(body ?? {}),
});

const draft = {
  questionId: 'q1',
  themeId: 'genesis',
  difficulty: 'youth' as const,
  text: 'Хто збудував ковчег?',
  options: ['Ной', 'Мойсей'],
  correctIndex: 0,
  explanationShort: 'Ной збудував ковчег за Божим наказом перед потопом.',
  reference: 'Бут. 6:14',
  status: 'draft' as const,
};

describe('/api/v1/studio/review (Phase 4 WS8b)', () => {
  it('403s a caller with no content role', async () => {
    const { app } = reviewApp();
    const res = await as(app, 'plain-1').get('/api/v1/studio/review');
    expect(res.status).toBe(403);
  });

  it('reports available:false without revision repositories', async () => {
    const { app } = reviewApp({ withRepos: false });
    const res = await as(app, 'reviewer-1').get('/api/v1/studio/review');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: false, items: [], counts: null });
    const write = await as(app, 'reviewer-1').post('/api/v1/studio/review/question/x/approve');
    expect(write.status).toBe(409);
  });

  it('lists the queue and serves a revision detail', async () => {
    const { app, repos } = reviewApp();
    const { revision } = await repos.content.revisions.appendRevision(draft);

    const queue = await as(app, 'reviewer-1').get('/api/v1/studio/review');
    expect(queue.status).toBe(200);
    expect(queue.body.items.map((i: { revisionId: string }) => i.revisionId)).toEqual([revision.id]);
    expect(queue.body.counts.question.draft).toBe(1);

    const detail = await as(app, 'reviewer-1').get(`/api/v1/studio/review/question/${revision.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.detail.revision.record.text).toBe('Хто збудував ковчег?');

    expect((await as(app, 'reviewer-1').get('/api/v1/studio/review/question/nope')).status).toBe(404);
    expect((await as(app, 'reviewer-1').get('/api/v1/studio/review/widget/x')).status).toBe(400);
    expect((await as(app, 'reviewer-1').get('/api/v1/studio/review?status=bogus')).status).toBe(400);
  });

  it('a reviewer can approve but not publish; a publisher publishes only with explicit confirmation', async () => {
    const { app, repos, auditLog } = reviewApp();
    const { revision } = await repos.content.revisions.appendRevision(draft);
    await validateQuestionRevision({ findings: repos.findings }, revision);
    const base = `/api/v1/studio/review/question/${revision.id}`;

    const denied = await as(app, 'reviewer-1').post(`${base}/publish`, { confirmRevisionId: revision.id });
    expect(denied.status).toBe(403);

    const notApproved = await as(app, 'publisher-1').post(`${base}/publish`, { confirmRevisionId: revision.id });
    expect(notApproved.status).toBe(409);
    expect(notApproved.body.error.code).toBe('content_not_approved');

    const approved = await as(app, 'reviewer-1').post(`${base}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.decision).toMatchObject({ decision: 'approved', actorUserId: 'reviewer-1' });

    const unconfirmed = await as(app, 'publisher-1').post(`${base}/publish`);
    expect(unconfirmed.status).toBe(400);
    expect(unconfirmed.body.error.code).toBe('confirmation_required');

    const published = await as(app, 'publisher-1').post(`${base}/publish`, { confirmRevisionId: revision.id });
    expect(published.status).toBe(200);
    expect(published.body).toMatchObject({ ok: true, status: 'published' });

    const publishAudit = await auditLog.query({ action: 'content.publish', target: revision.id });
    expect(publishAudit[0]?.actor.userId).toBe('publisher-1');
  });

  it('approval is refused while a blocking finding is open', async () => {
    const { app, repos } = reviewApp();
    const { revision } = await repos.content.revisions.appendRevision(draft);
    await repos.findings.record('question', revision.id, [
      {
        revisionType: 'question',
        revisionId: revision.id,
        kind: 'duplicate_exact',
        severity: 'blocking',
        label: 'Дублікат',
        detail: 'Такий самий текст уже є',
      },
    ]);
    const res = await as(app, 'reviewer-1').post(`/api/v1/studio/review/question/${revision.id}/approve`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('content_approve_blocked');
  });

  it('request-changes needs a comment; a scripture decision is recorded and audited', async () => {
    const { app, repos, auditLog } = reviewApp();
    const { revision } = await repos.content.revisions.appendRevision(draft);
    const base = `/api/v1/studio/review/question/${revision.id}`;

    expect((await as(app, 'reviewer-1').post(`${base}/request-changes`)).status).toBe(400);
    const ok = await as(app, 'reviewer-1').post(`${base}/request-changes`, { comment: 'Додай пояснення' });
    expect(ok.body.decision).toMatchObject({ decision: 'changes_requested', comment: 'Додай пояснення' });

    const [evidence] = await repos.scripture.record('question', revision.id, [
      {
        revisionType: 'question',
        revisionId: revision.id,
        rawReference: 'Бут 6:14',
        bookId: 1,
        chapter: 6,
        verseStart: 14,
        verseEnd: 14,
        translation: 'UTT',
        verdict: 'paraphrase',
        quotedText: 'зроби собі ковчег',
        sourceText: 'Зроби собі ковчега з дерева ґофер',
        adapterVersion: 'mock-scripture-v1',
      },
    ]);
    const decision = await as(app, 'reviewer-1').post(
      `/api/v1/studio/review/scripture/${evidence.id}/decision`,
      { decision: 'accepted' },
    );
    expect(decision.status).toBe(200);
    expect(decision.body.evidence.reviewerDecision).toBe('accepted');
    expect((await auditLog.query({ target: evidence.id }))[0]?.action).toBe('content.review_decision');

    const missing = await as(app, 'reviewer-1').post('/api/v1/studio/review/scripture/nope/decision', {
      decision: 'accepted',
    });
    expect(missing.status).toBe(404);
  });
});
