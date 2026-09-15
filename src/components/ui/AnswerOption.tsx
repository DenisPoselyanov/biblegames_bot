import type { ReactNode } from 'react';
import { AnswerOptionButton, type AnswerOptionVisualState } from '../motion/AnswerOptionButton';
import { Icon } from '../Icon';
import { cx } from './cx';
import styles from './AnswerOption.module.css';

export type { AnswerOptionVisualState };

interface AnswerOptionProps {
  children: ReactNode;
  visualState: AnswerOptionVisualState;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Practice/quiz answer tile (DESIGN_RULES §14, §18). State is never
 * color-only — correct/wrong also change border, background and an icon
 * (§18.3/§18.4). Motion (the brief shake/pop) is delegated to the existing
 * `AnswerOptionButton` primitive — this component only adds the
 * semantic-token visual states on top of it.
 */
export function AnswerOption({ children, visualState, disabled, onClick, className }: AnswerOptionProps) {
  return (
    <AnswerOptionButton
      visualState={visualState}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        styles.option,
        visualState === 'selected' && styles['option--selected'],
        visualState === 'correct' && styles['option--correct'],
        visualState === 'wrong' && styles['option--wrong'],
        visualState === 'hidden' && styles['option--hidden'],
        className,
      )}
    >
      <span className={styles.label}>{children}</span>
      {visualState === 'correct' && (
        <span className={cx(styles.stateIcon, styles['stateIcon--correct'])} aria-hidden="true">
          <Icon name="check" size={20} />
        </span>
      )}
      {visualState === 'wrong' && (
        <span className={cx(styles.stateIcon, styles['stateIcon--wrong'])} aria-hidden="true">
          <Icon name="x" size={20} />
        </span>
      )}
    </AnswerOptionButton>
  );
}
