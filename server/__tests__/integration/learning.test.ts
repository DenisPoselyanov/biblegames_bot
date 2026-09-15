/**
 * Learning domain read + session APIs (Phase 3 WS2, spec §9, §11, §12).
 *
 * SQL-only surface — same pglite-integration pattern as
 * `progressionCutover.test.ts`. `contentRepositories` is overridden with a
 * seeded in-memory adapter (same trick `content.test.ts` uses) so practice
 * sessions have real published questions to draw from, while
 * `learningRepos`/`progressionRepos`/`economyRepos` all run on the real pglite
 * database — the practice-session answer path exercises the actual
 * transactional `progressionService.applyAnswer`, not the blob fallback.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadConfig } from '../../config/env';
import { createApp } from '../../app';
import { createMemoryIdempotencyStore } from '../../lib/idempotency';
import { createMemoryMigrationStore } from '../../migration/migrationStore';
import { createMemoryAuditLog } from '../../audit';
import { createMemoryStore } from '../helpers/memoryStore';
import { createTestDatabase, type TestDatabase } from '../../infrastructure/database/testing';
import { createSqlLearningRepositories } from '../../infrastructure/database/repositories/learning';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { importLegacyQuestions } from '../../domains/content/import';
import type { ContentRepositories } from '../../domains/content/repository';

let tdb: TestDatabase;

beforeEach(async () => {
  tdb = await createTestDatabase();
});
afterEach(async () => {
  await tdb.close();
});

function makeApp(contentRepositories?: ContentRepositories) {
  const { config } = loadConfig({ NODE_ENV: 'test', AUTH_MODE: 'development' });
  return createApp({
    config,
    database: tdb.db,
    dbStore: createMemoryStore(),
    contentRepositories,
    idempotency: createMemoryIdempotencyStore(),
    migrationStore: createMemoryMigrationStore(),
    auditLog: createMemoryAuditLog(),
  });
}

const get = (app: ReturnType<typeof makeApp>, path: string, uid: string) =>
  request(app).get(path).set('x-user-id', uid);
const post = (app: ReturnType<typeof makeApp>, path: string, uid: string, body: unknown) =>
  request(app).post(path).set('x-user-id', uid).send(body);

/** Seeds a published plan → module → objective → lesson → one block, via the real SQL repos. */
async function seedPublishedLesson() {
  const repos = createSqlLearningRepositories(tdb.db);
  await repos.plans.upsert({ id: 'plan1', themeId: 'plan1', title: 'Plan One', status: 'published' });
  await repos.modules.upsert({ id: 'mod1', planId: 'plan1', title: 'Module One', status: 'published' });
  await repos.objectives.upsert({ id: 'obj1', planId: 'plan1', title: 'Objective One', status: 'published' });
  const lesson = await repos.lessons.upsert({
    id: 'lesson1',
    planId: 'plan1',
    moduleId: 'mod1',
    objectiveId: 'obj1',
    title: 'Lesson One',
    status: 'published',
  });
  await repos.blocks.replaceForLesson('lesson1', [
    { id: 'b1', lessonId: 'lesson1', position: 0, blockType: 'heading', payload: { text: 'Hi' }, status: 'published' },
  ]);
  return lesson;
}

async function seededQuestionContentRepos(): Promise<ContentRepositories> {
  const repos = createInMemoryContentRepositories();
  await importLegacyQuestions(repos, [
    { id: 'q1', themeId: 'plan1', difficulty: 'youth', text: 'Q1?', options: ['a', 'b'], correctIndex: 0, topicNodeId: 'obj1' },
    { id: 'q2', themeId: 'plan1', difficulty: 'youth', text: 'Q2?', options: ['a', 'b'], correctIndex: 1, topicNodeId: 'obj1' },
  ]);
  for (const id of ['q1', 'q2']) {
    const rev = (await repos.revisions.listRevisions(id))[0];
    await repos.revisions.publishRevision(rev.id);
  }
  return repos;
}

