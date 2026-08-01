import { useEffect, useState } from 'react';
import type { BollsTranslation } from '../lib/bollsConstants';
import { fetchScripturePassage } from '../repos/scriptureRepo';
import type { ScripturePassage } from '../types/scripture';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export function useScripture(reference: string | undefined, translation: BollsTranslation) {
  const [state, setState] = useState<LoadState>('idle');
  const [passage, setPassage] = useState<ScripturePassage | null>(null);

  useEffect(() => {
    const ref = reference?.trim();
    if (!ref) {
      setState('idle');
      setPassage(null);
      return;
    }

    let cancelled = false;
    setState('loading');

    void fetchScripturePassage(ref, translation)
      .then((data) => {
        if (cancelled) return;
        if (!data || data.parseError || data.verses.length === 0) {
          setPassage(data);
          setState('error');
          return;
        }
        setPassage(data);
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setPassage(null);
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [reference, translation]);

  return { state, passage };
}
