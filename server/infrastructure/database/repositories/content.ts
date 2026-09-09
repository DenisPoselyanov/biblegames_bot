/**
 * SQL content repositories (Phase 2 §10, §14) — the production adapter for
 * `server/domains/content/repository.ts`, on Drizzle.
 *
 * The opaque `Transaction` from `ServiceContext` is narrowed to the Drizzle
 * executor here and nowhere else (`asExecutor`).
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Difficulty } from '../../../../contracts/index';
import type { Transaction as OpaqueTx } from '../../../domains/shared/context';
import { hashContentSet, hashRevisionBody } from '../../../domains/content/contentHash';
import type {
  ContentRepositories,
  ContentSetRepository,
  QuestionRevisionRepository,
} from '../../../domains/content/repository';
import type {
  ContentSetVersionRecord,
  PublishedFilter,
  QuestionRevisionRecord,
  RevisionDraft,
  ScriptureRef,
} from '../../../domains/content/types';
import type { Database, Transaction } from '../client';
import {
  contentSetItems,
  contentSets,
  contentSetVersions,
  questionRevisions,
  scriptureReferences,
} from '../schema/content';

type Executor = Database | Transaction;

const HARD_LIMIT = 500;

/** Single point where the opaque handle becomes a concrete Drizzle executor. */
function asExecutor(db: Database, tx?: OpaqueTx): Executor {
  return (tx as unknown as Transaction | undefined) ?? db;
}

