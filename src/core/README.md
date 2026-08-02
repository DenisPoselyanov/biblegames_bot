# Domain boundaries (`src/core/`)

Introduced in Phase 1 ([ADR-001](../../docs/product-rebuild/DECISIONS.md#adr-001--скорочення-цільової-архітектури-без-повного-monorepo-apps--packages)) as a **logical**, additive boundary — not a physical monorepo split. Files stay where they already live; each `src/core/<domain>/index.ts` is a barrel that re-exports the modules belonging to that domain, importable via the `@core/<domain>` alias (configured in `tsconfig.app.json` and `vite.config.ts`/`vite.config.mjs`).

New code in a given domain should import through `@core/<domain>` instead of reaching across with deep relative paths. Existing relative imports are untouched — this is not a breaking rename.

## Domain map

| Domain | Barrel | Covers |
|---|---|---|
| `learning` | `@core/learning` | question/topic DB + loaders, practice progression, streak, study themes, player profile/progress |
| `social` | `@core/social` | communities, friend challenges, Kahoot live rooms/ranking |
| `shop` | `@core/shop` | cosmetics catalog, cosmetic theme application |
| `ai` | `@core/ai` | placeholder — no client-side AI code exists yet; today's AI tooling lives in `scripts/` (see Phase 10 roadmap). Reserved for future in-app AI assistance (`in_app_ai_assistance` flag, post-Phase 10) |
| `shared` | `@core/shared` | generic infra: storage/persistence, Telegram SDK, motion tokens, query client, telemetry |

`src/types/index.ts` (currently a single 441-line barrel mixing learning/social/shop types) and `src/context/PlayerContext.tsx` (mixes player/progress/wallet state) are known cross-domain files — deliberately **not** split or moved in Phase 1; that's a dedicated future task, not a mechanical file move.

## Non-goals for Phase 1

- No physical file moves of high-fan-in modules (`lib/motion.ts`, `lib/telegram.ts`, `data/themes.ts`, `context/PlayerContext.tsx`, etc.) — see [MASTER_ROADMAP.md](../../docs/product-rebuild/MASTER_ROADMAP.md).
- No monorepo/`packages/` split — see ADR-001.
