# Content tooling map (Phase 4 WS10)

> Spec §9 / DoD §23.15: every active content/AI script mapped to the reviewed lifecycle. Source of truth: [`scripts/ai/deprecation-matrix.json`](../scripts/ai/deprecation-matrix.json) — this page, `npm run ai -- scripts` and the runtime warning (`scripts/lib/deprecation.mjs`) all read it. Change the JSON, then regenerate this table.

## The lifecycle every write must follow

```text
legacy file / AI call ──► artifact or draft revision ──► WS3/WS4 checks ──► human review (Studio) ──► publish (Studio, content:publish) ──► rollback (Studio, content:rollback)
```

- Nothing outside Content Studio publishes. The CLI and legacy scripts stop at artifact / `legacy_unreviewed` / draft.
- `npm run ai -- <task>` is the single entry point; dry-run by default, `--apply` to write, `--json` for machine-readable output.
- AI tasks share the Studio's job runner (`content.ai_generate` / `content.ai_repair`) — same provider, budget and audit.

## `npm run ai` tasks

| Task | Writes? | What it does |
|---|---|---|
| `help` | — | lists tasks |
| `scripts` | — | prints the deprecation matrix |
| `audit-legacy` | report only | §12.1–§12.3 inventory, classification and waves → `reports/content/legacy-audit.json`; summary in [LEGACY_CONTENT_AUDIT.md](./LEGACY_CONTENT_AUDIT.md) |
| `validate-content` | — | canonical WS2/WS3 findings per question (`--theme`, `--class`, `--limit`) |
| `validate-revisions` | `--apply`: `content_validation_findings` | re-runs the quality checks over every stored question revision and records them with a run marker. The publish gate refuses a question with no run for the current checker version, so run this after any check changes (bump `QUESTION_CHECKS_VERSION`) |
| `migrate-wave --wave N` | `--apply`: `question_revisions` (`legacy_unreviewed`) | imports one wave, writes before/after report; `--rollback <report> --apply` quarantines what that wave created |
| `import-legacy` | `--apply`: `question_revisions` | waves 1–5 at once (the Phase 2 importer) |
| `generate-questions --prompt …` | `--apply`: AI artifact | one `content.ai_generate` job |
| `repair-question --id Q --note …` | `--apply`: AI artifact | one `content.ai_repair` job built from a legacy question |

## Legacy scripts

Compatibility period: **Phase 5 start**. Removal target: **Phase 5 WS1 (after migration waves 1–5 are applied)**. Owner: **Denis Poselyanov**. Golden dataset for comparing old vs new behaviour: [`server/domains/content/__tests__/golden/legacy-questions.golden.json`](../server/domains/content/__tests__/golden/legacy-questions.golden.json) (run by `server/domains/content/__tests__/legacyAudit.test.ts`).

Statuses: `deprecated` — has a lifecycle replacement, prints a warning, still works until removal; `no-replacement-yet` — warns, stays until its replacement exists; `read-only` — allowed to stay separate (§9).

