import { useEffect, useState } from 'react';

/** Live `matchMedia` — re-renders when the viewport crosses the query. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * From here up the sidebar sits in the layout and pushes the content; below it
 * (tablets) the rail is permanent and the full menu opens over the content.
 */
export const DESKTOP_QUERY = '(min-width: 1024px)';
