# Domain boundaries (`src/core/`)

The current architecture direction is defined by [canonical Phase 2](../../docs/phases/PHASE_2_CORE_ARCHITECTURE_AND_DATA_PLATFORM.md) and [ADR](../../docs/DECISIONS.md). The existing barrels are useful baseline code created under the legacy roadmap; they do not by themselves complete canonical Phase 1 or Phase 2.

New code in a domain should prefer the approved domain boundary instead of uncontrolled deep cross-domain imports. Existing imports are migrated only through an explicit plan, tests and compatibility review.

## Domain map

| Domain | Barrel | Covers |
|---|---|---|
| `learning` | `@core/learning` | question/topic loaders, practice, streak, themes, profile/progress |
| `social` | `@core/social` | communities, challenges, Kahoot |
| `shop` | `@core/shop` | cosmetics and theme application |
| `ai` | `@core/ai` | placeholder; production AI/content work belongs to [canonical Phase 4](../../docs/phases/PHASE_4_CONTENT_AI_AND_CONTENT_STUDIO.md) |
| `shared` | `@core/shared` | storage, Telegram SDK, motion, query client and telemetry |

Known cross-domain files such as `src/types/index.ts` and `src/context/PlayerContext.tsx` must not be split mechanically. Follow the active Phase plan and current code evidence.

Legacy roadmap context is preserved in [`docs/archive/legacy-product-rebuild/`](../../docs/archive/legacy-product-rebuild/).