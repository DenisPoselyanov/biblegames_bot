/**
 * `npm run studio:sandbox` — a local Content Studio API with in-memory stores
 * and no database, for trying the quality-gate screens (golden labelling, AI
 * review queue) without touching production data.
 *
 * - AUTH_MODE=development: the client's dev identity is `guest`, granted `admin` here.
 * - Everything lives in memory and is gone when the process stops.
 *
 * - `--seed-ai`: heuristic AI verdicts over the golden sample (no provider needed).
 *
 * Start the web app separately (`npm run dev`) with VITE_API_BASE_URL=http://localhost:3001.
 */
import { loadConfig } from '../../server/config/env';
import { createApp } from '../../server/app';
import { RoleRegistry } from '../../server/authz/roleRegistry';
import { createMemoryAuditLog } from '../../server/audit';
import { createInMemoryContentRepositories } from '../../server/domains/content/inMemoryRepository';
import { createInMemoryLearningRepositories } from '../../server/domains/learning/inMemoryRepository';
import { createInMemoryQualityRepositories } from '../../server/domains/quality/inMemory';
import { createInMemoryScriptureEvidenceRepository } from '../../server/domains/shared/inMemoryScriptureEvidence';
import { createInMemoryValidationFindingRepository } from '../../server/domains/shared/inMemoryValidationFindings';
import { createMemoryStore } from '../../server/__tests__/helpers/memoryStore';
import { loadGoldenSampleFromDisk } from '../../server/routes/studioAssessments';
import { seedHeuristicAi } from './sandboxSeed';

const PORT = Number(process.env.SANDBOX_PORT ?? 3001);

async function main(): Promise<void> {
  // Never reach a real database from the sandbox, whatever the shell exports.
  delete process.env.DATABASE_URL;
  const { config } = loadConfig({
    ...process.env,
    NODE_ENV: 'development',
    AUTH_MODE: 'development',
    DATABASE_URL: '',
    CLIENT_ORIGINS: process.env.CLIENT_ORIGINS ?? 'http://localhost:5173,http://localhost:5199,http://127.0.0.1:5173',
  });
  const quality = createInMemoryQualityRepositories();
  const sample = loadGoldenSampleFromDisk();
  if (process.argv.includes('--seed-ai') && sample) {
    const n = await seedHeuristicAi(quality.assessments, sample);
    console.log(`Seeded ${n} heuristic AI verdicts over the golden sample.`);
  }

  const app = createApp({
    config,
    dbStore: createMemoryStore(),
    auditLog: createMemoryAuditLog(),
    roleRegistry: new RoleRegistry([{ userId: 'guest', roles: ['admin'] }]),
    quality,
    studioReview: {
      content: createInMemoryContentRepositories(),
      learning: createInMemoryLearningRepositories(),
      findings: createInMemoryValidationFindingRepository(),
      scripture: createInMemoryScriptureEvidenceRepository(),
    },
  });
  app.listen(PORT, () => {
    console.log(`Studio sandbox API on http://localhost:${PORT} (in-memory, user "guest" = admin)`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
