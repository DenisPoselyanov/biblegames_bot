import { describe, expect, it } from 'vitest';
import { createMemoryAuditLog } from '../../audit';
import { createMemoryObjectStore } from '../../infrastructure/storage/memoryObjectStore';
import { createMockAiProvider } from '../../infrastructure/ai/mockProvider';
import { AiProviderError } from '../../domains/ai/types';
import { JOB_TYPES } from '../../domains/jobs/catalog';
import { createInMemoryJobQueue } from '../../domains/jobs/inMemoryQueue';
import { registerCoreJobs } from '../index';

describe('content.ai_generate job (Phase 4 §7, §8, WS1)', () => {
  it('writes a raw artifact to object storage on success', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    provider.enqueue({ text: '{"question":"Хто збудував ковчег?"}' });
    const queue = createInMemoryJobQueue({ onEvent: () => {} });

    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: { maxRequests: 5 } },
    });

    const { id } = await queue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'question.generate.v1',
      prompt: 'Згенеруй питання про Ноя',
    });
    await queue.runDue();

    const job = queue.peek(id)!;
    expect(job.status).toBe('completed');
    const artifact = await store.get(`ai-artifacts/${id}.json`);
    expect(artifact).not.toBeNull();
    const parsed = JSON.parse(artifact!.body.toString('utf-8'));
    expect(parsed.output).toBe('{"question":"Хто збудував ковчег?"}');
    expect(parsed.promptVersion).toBe('question.generate.v1');
  });

  it('rejects an invalid payload at the queue boundary (missing promptVersion)', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: {} },
    });

    await expect(
      queue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, { prompt: 'no version' }),
    ).rejects.toThrow(/invalid payload/i);
  });

  it('retries a retryable provider error via the queue backoff, then succeeds', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    provider.enqueue(
      { throw: new AiProviderError('rate limited', { kind: 'rate_limited', retryable: true }) },
      { text: 'ok on retry' },
    );
    const queue = createInMemoryJobQueue({ onEvent: () => {}, backoffMs: () => 0 });
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: { maxRequests: 5 } },
    });

    const { id } = await queue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'question.generate.v1',
      prompt: 'p',
    });
    await queue.runDue();
    expect(queue.peek(id)!.status).toBe('retry');

    await queue.runDue();
    expect(queue.peek(id)!.status).toBe('completed');
    const artifact = await store.get(`ai-artifacts/${id}.json`);
    expect(JSON.parse(artifact!.body.toString('utf-8')).output).toBe('ok on retry');
  });

  it('checkpoints usage after a successful call so a later resume can see it', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    provider.enqueue({ text: 'ok' });
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: { maxRequests: 5 } },
    });

    const { id } = await queue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'question.generate.v1',
      prompt: 'p',
    });
    await queue.runDue();

    expect(queue.peek(id)!.checkpoint).toMatchObject({
      usage: { requests: 1, tokens: 0, costUsd: 0 },
    });
  });

  it('audits a successful generation under SYSTEM_ACTOR when an auditLog is configured (WS7)', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    provider.enqueue({ text: 'ok' });
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    const auditLog = createMemoryAuditLog();
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: { maxRequests: 5 }, auditLog },
    });

    const { id } = await queue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'question.generate.v1',
      prompt: 'p',
    });
    await queue.runDue();

    expect(auditLog.records).toHaveLength(1);
    expect(auditLog.records[0]).toMatchObject({
      actor: { userId: null, authSource: 'system' },
      action: 'content.generate',
      target: id,
      result: 'ok',
    });
  });

  it('does not audit anything when no auditLog is configured', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    provider.enqueue({ text: 'ok' });
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: { maxRequests: 5 } },
    });
    const { id } = await queue.enqueue(JOB_TYPES.AI_CONTENT_GENERATE, {
      promptVersion: 'question.generate.v1',
      prompt: 'p',
    });
    await expect(queue.runDue()).resolves.toBeDefined();
    expect(queue.peek(id)!.status).toBe('completed');
  });
});

describe('content.ai_repair job (Phase 4 WS9)', () => {
  it('stores the suggestion as an artifact tied to the question and audits it as content.repair', async () => {
    const store = createMemoryObjectStore();
    const provider = createMockAiProvider();
    provider.enqueue({ text: '{"text":"виправлено"}' });
    const auditLog = createMemoryAuditLog();
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider, store, budget: { maxRequests: 5 }, auditLog },
    });

    const { id } = await queue.enqueue(JOB_TYPES.AI_CONTENT_REPAIR, {
      promptVersion: 'question.repair.v1',
      prompt: 'Виправ питання',
      questionId: 'q-ark',
      revisionId: 'qrev_1',
      signal: 'accuracy:too_hard',
    });
    await queue.runDue();

    expect(queue.peek(id)!.status).toBe('completed');
    const artifact = JSON.parse((await store.get(`ai-artifacts/${id}.json`))!.body.toString('utf-8'));
    expect(artifact).toMatchObject({ questionId: 'q-ark', revisionId: 'qrev_1', output: '{"text":"виправлено"}' });
    const [record] = await auditLog.query({ action: 'content.repair' });
    expect(record).toMatchObject({ target: id, metadata: { questionId: 'q-ark', signal: 'accuracy:too_hard' } });
  });

  it('rejects a repair payload without the question it is about', async () => {
    const queue = createInMemoryJobQueue({ onEvent: () => {} });
    registerCoreJobs(queue, {
      query: async () => ({ rowCount: 0 }),
      ai: { provider: createMockAiProvider(), store: createMemoryObjectStore(), budget: {} },
    });
    await expect(
      queue.enqueue(JOB_TYPES.AI_CONTENT_REPAIR, { promptVersion: 'v', prompt: 'p' }),
    ).rejects.toThrow(/invalid payload/i);
  });
});
