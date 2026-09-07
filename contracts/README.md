# `contracts/` — canonical runtime contracts (Phase 2 §7, §8)

One source of truth for every process/network boundary in Bible Games: HTTP request/
response bodies, Socket.IO event envelopes, shared enums and the error envelope.

## Rules (ADR-013)

- **Runtime-first.** Every contract is a [Zod](https://zod.dev) schema. TypeScript types
  are `z.infer<>` of that schema — never hand-written in parallel.
- **Client-safe only.** This folder must not import from `server/`, `src/`, `node:*`,
  Express, Socket.IO, a database driver, or any infrastructure. It is compiled into both
  the frontend bundle and the server. The architecture test enforces this.
- **Versioned.** `CONTRACT_VERSION` in [`version.ts`](./version.ts) is bumped only on a
  breaking change to a shipped contract. Additive optional fields do not bump it.
- **No coercion of critical values.** Invalid enums / ids are rejected, not silently
  defaulted. `.default()` is allowed only where the missing value is semantically safe.

## Layout

| Path | Holds |
|---|---|
| `version.ts` | `CONTRACT_VERSION` + `CONTRACT_VERSION_HEADER` |
| `enums/` | shared closed vocabularies (difficulty, completion kinds, cosmetic kinds, roles) |
| `schemas/` | reusable building blocks — `primitives`, `error` envelope, snapshots |
| `api/` | per-surface request + response schemas for `/api/v1/*` |
| `events/` | Socket.IO client→server / server→client event envelopes |
| `index.ts` | barrel re-export |

## Consumers

- **server** — `server/tsconfig.json` includes `../contracts/**/*`; routes validate
  `req.body` with `<surface>.<op>.request` and responses in tests with `.response`.
- **frontend** — import via the `@contracts/*` path alias (`tsconfig.app.json`).
