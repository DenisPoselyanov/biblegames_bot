import { describe, expect, it } from 'vitest';
import { createInMemoryContentRepositories } from '../../domains/content/inMemoryRepository';
import { createMemoryObjectStore } from '../../infrastructure/storage/memoryObjectStore';
import { JOB_TYPES } from '../../domains/jobs/catalog';
import { createInMemoryJobQueue } from '../../domains/jobs/inMemoryQueue';
import { registerCoreJobs } from '../index';

async function seedPublished(repos: ReturnType<typeof createInMemoryContentRepositories>) {
  for (const [i, text] of ['Who built the ark?', 'Who led the Exodus?'].entries()) {
    const appended = await repos.revisions.appendRevision({
      questionId: `q${i + 1}`,
      themeId: 'genesis',
      difficulty: 'youth',
      text,
      options: ['a', 'b', 'c'],
      correctIndex: 0,
    });
    if (appended.kind !== 'unchanged') {
      await repos.revisions.publishRevision(appended.revision.id);
    }
  }
}

describe('content.snapshot job', () => {
  it('writes a versioned snapshot and a latest.json pointer to object storage', async () => {
    const repos = createInMemoryContentRepositories();
    await seedPublished(repos);
    const store = createMemoryObjectStore();
    const queue = createInMemoryJobQueue({ onEvent: () => {} });

    registerCoreJobs(queue, { query: async () => ({ rowCount: 0 }), content: { repos, store } });

    const { id } = await queue.enqueue(JOB_TYPES.CONTENT_SNAPSHOT, { setId: 'genesis-youth' });
    await queue.runDue();

    const job = queue.peek(id)!;
    expect(job.status).toBe('completed');
    const contentHash = job.checkpoint?.contentHash as string;
    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(job.checkpoint?.questionCount).toBe(2);

    const keys = await store.list('snapshots/genesis-youth/');
    expect(keys).toEqual([
      `snapshots/genesis-youth/${contentHash}.json`,
      'snapshots/genesis-youth/latest.json',
    ]);

    const latest = await store.get('snapshots/genesis-youth/latest.json');
    const parsed = JSON.parse(latest!.body.toString('utf8'));
    expect(parsed.set.questionCount).toBe(2);
    expect(parsed.questions.map((q: { id: string }) => q.id)).toEqual(['q1', 'q2']);
    expect(latest!.metadata.contentHash).toBe(contentHash);
  });

  it('is not registered without content deps', async () => {
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    registerCoreJobs(queue, { query: async () => ({ rowCount: 0 }) });
    expect((await queue.stats()).types).not.toContain(JOB_TYPES.CONTENT_SNAPSHOT);
  });
});
