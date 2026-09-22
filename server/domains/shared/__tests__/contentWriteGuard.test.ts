import { describe, expect, it } from 'vitest';
import { assertAiWriteAllowed } from '../contentWriteGuard';

describe('assertAiWriteAllowed', () => {
  it('allows an AI-originated draft/legacy_unreviewed write', () => {
    expect(() => assertAiWriteAllowed('ai', 'draft')).not.toThrow();
    expect(() => assertAiWriteAllowed('ai', 'legacy_unreviewed')).not.toThrow();
    expect(() => assertAiWriteAllowed('ai', undefined)).not.toThrow();
  });

  it('rejects an AI-originated write claiming published/ready_for_review/quarantined/archived', () => {
    expect(() => assertAiWriteAllowed('ai', 'published')).toThrow(/AI-originated/);
    expect(() => assertAiWriteAllowed('ai', 'ready_for_review')).toThrow(/AI-originated/);
    expect(() => assertAiWriteAllowed('ai', 'quarantined')).toThrow(/AI-originated/);
    expect(() => assertAiWriteAllowed('ai', 'archived')).toThrow(/AI-originated/);
  });

  it('is a no-op for any non-ai source, regardless of status', () => {
    expect(() => assertAiWriteAllowed('legacy', 'published')).not.toThrow();
    expect(() => assertAiWriteAllowed('authored', 'ready_for_review')).not.toThrow();
    expect(() => assertAiWriteAllowed(undefined, 'published')).not.toThrow();
  });
});
