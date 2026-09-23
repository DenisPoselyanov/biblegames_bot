import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { auditLegacyBank, type LegacyAuditContext } from '../legacyAudit';
import type { RawQuestionInput } from '../validation';

interface GoldenCase {
  name: string;
  raw: RawQuestionInput;
  expect: {
    classification: string;
    wave?: number;
    findings?: string[];
    findingsInclude?: string[];
    duplicateOf?: string;
  };
}

const golden = JSON.parse(
  fs.readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'golden/legacy-questions.golden.json'), 'utf8'),
) as { context: LegacyAuditContext; cases: GoldenCase[] };

/** Only the kinds that drive a decision — info-level and length heuristics are noise for a golden pin. */
const DECISIVE = (k: string) => k !== 'missing_deep_explanation' && k !== 'option_length_imbalance';

describe('legacy bank audit — golden dataset (Phase 4 WS10, spec §12, §19)', () => {
  const report = auditLegacyBank(
    golden.cases.map((c) => ({ raw: c.raw, source: 'golden' })),
    golden.context,
  );
  const byId = new Map(report.items.map((i) => [i.id, i]));

  for (const c of golden.cases) {
    it(c.name, () => {
      const item = byId.get(c.raw.id)!;
      expect(item.classification).toBe(c.expect.classification);
      if (c.expect.wave !== undefined) expect(item.wave).toBe(c.expect.wave);
      if (c.expect.findings) expect(item.findings.filter(DECISIVE).sort()).toEqual([...c.expect.findings].sort());
      if (c.expect.findingsInclude) expect(item.findings).toEqual(expect.arrayContaining(c.expect.findingsInclude));
      if (c.expect.duplicateOf) expect(item.duplicateOf).toBe(c.expect.duplicateOf);
    });
  }

  it('never classifies anything as publishable — that needs evidence and a human', () => {
    expect(report.byClassification.publishable_after_evidence).toBe(0);
  });

  it('inventory adds up', () => {
    expect(report.total).toBe(golden.cases.length);
    expect(Object.values(report.byClassification).reduce((a, b) => a + b, 0)).toBe(report.total);
    expect(report.reference.present + report.reference.missing).toBe(report.total);
    expect(Object.values(report.byWave).reduce((a, w) => a + w.total, 0)).toBe(report.total);
    expect(report.duplicates).toEqual({ groups: 1, items: 2 });
    // every valid item's key sat at position 0 in this dataset
    expect(report.firstAnswerDistribution[0]).toBe(golden.cases.length - 1);
    // wave 6 (archive) never has importable items
    expect(report.byWave['6'].importable).toBe(0);
  });
});