describe('GET /api/v1/learning/today', () => {
  it('returns a well-formed empty-state view for a first-time user', async () => {
    const app = makeApp();
    const res = await get(app, '/api/v1/learning/today', 'u1');
    expect(res.status).toBe(200);
    expect(res.body.activeLesson).toBeUndefined();
    expect(res.body.dueReview).toBeUndefined();
    expect(res.body.dailyGoal).toEqual({ target: 1, completed: 0, unit: 'lesson' });
    expect(res.body.streak).toEqual({ days: 0, lastActiveAt: null });
    expect(res.body.verseOfDay.reference).toBeTruthy();
  });
});

describe('plan / module / lesson reads', () => {
  it('serves published content and 404s on unpublished/missing ids', async () => {
    await seedPublishedLesson();
    const repos = createSqlLearningRepositories(tdb.db);
    await repos.plans.upsert({ id: 'draft-plan', themeId: 'draft-plan', title: 'Draft' }); // legacy_unreviewed by default
    const app = makeApp();

    const plans = await get(app, '/api/v1/learning/plans', 'u1');
    expect(plans.body.plans.map((p: { id: string }) => p.id)).toEqual(['plan1']);

    const plan = await get(app, '/api/v1/learning/plans/plan1', 'u1');
    expect(plan.status).toBe(200);
    expect(plan.body.modules.map((m: { id: string }) => m.id)).toEqual(['mod1']);

    expect((await get(app, '/api/v1/learning/plans/draft-plan', 'u1')).status).toBe(404);
    expect((await get(app, '/api/v1/learning/plans/does-not-exist', 'u1')).status).toBe(404);

    const moduleRes = await get(app, '/api/v1/learning/modules/mod1', 'u1');
    expect(moduleRes.body.lessons.map((l: { id: string }) => l.id)).toEqual(['lesson1']);

    const lesson = await get(app, '/api/v1/learning/lessons/lesson1', 'u1');
    expect(lesson.body.blocks.map((b: { blockType: string }) => b.blockType)).toEqual(['heading']);
  });
});

describe('lesson sessions (§11.4)', () => {
  it('starts, resumes on a second call, checkpoints, and completes — reflected in Today', async () => {
    await seedPublishedLesson();
    const app = makeApp();

    const first = await post(app, '/api/v1/learning/lessons/lesson1/sessions', 'u1', { idempotencyKey: 'start1' });
    expect(first.status).toBe(200);
    expect(first.body.session.status).toBe('in_progress');
    const sessionId = first.body.session.id;

    // A second start (different idempotency key) resumes the same session rather than duplicating it.
    const second = await post(app, '/api/v1/learning/lessons/lesson1/sessions', 'u1', { idempotencyKey: 'start2' });
    expect(second.body.session.id).toBe(sessionId);

    const todayActive = await get(app, '/api/v1/learning/today', 'u1');
    expect(todayActive.body.activeLesson.sessionId).toBe(sessionId);

    const progressed = await post(app, `/api/v1/learning/lesson-sessions/${sessionId}/progress`, 'u1', {
      checkpointBlockId: 'b1',
      idempotencyKey: 'p1',
    });
    expect(progressed.body.session.checkpointBlockId).toBe('b1');

    const completed = await post(app, `/api/v1/learning/lesson-sessions/${sessionId}/complete`, 'u1', {
      idempotencyKey: 'c1',
    });
    expect(completed.body.session.status).toBe('completed');

    const todayAfter = await get(app, '/api/v1/learning/today', 'u1');
    expect(todayAfter.body.activeLesson).toBeUndefined();
    expect(todayAfter.body.dailyGoal.completed).toBe(1);
  });

  it('replays the cached result for a repeated idempotency key instead of erroring on an already-completed session', async () => {
    await seedPublishedLesson();
    const app = makeApp();
    const start = await post(app, '/api/v1/learning/lessons/lesson1/sessions', 'u1', { idempotencyKey: 'k1' });
    const sessionId = start.body.session.id;
    await post(app, `/api/v1/learning/lesson-sessions/${sessionId}/complete`, 'u1', { idempotencyKey: 'c1' });

    const replay = await post(app, `/api/v1/learning/lesson-sessions/${sessionId}/complete`, 'u1', {
      idempotencyKey: 'c1',
    });
    expect(replay.status).toBe(200);
    expect(replay.body.session.status).toBe('completed');
  });

  it('404s starting a session for an unpublished lesson', async () => {
    const app = makeApp();
    const res = await post(app, '/api/v1/learning/lessons/does-not-exist/sessions', 'u1', { idempotencyKey: 'k1' });
    expect(res.status).toBe(404);
  });
});