| npm script | File | Status | Writes | Replacement |
|---|---|---|---|---|
| `generate-ai` | `scripts/generate-questions-ai.mjs` | deprecated | data/question-db/*.json directly | npm run ai -- generate-questions (artifact → draft → Studio review) |
| `fix-questions-ai` | `scripts/fix-questions-ai.mjs` | deprecated | data/question-db/*.json in place | npm run ai -- repair-question / Studio «Виправити через AI» (content.ai_repair) |
| `fix-explanations-ai` | `scripts/fix-explanations-ai.mjs` | deprecated | data/question-db/*.json in place | npm run ai -- repair-question --note "пояснення" |
| `generate-kahoot-playlist` | `scripts/generate-kahoot-playlist.mjs` | deprecated | wraps generate-questions-ai.mjs | npm run ai -- generate-questions --label kahoot:<topic> |
| `balance-questions` | `scripts/balance-questions.mjs` | deprecated | rewrites difficulty in data/question-db | npm run ai -- audit-legacy (report) → Studio review |
| `questions:dedupe-db` | `scripts/dedupe-question-db.mjs` | deprecated | removes rows from data/question-db | npm run ai -- audit-legacy (duplicate_superseded → wave 6 archive, never imported) |
| `prune-untagged` | `scripts/prune-untagged-questions.mjs` | deprecated | deletes rows from data/question-db | npm run ai -- audit-legacy (classification) — nothing is deleted, only archived |
| `fill-practice` | `scripts/fill-practice-pools.mjs` | deprecated | appends AI questions to data/question-db | npm run ai -- generate-questions (per pool) → Studio review |
| `fill-practice-nodes` | `scripts/fill-practice-nodes.mjs` | deprecated | appends AI questions to data/question-db | npm run ai -- generate-questions (per node) → Studio review |
| `questions:import-supabase` | `scripts/import-questions-supabase.ts` | deprecated | legacy `questions` table | npm run ai -- migrate-wave --wave N --apply (canonical question_revisions, legacy_unreviewed) |
| `content:import-legacy` | `scripts/content/import-legacy-questions.ts` | deprecated | question_revisions (legacy_unreviewed), whole bank at once | npm run ai -- import-legacy (same importer) or wave by wave via migrate-wave |
| `import-kahoot-tsv` | `scripts/import-kahoot-tsv.mjs` | no-replacement-yet | data/question-db | Studio import workspace (not built) — until then import into files, then migrate-wave |
| `import-kahoot-url` | `scripts/import-kahoot-url.mjs` | no-replacement-yet | data/question-db | Studio import workspace (not built) — until then import into files, then migrate-wave |
| `sort-questions` | `scripts/sortQuestionsByCategory.ts` | deprecated | rewrites category/topic tags in data files | npm run ai -- audit-legacy + Studio library (theme coverage) |
| `assign-practice-stages` | `scripts/assign-practice-stages.mjs` | no-replacement-yet | data/practice-stage-config.json (practice structure, not questions) | stays until practice structure moves into learning plans |
| `import-practice-stages-list` | `scripts/import-practice-stages-list.mjs` | no-replacement-yet | data/practice-stage-config.json | stays until practice structure moves into learning plans |
| `generate-topics-ai` | `scripts/generate-topics-ai.mjs` | no-replacement-yet | data/topics-db (topic tree) | topic tree authoring is out of the Phase 4 revision model — learning plans are mapped by migrate:map-learning-content |
| `sort-topics-ai` | `scripts/sort-topics-ai.mjs` | no-replacement-yet | data/topics-db | as generate-topics-ai |
| `ai-topic-edit` | `scripts/ai-topic-edit.mjs` | no-replacement-yet | data/topics-db | as generate-topics-ai |
| `topic-conveyor` | `scripts/topic-conveyor.mjs` | no-replacement-yet | data/topics-db + question pools | as generate-topics-ai; its question-writing half → npm run ai -- generate-questions |
| `ai-launcher` | `scripts/run-launcher.mjs` | deprecated | drives the legacy write scripts (Python GUI) | npm run ai -- <task> / Content Studio |
| `questions:stats` | `scripts/analyze-questions.mjs` | read-only | — | npm run ai -- audit-legacy (canonical inventory) |
| `analyze-quality` | `scripts/analyzeQuestionQuality.ts` | read-only | — | npm run ai -- validate-content (canonical WS3 checks) |
| `analyze-pools` | `scripts/analyzeQuestionPools.ts` | read-only | — | Studio library coverage / npm run ai -- audit-legacy |
| `analyze-explanations` | `scripts/analyze-explanations.mjs` | read-only | — | npm run ai -- validate-content |
| `analyze-topics` | `scripts/analyze-topics.mjs` | read-only | — | — |
| `scripture:audit` | `scripts/scripture-audit.mjs` | read-only | — | WS4 Scripture evidence in Studio review |
| `smoke-audit` | `scripts/smoke-audit.mjs` | read-only | — | — |
| `test-kahoot` | `scripts/test-kahoot.mjs` | read-only | — | — |
| `test-classification` | `scripts/testQuestionClassification.ts` | read-only | — | — |
| `—` | `scripts/export-all-questions.mjs` | read-only | — | — |
| `topic-preview-index` | `scripts/topic-preview-index.mjs` | read-only | — | — |

Silence the warning in automation with `BIBLEGAMES_SILENCE_DEPRECATION=1`.
