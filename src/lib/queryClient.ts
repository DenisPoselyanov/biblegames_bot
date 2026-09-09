import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/keys';

/**
 * Shared React Query client. Global defaults are conservative; per-key-family
 * overrides below encode the §13.3 trust boundary — the wallet is refetched
 * aggressively and never served stale, published content is immutable per
 * version and effectively never refetched.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Wallet / rank: authoritative, cheap to be wrong about — always revalidate.
queryClient.setQueryDefaults(['me', 'wallet'], {
  staleTime: 0,
  refetchOnMount: 'always',
});

// Published content set: immutable per version — refetch only on explicit invalidation.
queryClient.setQueryDefaults(queryKeys.content.publishedVersion(), {
  staleTime: Infinity,
  gcTime: Infinity,
});
