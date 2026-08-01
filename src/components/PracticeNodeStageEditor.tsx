import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '../types';
import { useTelegram } from '../hooks/useTelegram';
import { haptic } from '../lib/telegram';
import { canEditPracticeStageCaps, MAX_STAGE_CAP, MIN_STAGE_CAP } from '../lib/practiceStageSettings';
import { getPracticeStageCount } from '../lib/practiceProgression';
import { usePracticeNodeOverridesStore } from '../stores/practiceNodeOverridesStore';
import type { TopicNode } from '../types';
import styles from './PracticeNodeStageEditor.module.css';

interface PracticeNodeStageEditorProps {
  nodeId: string;
  nodeTitle: string;
  hierarchyRoot?: TopicNode | null;
}

export function PracticeNodeStageEditor({
  nodeId,
  nodeTitle,
  hierarchyRoot,
}: PracticeNodeStageEditorProps) {
  const { userId } = useTelegram();
  const nodeOverrides = usePracticeNodeOverridesStore((s) => s.overrides[nodeId]);
  const setNodeStageCount = usePracticeNodeOverridesStore((s) => s.setNodeStageCount);
  const resetNodeOverrides = usePracticeNodeOverridesStore((s) => s.resetNodeOverrides);
  const hasNodeOverrides = usePracticeNodeOverridesStore((s) => s.hasNodeOverrides(nodeId));

  if (!canEditPracticeStageCaps(userId)) {
    return null;
  }

  void nodeOverrides;

  const handleChange = (difficulty: Difficulty, next: number) => {
    haptic.selection();
    setNodeStageCount(nodeId, difficulty, next);
  };

  const handleReset = () => {
    haptic.impact('light');
    resetNodeOverrides(nodeId);
  };

  return (
    <section className={styles.panel} aria-label={`Налаштування етапів для ${nodeTitle}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>Етапи для «{nodeTitle}»</h3>
        <p className={styles.hint}>Кількість етапів на кожен ранг складності лише для цієї підтеми</p>
      </div>
      <ul className={styles.list}>
        {DIFFICULTIES.map((difficulty) => {
          const value = getPracticeStageCount(nodeId, difficulty, { hierarchyRoot });
          return (
            <li key={difficulty} className={styles.row}>
              <span className={styles.label}>{DIFFICULTY_LABELS[difficulty]}</span>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label={`Менше етапів для ${DIFFICULTY_LABELS[difficulty]}`}
                  disabled={value <= MIN_STAGE_CAP}
                  onClick={() => handleChange(difficulty, value - 1)}
                >
                  −
                </button>
                <span className={styles.value} aria-live="polite">
                  {value}
                </span>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label={`Більше етапів для ${DIFFICULTY_LABELS[difficulty]}`}
                  disabled={value >= MAX_STAGE_CAP}
                  onClick={() => handleChange(difficulty, value + 1)}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {hasNodeOverrides && (
        <button type="button" className={styles.resetBtn} onClick={handleReset}>
          Скинути до стандарту
        </button>
      )}
    </section>
  );
}
