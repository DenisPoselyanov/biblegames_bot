/**
 * Shared content-repository contract (Phase 2 §10, §14). Run against every
 * adapter (`server/infrastructure/database/repositories/content.ts` on pglite,
 * and the in-memory peer). Read behaviour must match; the in-memory adapter is
 * exempt only from real transaction support.
 */
import { expect, it } from 'vitest';
import type { RevisionDraft } from '../types';
import type { ContentRepositories } from '../repository';

export interface ContractHarness {
  repos: ContentRepositories;
  reset: () => Promise<void>;
}

const draft = (over: Partial<RevisionDraft> = {}): RevisionDraft => ({
  questionId: 'q1',
  themeId: 'genesis',
  difficulty: 'youth',
  text: 'Who built the ark?',
  options: ['Noah', 'Moses', 'Abraham'],
  correctIndex: 0,
  ...over,
});

export function runContentRepositoryContract(makeHarness: () => Promise<ContractHarness>): void {
  let h: ContractHarness;

  const setup = async (): Promise<ContentRepositories> => {
    h = await makeHarness();
    await h.reset();
    return h.repos;
  };

  it('appendRevision numbers revisions and is idempotent by body hash', async () => {
    const { revisions } = await setup();

    const first = await revisions.appendRevision(draft());
    expect(first.kind).toBe('created');
    expect(first.revision.revisionNumber).toBe(1);
    expect(first.revision.status).toBe('legacy_unreviewed');
    expect(first.revision.contentHash).toMatch(/^[a-f0-9]{64}$/);

    const same = await revisions.appendRevision(draft());
    expect(same.kind).toBe('unchanged');
    expect(same.revision.id).toBe(first.revision.id);

    const changed = await revisions.appendRevision(draft({ text: 'Who built the ark, really?' }));
    expect(changed.kind).toBe('created');
    expect(changed.revision.revisionNumber).toBe(2);

    const all = await revisions.listRevisions('q1');
    expect(all.map((r) => r.revisionNumber)).toEqual([2, 1]);
  });

  it('hash ignores field order in scriptureRefs/tags', async () => {
    const { revisions } = await setup();
    const a = await revisions.appendRevision(
      draft({ tags: ['ot', 'flood'], scriptureRefs: [{ book: 'Gen', chapter: 6, verseStart: 14, verseEnd: null, translation: null }] }),
    );
    const b = await revisions.appendRevision(
      draft({ tags: ['flood', 'ot'], scriptureRefs: [{ book: 'Gen', chapter: 6, verseStart: 14, verseEnd: null, translation: null }] }),
    );
    expect(b.kind).toBe('unchanged');
    expect(b.revision.id).toBe(a.revision.id);
  });

  it('publishRevision makes exactly one revision published and archives the prior one', async () => {
    const { revisions } = await setup();
    const r1 = (await revisions.appendRevision(draft())).revision;
    const r2 = (await revisions.appendRevision(draft({ text: 'v2 text' }))).revision;

    await revisions.publishRevision(r1.id);
    expect((await revisions.getPublished('q1'))?.id).toBe(r1.id);

    const published2 = await revisions.publishRevision(r2.id);
    expect(published2.status).toBe('published');
    expect((await revisions.getPublished('q1'))?.id).toBe(r2.id);

    const r1After = await revisions.getById(r1.id);
    expect(r1After?.status).toBe('archived');
    expect(r1After?.supersededAt).not.toBeNull();

    expect(await revisions.countPublished()).toBe(1);
  });

  it('listPublished filters by theme/difficulty and never returns drafts', async () => {
    const { revisions } = await setup();
    const a = (await revisions.appendRevision(draft({ questionId: 'qa', themeId: 'genesis', difficulty: 'youth' }))).revision;
    const b = (await revisions.appendRevision(draft({ questionId: 'qb', themeId: 'exodus', difficulty: 'youth' }))).revision;
    const c = (await revisions.appendRevision(draft({ questionId: 'qc', themeId: 'genesis', difficulty: 'child' }))).revision;
    await revisions.appendRevision(draft({ questionId: 'qd', themeId: 'genesis', difficulty: 'youth' })); // stays legacy_unreviewed

    await revisions.publishRevision(a.id);
    await revisions.publishRevision(b.id);
    await revisions.publishRevision(c.id);

    const genesisYouth = await revisions.listPublished({ themeIds: ['genesis'], difficulty: 'youth' });
    expect(genesisYouth.map((r) => r.questionId)).toEqual(['qa']);

    const allYouth = await revisions.listPublished({ difficulty: 'youth' });
    expect(allYouth.map((r) => r.questionId).sort()).toEqual(['qa', 'qb']);
  });

  it('quarantine moves every live revision of a question out of selection', async () => {
    const { revisions } = await setup();
    const r1 = (await revisions.appendRevision(draft())).revision;
    await revisions.appendRevision(draft({ text: 'v2' }));
    await revisions.publishRevision(r1.id);

    const moved = await revisions.quarantine({ questionId: 'q1', reason: 'bad answer key' });
    expect(moved).toBe(2);
    expect(await revisions.getPublished('q1')).toBeNull();
    expect((await revisions.listPublished({ themeIds: ['genesis'] })).length).toBe(0);
    expect((await revisions.getById(r1.id))?.quarantineReason).toBe('bad answer key');
  });

  it('publishVersion freezes an ordered set and is idempotent by membership', async () => {
    const { revisions, sets } = await setup();
    const a = (await revisions.appendRevision(draft({ questionId: 'qa' }))).revision;
    const b = (await revisions.appendRevision(draft({ questionId: 'qb', text: 'b' }))).revision;

    const v1 = await sets.publishVersion({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [
        { questionId: 'qa', revisionId: a.id },
        { questionId: 'qb', revisionId: b.id },
      ],
    });
    expect(v1.version).toBe(1);
    expect(v1.questionCount).toBe(2);
    expect(v1.items.map((i) => i.questionId)).toEqual(['qa', 'qb']);

    const again = await sets.publishVersion({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [
        { questionId: 'qa', revisionId: a.id },
        { questionId: 'qb', revisionId: b.id },
      ],
    });
    expect(again.version).toBe(1);
    expect(again.contentHash).toBe(v1.contentHash);

    const v2 = await sets.publishVersion({
      setId: 'quiz:genesis',
      kind: 'quiz',
      filter: { themeIds: ['genesis'], difficulty: null, topicNodeId: null, questionIds: [] },
      items: [{ questionId: 'qb', revisionId: b.id }],
    });
    expect(v2.version).toBe(2);
    expect((await sets.getLatest('quiz:genesis'))?.version).toBe(2);
    expect((await sets.getVersion('quiz:genesis', 1))?.questionCount).toBe(2);
  });
}