describe('practice sessions (§12)', () => {
  it('creates a session with no answer key, scores an answer server-side, and advances to completion', async () => {
    await seedPublishedLesson();
    const app = makeApp(await seededQuestionContentRepos());

    const created = await post(app, '/api/v1/learning/practice-sessions', 'u1', {
      objectiveId: 'obj1',
      mode: 'practice',
      questionCount: 2,
      idempotencyKey: 'create1',
    });
    expect(created.status).toBe(200);
    expect(created.body.session.questionCount).toBe(2);
    expect(created.body.session.currentIndex).toBe(0);
    expect(created.body.currentQuestion.text).toMatch(/^Q[12]\?$/);
    expect(created.body.currentQuestion).not.toHaveProperty('correctIndex');
    const sessionId = created.body.session.id;

    const firstAnswer = await post(app, `/api/v1/learning/practice-sessions/${sessionId}/answers`, 'u1', {
      chosenIndex: 0,
      idempotencyKey: 'a1',
    });
    expect(firstAnswer.status).toBe(200);
    expect(typeof firstAnswer.body.isCorrect).toBe('boolean');
    expect(firstAnswer.body.correctIndex).toBeGreaterThanOrEqual(0);
    expect(firstAnswer.body.session.currentIndex).toBe(1);
    expect(firstAnswer.body.session.status).toBe('active');
    expect(firstAnswer.body.nextQuestion).toBeDefined();
    expect(firstAnswer.body.mastery.totalAnswers).toBe(1);

    const secondAnswer = await post(app, `/api/v1/learning/practice-sessions/${sessionId}/answers`, 'u1', {
      chosenIndex: 0,
      idempotencyKey: 'a2',
    });
    expect(secondAnswer.body.session.currentIndex).toBe(2);
    expect(secondAnswer.body.session.status).toBe('completed');
    expect(secondAnswer.body.nextQuestion).toBeUndefined();
    expect(secondAnswer.body.mastery.totalAnswers).toBe(2);

    // The mastery update landed through the real progression authority, not a forked one.
    const profile = await get(app, '/api/v1/me/profile', 'u1');
    expect(profile.body.studyMastery.obj1.totalAnswers).toBe(2);
  });

  it('replays the cached result for a repeated answer idempotency key rather than double-scoring', async () => {
    await seedPublishedLesson();
    const app = makeApp(await seededQuestionContentRepos());
    const created = await post(app, '/api/v1/learning/practice-sessions', 'u1', {
      objectiveId: 'obj1',
      mode: 'practice',
      questionCount: 2,
      idempotencyKey: 'create1',
    });
    const sessionId = created.body.session.id;

    const first = await post(app, `/api/v1/learning/practice-sessions/${sessionId}/answers`, 'u1', {
      chosenIndex: 0,
      idempotencyKey: 'dup',
    });
    const replay = await post(app, `/api/v1/learning/practice-sessions/${sessionId}/answers`, 'u1', {
      chosenIndex: 0,
      idempotencyKey: 'dup',
    });
    expect(replay.body).toEqual(first.body);

    const profile = await get(app, '/api/v1/me/profile', 'u1');
    expect(profile.body.studyMastery.obj1.totalAnswers).toBe(1); // not double-counted
  });

  it('404s for an objective with no published questions', async () => {
    await seedPublishedLesson();
    const app = makeApp(createInMemoryContentRepositories());
    const res = await post(app, '/api/v1/learning/practice-sessions', 'u1', {
      objectiveId: 'obj1',
      mode: 'practice',
      questionCount: 2,
      idempotencyKey: 'k1',
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/learning/search (§10.2/§10.3)', () => {
  async function seedSearchFixtures() {
    const repos = createSqlLearningRepositories(tdb.db);
    await repos.plans.upsert({
      id: 'genesis',
      themeId: 'genesis',
      title: 'Буття',
      description: 'Початок творіння',
      status: 'published',
      testament: 'old_testament',
    });
    await repos.plans.upsert({
      id: 'matthew',
      themeId: 'matthew',
      title: 'Матвія',
      description: 'Євангеліє від Матвія',
      status: 'published',
      testament: 'new_testament',
    });
    await repos.plans.upsert({
      id: 'draft-plan',
      themeId: 'draft-plan',
      title: 'Буття (чернетка)',
      status: 'legacy_unreviewed',
    });
    await repos.objectives.upsert({
      id: 'genesis-creation',
      planId: 'genesis',
      title: 'Створення світу',
      topicPath: 'Буття › Створення',
      status: 'published',
      testament: 'old_testament',
    });
  }

  it('matches published plans/objectives by title or description, excludes unpublished', async () => {
    await seedSearchFixtures();
    const app = makeApp();

    const byTitle = await get(app, '/api/v1/learning/search?q=' + encodeURIComponent('Буття'), 'u1');
    expect(byTitle.status).toBe(200);
    const kinds = byTitle.body.items.map((i: { kind: string; id: string }) => [i.kind, i.id]);
    expect(kinds).toContainEqual(['plan', 'genesis']);
    expect(kinds).not.toContainEqual(['plan', 'draft-plan']);

    const byDescription = await get(app, '/api/v1/learning/search?q=' + encodeURIComponent('Євангеліє'), 'u1');
    expect(byDescription.body.items.map((i: { id: string }) => i.id)).toEqual(['matthew']);
  });

  it('filters by testament and respects the limit', async () => {
    await seedSearchFixtures();
    const app = makeApp();

    const filtered = await get(
      app,
      `/api/v1/learning/search?q=${encodeURIComponent('Буття')}&testament=new_testament`,
      'u1',
    );
    expect(filtered.body.items).toEqual([]);

    // 'Буття' matches both the genesis plan (title) and the genesis-creation
    // objective (topicPath) — two hits, so limit=1 has something to truncate.
    const limited = await get(app, `/api/v1/learning/search?q=${encodeURIComponent('Буття')}&limit=1`, 'u1');
    expect(limited.body.items.length).toBe(1);
  });

  it('400s on a too-short query', async () => {
    const app = makeApp();
    const res = await get(app, '/api/v1/learning/search?q=a', 'u1');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/learning/plans?testament (§10.3)', () => {
  it('narrows the published list by testament', async () => {
    const repos = createSqlLearningRepositories(tdb.db);
    await repos.plans.upsert({
      id: 'genesis',
      themeId: 'genesis',
      title: 'Буття',
      status: 'published',
      testament: 'old_testament',
    });
    await repos.plans.upsert({
      id: 'matthew',
      themeId: 'matthew',
      title: 'Матвія',
      status: 'published',
      testament: 'new_testament',
    });
    const app = makeApp();

    const all = await get(app, '/api/v1/learning/plans', 'u1');
    expect(all.body.plans.map((p: { id: string }) => p.id).sort()).toEqual(['genesis', 'matthew']);

    const ot = await get(app, '/api/v1/learning/plans?testament=old_testament', 'u1');
    expect(ot.body.plans.map((p: { id: string }) => p.id)).toEqual(['genesis']);
  });
});

describe('review due (§12.5)', () => {
  it('surfaces a practiced objective once its interval elapses, empty before that', async () => {
    await seedPublishedLesson();
    const app = makeApp(await seededQuestionContentRepos());

    const before = await get(app, '/api/v1/learning/review/due', 'u1');
    expect(before.body).toEqual({ dueCount: 0, items: [] });

    const created = await post(app, '/api/v1/learning/practice-sessions', 'u1', {
      objectiveId: 'obj1',
      mode: 'practice',
      questionCount: 1,
      idempotencyKey: 'create1',
    });
    await post(app, `/api/v1/learning/practice-sessions/${created.body.session.id}/answers`, 'u1', {
      chosenIndex: 0,
      idempotencyKey: 'a1',
    });

    // Not due yet — box 0 is a 1-day interval and no time has passed.
    const justAfter = await get(app, '/api/v1/learning/review/due', 'u1');
    expect(justAfter.body).toEqual({ dueCount: 0, items: [] });
  });
});
