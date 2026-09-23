import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LESSON_BLOCK_PAYLOAD_SCHEMAS } from '../../../../contracts/schemas/lessonBlocks';
import { runLessonQualityChecks } from '../qualityChecks';
import { LESSON_BLOCK_TYPES, type LessonBlockType } from '../types';
import { resolveAssetSrc } from '../../../../src/components/learn/interactiveBlockUtils';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const showcase = JSON.parse(fs.readFileSync(join(ROOT, 'data/lessons/showcase-jonah.json'), 'utf8')) as {
  objectives: Array<{ id: string }>;
  lessons: Array<{
    id: string;
    objectiveId: string;
    title: string;
    blocks: Array<{ blockType: LessonBlockType; payload: Record<string, unknown> }>;
  }>;
};

describe('showcase lessons (data/lessons/showcase-jonah.json)', () => {
  it('together use every lesson block type', () => {
    const used = new Set(showcase.lessons.flatMap((l) => l.blocks.map((b) => b.blockType)));
    expect([...LESSON_BLOCK_TYPES].filter((t) => !used.has(t))).toEqual([]);
  });

  it('every payload matches its block schema', () => {
    for (const lesson of showcase.lessons) {
      for (const [i, block] of lesson.blocks.entries()) {
        const result = LESSON_BLOCK_PAYLOAD_SCHEMAS[block.blockType].safeParse(block.payload);
        expect(result.success, `${lesson.id} block ${i} (${block.blockType})`).toBe(true);
      }
    }
  });

  it('passes the Phase 4 lesson quality checks with no blocking or warning findings', () => {
    for (const lesson of showcase.lessons) {
      const findings = runLessonQualityChecks(
        {
          lessonId: lesson.id,
          objectiveId: lesson.objectiveId,
          title: lesson.title,
          blocks: lesson.blocks.map((b, i) => ({ id: `${lesson.id}-b${i}`, blockType: b.blockType, schemaVersion: 1, payload: b.payload })),
        },
        { knownObjectiveIds: showcase.objectives.map((o) => o.id) },
      );
      expect(findings.filter((f) => f.severity !== 'info'), lesson.id).toEqual([]);
    }
  });

  it('references only assets that exist in public/', () => {
    for (const lesson of showcase.lessons) {
      for (const block of lesson.blocks.filter((b) => b.blockType === 'image')) {
        expect(fs.existsSync(join(ROOT, 'public', String(block.payload.src)))).toBe(true);
      }
    }
  });
});

describe('resolveAssetSrc', () => {
  it('prefixes root-relative assets with the app base path, leaves the rest alone', () => {
    expect(resolveAssetSrc('/lessons/a.svg', '/biblegames_bot/')).toBe('/biblegames_bot/lessons/a.svg');
    expect(resolveAssetSrc('/lessons/a.svg', '/')).toBe('/lessons/a.svg');
    expect(resolveAssetSrc('https://x.test/a.png', '/biblegames_bot/')).toBe('https://x.test/a.png');
    expect(resolveAssetSrc('//cdn.test/a.png', '/biblegames_bot/')).toBe('//cdn.test/a.png');
  });
});
