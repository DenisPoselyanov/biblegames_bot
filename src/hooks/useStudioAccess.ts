import { useQuery } from '@tanstack/react-query';
import { useAuthSession } from '../context/AuthSessionContext';
import { apiRequest, hasApi } from '../lib/apiClient';
import { queryKeys } from '../queries/keys';

/** Roles that open Content Studio — mirrors `isStudioRole` in the studio bundle. */
const STUDIO_ROLES = new Set(['content_reviewer', 'content_publisher', 'admin']);

/**
 * Whether the signed-in principal may enter Content Studio (Phase 4 WS8d), so
 * player screens show the «Студія контенту» link only to content roles.
 *
 * Deliberately self-contained rather than reusing `studioRepo`: that module
 * pulls types from `src/pages/studio/**`, and player routes must not reach the
 * studio tree at all (`studioBoundary.test.ts`). Shares the studio's identity
 * query key, so opening the studio after this ran reuses the cached `/me`.
 *
 * UX only — hiding a link is not a security boundary; `/studio` re-checks and
 * every studio endpoint enforces its own permission server-side.
 */
export function useStudioAccess(): boolean {
  const { userId } = useAuthSession();
  const query = useQuery({
    queryKey: queryKeys.studio.identity(userId),
    queryFn: () => apiRequest<{ roles: string[] }>('/me'),
    enabled: Boolean(userId) && hasApi(),
    staleTime: 60_000,
    retry: false,
  });
  return (query.data?.roles ?? []).some((role) => STUDIO_ROLES.has(role));
}
