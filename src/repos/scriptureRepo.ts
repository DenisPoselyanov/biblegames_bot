import type { BollsTranslation } from '../lib/bollsConstants';
import type { DailyScripture, ScripturePassage } from '../types/scripture';
import { apiUrl, hasApi } from './apiClient';

export function scriptureAvailable(): boolean {
  return hasApi();
}

export async function fetchScripturePassage(
  reference: string,
  translation?: BollsTranslation,
): Promise<ScripturePassage | null> {
  if (!hasApi() || !reference.trim()) return null;
  const params = new URLSearchParams({ ref: reference.trim() });
  if (translation) params.set('translation', translation);
  const res = await fetch(apiUrl(`/api/scripture?${params.toString()}`));
  if (!res.ok) return null;
  return (await res.json()) as ScripturePassage;
}

export async function fetchDailyScripture(translation?: BollsTranslation): Promise<DailyScripture | null> {
  if (!hasApi()) return null;
  const params = new URLSearchParams();
  if (translation) params.set('translation', translation);
  const qs = params.toString();
  const res = await fetch(apiUrl(`/api/scripture/daily${qs ? `?${qs}` : ''}`));
  if (!res.ok) return null;
  return (await res.json()) as DailyScripture;
}
