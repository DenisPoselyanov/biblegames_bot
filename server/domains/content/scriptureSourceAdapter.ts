/**
 * Trusted-source adapter contract for Scripture verification (Phase 4 WS4,
 * spec §6.3/§5.4). Domain-owned interface only — the concrete adapter
 * (`server/infrastructure/scripture/bollsSourceAdapter.ts`) wraps the bolls.life
 * client this repo already uses for the Daily Scripture / reader feature
 * (`server/bollsClient.ts`, `server/scriptureService.ts`); a mock adapter
 * (`server/infrastructure/scripture/mockSourceAdapter.ts`) covers deterministic
 * tests, mirroring WS1's `AiProvider`/`MockProvider` split.
 */

export interface ScripturePassageLookup {
  bookId: number;
  chapter: number;
  verses: number[];
  translation: string;
}

export interface ScriptureVerseRow {
  verse: number;
  text: string;
}

export interface ScriptureSourceAdapter {
  /** Identifies which source/version produced the evidence — stored alongside it (§5.4 "adapter version"). */
  readonly version: string;
  /** `null` means the source has no data for this passage or is unavailable — the caller reports `not_found`, never throws. */
  fetchPassage(lookup: ScripturePassageLookup): Promise<ScriptureVerseRow[] | null>;
}
