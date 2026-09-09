# `bot/` — admin content-generation bot

A small [grammY](https://grammy.dev/) Telegram bot for **AI question generation
only**, restricted to `ADMIN_IDS`. It shells out to
`scripts/generate-questions-ai.mjs` (Ollama) and reports counts.

## Boundary (Phase 2 §16, acceptance #12)

The bot is **not a production surface**. It must not gain:

- progression, wallet, purchase or entitlement logic — those are
  server-authoritative (`/api/v1/*`);
- Mini App launch, deep links or user-facing notifications — when those are
  built they call the backend, they do not re-implement its rules;
- direct writes to the production database;
- a second question mutation pipeline beyond the staging JSON.

`/generate` currently writes to `data/question-db/*.json`. That staging corpus
flows into the canonical repository through the validated importer
(`npm run content:import-legacy`, Phase 2 WS3 §14/§18.3) — it is not a competing
source of truth. Moving authoring onto a reviewed backend API is a **Phase 4
Content Studio** deliverable.

An architecture test (`server/__tests__/architecture.test.ts`) pins that nothing
under `bot/` imports a `server/` runtime module.

## Run

```
BOT_TOKEN=… ADMIN_IDS=123,456 node bot/index.mjs
```
