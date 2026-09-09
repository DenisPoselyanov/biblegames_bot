/**
 * In-memory content repositories (Phase 2 §10 parity peer).
 *
 * For dev fixtures and as the contract-test peer to the SQL adapter. Writes
 * inside a `tx` are rejected — the in-memory store does not emulate transactions
 * for production writes (§10).
 */
import type { Transaction } from '../shared/context';
import { hashContentSet, hashRevisionBody } from './contentHash';
import type {
  ContentRepositories,
  ContentSetRepository,
  QuestionRevisionRepository,
} from './repository';
import type {
  ContentSetVersionRecord,
  PublishedFilter,
  QuestionRevisionRecord,
  RevisionDraft,
} from './types';

const HARD_LIMIT = 500;

function rejectTx(tx?: Transaction): void {
  if (tx) {
    throw new Error('in-memory content repository does not support transactional writes (§10)');
  }
}

let seq = 0;
const nextId = (prefix: string): string => `${prefix}_${(++seq).toString(36).padStart(6, '0')}`;

export function createInMemoryContentRepositories(
  now: () => Date = () => new Date(),
): ContentRepositories {
  const revisions = new Map<string, QuestionRevisionRecord>();
  const revIdsByQuestion = new Map<string, Set<string>>();
  const setKinds = new Map<string, ContentSetVersionRecord['kind']>();
  const versions = new Map<string, ContentSetVersionRecord>(); // `${setId}#${version}`

  const iso = (): string => now().toISOString();
  const putRevision = (r: QuestionRevisionRecord): void => {
    revisions.set(r.id, r);
    let ids = revIdsByQuestion.get(r.questionId);
    if (!ids) revIdsByQuestion.set(r.questionId, (ids = new Set()));
    ids.add(r.id);
  };
  const byQuestion = (questionId: string): QuestionRevisionRecord[] =>
    [...(revIdsByQuestion.get(questionId) ?? [])]
      .map((id) => revisions.get(id)!)
      .sort((a, b) => b.revisionNumber - a.revisionNumber);

  const revisionRepo: QuestionRevisionRepository = {
    async getById(id, tx) {
      rejectTx(tx);
      const r = revisions.get(id);
      return r ? { ...r } : null;
    },
    async getPublished(questionId, tx) {
      rejectTx(tx);
      const r = byQuestion(questionId).find((x) => x.status === 'published');
      return r ? { ...r } : null;
    },
    async listRevisions(questionId, tx) {
      rejectTx(tx);
      return byQuestion(questionId).map((r) => ({ ...r }));
    },
    async listPublished(filter: PublishedFilter, tx) {
      rejectTx(tx);
      const themeIds = filter.themeIds && filter.themeIds.length ? new Set(filter.themeIds) : null;
      const questionIds =
        filter.questionIds && filter.questionIds.length ? new Set(filter.questionIds) : null;
      const limit = Math.min(filter.limit ?? HARD_LIMIT, HARD_LIMIT);
      return [...revisions.values()]
        .filter((r) => r.status === 'published')
        .filter((r) => (themeIds ? themeIds.has(r.themeId) : true))
        .filter((r) => (filter.difficulty ? r.difficulty === filter.difficulty : true))
        .filter((r) => (filter.topicNodeId ? r.topicNodeId === filter.topicNodeId : true))
        .filter((r) => (questionIds ? questionIds.has(r.questionId) : true))
        .sort((a, b) => (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0))
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
    async appendRevision(draft: RevisionDraft, tx) {
      rejectTx(tx);
      const scriptureRefs = draft.scriptureRefs ?? [];
      const tags = draft.tags ?? [];
      const contentHash = hashRevisionBody({
        themeId: draft.themeId,
        difficulty: draft.difficulty,
        topicNodeId: draft.topicNodeId ?? null,
        text: draft.text,
        options: draft.options,
        correctIndex: draft.correctIndex,
        explanationShort: draft.explanationShort ?? null,
        explanationDeep: draft.explanationDeep ?? null,
        reference: draft.reference ?? null,
        scriptureRefs,
        tags,
      });
      const existing = byQuestion(draft.questionId);
      if (existing[0]?.contentHash === contentHash) {
        return { kind: 'unchanged', revision: { ...existing[0] } };
      }
      const row: QuestionRevisionRecord = {
        id: nextId('qrev'),
        questionId: draft.questionId,
        revisionNumber: (existing[0]?.revisionNumber ?? 0) + 1,
        status: draft.status ?? 'legacy_unreviewed',
        themeId: draft.themeId,
        difficulty: draft.difficulty,
        topicNodeId: draft.topicNodeId ?? null,
        topicPath: draft.topicPath ?? null,
        text: draft.text,
        options: [...draft.options],
        correctIndex: draft.correctIndex,
        explanationShort: draft.explanationShort ?? null,
        explanationDeep: draft.explanationDeep ?? null,
        reference: draft.reference ?? null,
        scriptureRefs: scriptureRefs.map((r) => ({ ...r })),
        tags: [...tags],
        contentHash,
        source: draft.source ?? 'legacy',
        createdAt: iso(),
        createdBy: draft.createdBy ?? null,
        supersededAt: null,
        quarantineReason: null,
      };
      putRevision(row);
      return { kind: 'created', revision: { ...row } };
    },
    async publishRevision(revisionId, tx) {
      rejectTx(tx);
      const target = revisions.get(revisionId);
      if (!target) throw new Error(`revision ${revisionId} not found`);
      const ts = iso();
      for (const r of byQuestion(target.questionId)) {
        if (r.id !== revisionId && r.status === 'published') {
          revisions.set(r.id, { ...r, status: 'archived', supersededAt: ts });
        }
      }
      const published: QuestionRevisionRecord = {
        ...target,
        status: 'published',
        supersededAt: null,
        quarantineReason: null,
      };
      revisions.set(revisionId, published);
      return { ...published };
    },
    async quarantine(input, tx) {
      rejectTx(tx);
      let count = 0;
      for (const r of byQuestion(input.questionId)) {
        if (r.status === 'archived' || r.status === 'quarantined') continue;
        revisions.set(r.id, {
          ...r,
          status: 'quarantined',
          quarantineReason: input.reason,
        });
        count += 1;
      }
      return count;
    },
    async countPublished(tx) {
      rejectTx(tx);
      return [...revisions.values()].filter((r) => r.status === 'published').length;
    },
  };

  const setRepo: ContentSetRepository = {
    async getVersion(setId, version, tx) {
      rejectTx(tx);
      const v = versions.get(`${setId}#${version}`);
      return v ? clone(v) : null;
    },
    async getLatest(setId, tx) {
      rejectTx(tx);
      const all = [...versions.values()]
        .filter((v) => v.setId === setId)
        .sort((a, b) => b.version - a.version);
      return all[0] ? clone(all[0]) : null;
    },
    async publishVersion(input, tx) {
      rejectTx(tx);
      const contentHash = hashContentSet(input.items.map((i) => i.revisionId));
      const latest = [...versions.values()]
        .filter((v) => v.setId === input.setId)
        .sort((a, b) => b.version - a.version)[0];
      if (latest?.contentHash === contentHash) return clone(latest);
      const version = (latest?.version ?? 0) + 1;
      setKinds.set(input.setId, input.kind);
      const record: ContentSetVersionRecord = {
        setId: input.setId,
        kind: input.kind,
        version,
        contentHash,
        filter: input.filter,
        questionCount: input.items.length,
        items: input.items.map((it, position) => ({ position, ...it })),
        publishedAt: iso(),
        publishedBy: input.publishedBy ?? null,
      };
      versions.set(`${input.setId}#${version}`, record);
      return clone(record);
    },
  };

  return { revisions: revisionRepo, sets: setRepo };
}

function clone(v: ContentSetVersionRecord): ContentSetVersionRecord {
  return { ...v, filter: { ...v.filter }, items: v.items.map((i) => ({ ...i })) };
}
