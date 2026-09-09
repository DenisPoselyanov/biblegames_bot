/**
 * `content.snapshot` job handler (Phase 2 §14, §17).
 *
 * Builds a static published-content snapshot and writes it to object storage as
 * an **output** — `snapshots/<setId>/<contentHash>.json` plus a `latest.json`
 * pointer. Enqueued on demand (e.g. after a publish); regenerated from the
 * canonical store, never read back as a repository (§25).
 */
import { contentSetFilter } from '../../contracts/index';
import { buildSnapshot } from '../domains/content/snapshot';
import type { ContentRepositories } from '../domains/content/repository';
import type { PublishedFilter } from '../domains/content/types';
import type { JobHandler } from '../domains/jobs/queue';
import type { ObjectStore } from '../domains/storage/objectStore';

export interface ContentSnapshotDeps {
  repos: ContentRepositories;
  store: ObjectStore;
  now?: () => Date;
}

export interface ContentSnapshotPayload {
  setId: string;
  filter?: Record<string, unknown>;
}

export function contentSnapshotHandler(
  deps: ContentSnapshotDeps,
): JobHandler<ContentSnapshotPayload> {
  const now = deps.now ?? (() => new Date());
  return async (ctx) => {
    const { setId, filter: rawFilter } = ctx.job.payload;
    const filter = contentSetFilter.parse(rawFilter ?? {});
    const published = await deps.repos.revisions.listPublished(filter as PublishedFilter);
    const snapshot = buildSnapshot(setId, filter, published, now);

    const body = `${JSON.stringify(snapshot, null, 2)}\n`;
    const metadata = {
      contentHash: snapshot.set.contentHash,
      questionCount: String(snapshot.set.questionCount),
      generatedAt: snapshot.generatedAt,
    };
    const base = `snapshots/${setId}`;
    await deps.store.put(`${base}/${snapshot.set.contentHash}.json`, body, {
      contentType: 'application/json',
      metadata,
    });
    await deps.store.put(`${base}/latest.json`, body, {
      contentType: 'application/json',
      metadata,
    });

    await ctx.checkpoint({
      contentHash: snapshot.set.contentHash,
      questionCount: snapshot.set.questionCount,
      generatedAt: snapshot.generatedAt,
    });
  };
}