let seq = 0;
const nextId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${(++seq).toString(36).padStart(3, '0')}`;

type RevRow = typeof questionRevisions.$inferSelect;
type RefRow = typeof scriptureReferences.$inferSelect;

const toRef = (r: RefRow): ScriptureRef => ({
  book: r.book,
  chapter: r.chapter,
  verseStart: r.verseStart,
  verseEnd: r.verseEnd,
  translation: r.translation,
});

function toRevisionRecord(row: RevRow, refs: RefRow[]): QuestionRevisionRecord {
  return {
    id: row.id,
    questionId: row.questionId,
    revisionNumber: row.revisionNumber,
    status: row.status as QuestionRevisionRecord['status'],
    themeId: row.themeId,
    difficulty: row.difficulty as Difficulty,
    topicNodeId: row.topicNodeId,
    topicPath: row.topicPath,
    text: row.text,
    options: row.options,
    correctIndex: row.correctIndex,
    explanationShort: row.explanationShort,
    explanationDeep: row.explanationDeep,
    reference: row.reference,
    scriptureRefs: refs
      .filter((r) => r.revisionId === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(toRef),
    tags: row.tags,
    contentHash: row.contentHash,
    source: row.source,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    supersededAt: row.supersededAt,
    quarantineReason: row.quarantineReason,
  };
}

async function loadRefs(exec: Executor, revisionIds: string[]): Promise<RefRow[]> {
  if (revisionIds.length === 0) return [];
  return exec
    .select()
    .from(scriptureReferences)
    .where(inArray(scriptureReferences.revisionId, revisionIds));
}

async function insertRefs(
  exec: Executor,
  revisionId: string,
  refs: ScriptureRef[],
): Promise<void> {
  if (refs.length === 0) return;
  await exec.insert(scriptureReferences).values(
    refs.map((r, ordinal) => ({
      revisionId,
      ordinal,
      book: r.book,
      chapter: r.chapter,
      verseStart: r.verseStart,
      verseEnd: r.verseEnd ?? null,
      translation: r.translation ?? null,
    })),
  );
}

export function createSqlContentRepositories(db: Database): ContentRepositories {
  const revisionRepo: QuestionRevisionRepository = {
    async getById(id, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .select()
        .from(questionRevisions)
        .where(eq(questionRevisions.id, id))
        .limit(1);
      if (!row) return null;
      return toRevisionRecord(row, await loadRefs(exec, [id]));
    },

    async getPublished(questionId, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .select()
        .from(questionRevisions)
        .where(
          and(
            eq(questionRevisions.questionId, questionId),
            eq(questionRevisions.status, 'published'),
          ),
        )
        .limit(1);
      if (!row) return null;
      return toRevisionRecord(row, await loadRefs(exec, [row.id]));
    },

    async listRevisions(questionId, tx) {
      const exec = asExecutor(db, tx);
      const rows = await exec
        .select()
        .from(questionRevisions)
        .where(eq(questionRevisions.questionId, questionId))
        .orderBy(desc(questionRevisions.revisionNumber));
      const refs = await loadRefs(exec, rows.map((r) => r.id));
      return rows.map((r) => toRevisionRecord(r, refs));
    },

    async listPublished(filter: PublishedFilter, tx) {
      const exec = asExecutor(db, tx);
      const clauses = [eq(questionRevisions.status, 'published')];
      if (filter.themeIds && filter.themeIds.length) {
        clauses.push(inArray(questionRevisions.themeId, filter.themeIds));
      }
      if (filter.difficulty) {
        clauses.push(eq(questionRevisions.difficulty, filter.difficulty));
      }
      if (filter.topicNodeId) {
        clauses.push(eq(questionRevisions.topicNodeId, filter.topicNodeId));
      }
      if (filter.questionIds && filter.questionIds.length) {
        clauses.push(inArray(questionRevisions.questionId, filter.questionIds));
      }
      const rows = await exec
        .select()
        .from(questionRevisions)
        .where(and(...clauses))
        .orderBy(asc(questionRevisions.questionId))
        .limit(Math.min(filter.limit ?? HARD_LIMIT, HARD_LIMIT));
      const refs = await loadRefs(exec, rows.map((r) => r.id));
      return rows.map((r) => toRevisionRecord(r, refs));
    },

    async appendRevision(draft: RevisionDraft, tx) {
      const exec = asExecutor(db, tx);
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

      const [latest] = await exec
        .select()
        .from(questionRevisions)
        .where(eq(questionRevisions.questionId, draft.questionId))
        .orderBy(desc(questionRevisions.revisionNumber))
        .limit(1);

      if (latest?.contentHash === contentHash) {
        return {
          kind: 'unchanged',
          revision: toRevisionRecord(latest, await loadRefs(exec, [latest.id])),
        };
      }

      const id = nextId('qrev');
      const [row] = await exec
        .insert(questionRevisions)
        .values({
          id,
          questionId: draft.questionId,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          status: draft.status ?? 'legacy_unreviewed',
          themeId: draft.themeId,
          difficulty: draft.difficulty,
          topicNodeId: draft.topicNodeId ?? null,
          topicPath: draft.topicPath ?? null,
          text: draft.text,
          options: draft.options,
          correctIndex: draft.correctIndex,
          explanationShort: draft.explanationShort ?? null,
          explanationDeep: draft.explanationDeep ?? null,
          reference: draft.reference ?? null,
          tags,
          contentHash,
          source: draft.source ?? 'legacy',
          createdBy: draft.createdBy ?? null,
        })
        .returning();
      await insertRefs(exec, id, scriptureRefs);
      return { kind: 'created', revision: toRevisionRecord(row, await loadRefs(exec, [id])) };
    },

    async publishRevision(revisionId, tx) {
      const exec = asExecutor(db, tx);
      const [target] = await exec
        .select()
        .from(questionRevisions)
        .where(eq(questionRevisions.id, revisionId))
        .limit(1);
      if (!target) throw new Error(`revision ${revisionId} not found`);
      const nowIso = new Date().toISOString();
      await exec
        .update(questionRevisions)
        .set({ status: 'archived', supersededAt: nowIso })
        .where(
          and(
            eq(questionRevisions.questionId, target.questionId),
            eq(questionRevisions.status, 'published'),
          ),
        );
      const [row] = await exec
        .update(questionRevisions)
        .set({ status: 'published', supersededAt: null, quarantineReason: null })
        .where(eq(questionRevisions.id, revisionId))
        .returning();
      return toRevisionRecord(row, await loadRefs(exec, [revisionId]));
    },

    async quarantine(input, tx) {
      const exec = asExecutor(db, tx);
      const rows = await exec
        .update(questionRevisions)
        .set({ status: 'quarantined', quarantineReason: input.reason })
        .where(
          and(
            eq(questionRevisions.questionId, input.questionId),
            inArray(questionRevisions.status, [
              'legacy_unreviewed',
              'draft',
              'ready_for_review',
              'published',
            ]),
          ),
        )
        .returning({ id: questionRevisions.id });
      return rows.length;
    },

    async countPublished(tx) {
      const [row] = await asExecutor(db, tx)
        .select({ count: sql<number>`count(*)::int` })
        .from(questionRevisions)
        .where(eq(questionRevisions.status, 'published'));
      return row?.count ?? 0;
    },
  };

  const setRepo: ContentSetRepository = {
    async getVersion(setId, version, tx) {
      return loadVersion(asExecutor(db, tx), setId, version);
    },

    async getLatest(setId, tx) {
      const exec = asExecutor(db, tx);
      const [row] = await exec
        .select({ version: contentSetVersions.version })
        .from(contentSetVersions)
        .where(eq(contentSetVersions.setId, setId))
        .orderBy(desc(contentSetVersions.version))
        .limit(1);
      if (!row) return null;
      return loadVersion(exec, setId, row.version);
    },

    async publishVersion(input, tx) {
      const exec = asExecutor(db, tx);
      const contentHash = hashContentSet(input.items.map((i) => i.revisionId));

      const [latest] = await exec
        .select()
        .from(contentSetVersions)
        .where(eq(contentSetVersions.setId, input.setId))
        .orderBy(desc(contentSetVersions.version))
        .limit(1);
      if (latest?.contentHash === contentHash) {
        return (await loadVersion(exec, input.setId, latest.version))!;
      }

      await exec
        .insert(contentSets)
        .values({ id: input.setId, kind: input.kind, filter: input.filter })
        .onConflictDoUpdate({
          target: contentSets.id,
          set: { kind: input.kind, filter: input.filter, updatedAt: new Date().toISOString() },
        });

      const version = (latest?.version ?? 0) + 1;
      await exec.insert(contentSetVersions).values({
        setId: input.setId,
        version,
        contentHash,
        questionCount: input.items.length,
        publishedBy: input.publishedBy ?? null,
      });
      if (input.items.length) {
        await exec.insert(contentSetItems).values(
          input.items.map((it, position) => ({
            setId: input.setId,
            version,
            position,
            questionId: it.questionId,
            revisionId: it.revisionId,
          })),
        );
      }
      return (await loadVersion(exec, input.setId, version))!;
    },
  };

  return { revisions: revisionRepo, sets: setRepo };
}

async function loadVersion(
  exec: Executor,
  setId: string,
  version: number,
): Promise<ContentSetVersionRecord | null> {
  const [head] = await exec
    .select({
      version: contentSetVersions.version,
      contentHash: contentSetVersions.contentHash,
      questionCount: contentSetVersions.questionCount,
      publishedAt: contentSetVersions.publishedAt,
      publishedBy: contentSetVersions.publishedBy,
      kind: contentSets.kind,
      filter: contentSets.filter,
    })
    .from(contentSetVersions)
    .innerJoin(contentSets, eq(contentSets.id, contentSetVersions.setId))
    .where(and(eq(contentSetVersions.setId, setId), eq(contentSetVersions.version, version)))
    .limit(1);
  if (!head) return null;
  const items = await exec
    .select()
    .from(contentSetItems)
    .where(and(eq(contentSetItems.setId, setId), eq(contentSetItems.version, version)))
    .orderBy(asc(contentSetItems.position));
  return {
    setId,
    kind: head.kind as ContentSetVersionRecord['kind'],
    version: head.version,
    contentHash: head.contentHash,
    filter: (head.filter ?? {}) as ContentSetVersionRecord['filter'],
    questionCount: head.questionCount,
    items: items.map((i) => ({
      position: i.position,
      questionId: i.questionId,
      revisionId: i.revisionId,
    })),
    publishedAt: head.publishedAt,
    publishedBy: head.publishedBy,
  };
}
