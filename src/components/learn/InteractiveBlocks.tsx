/**
 * Interactive lesson blocks — the "do something" half of a lesson (true/false,
 * ordering, fill-the-gap, matching, reveal cards, scenarios, character cards,
 * memory verse). Everything is local state: nothing is sent to the server, the
 * lesson session still advances only through "Далі". Every control is a real
 * `<button>` (tap-to-place instead of drag-and-drop) so each block works with
 * a keyboard and a screen reader, and state is never shown by color alone.
 */
import { useMemo, useState } from 'react';
import type { z } from 'zod';
import { Icon } from '../Icon';
import { AnswerFeedback } from '../ui/AnswerFeedback';
import { AnswerOption } from '../ui/AnswerOption';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import {
  FILL_BLANK_MARKER,
  type characterCardPayload,
  type fillBlankPayload,
  type matchPairsPayload,
  type memoryVersePayload,
  type orderEventsPayload,
  type revealPayload,
  type scenarioPayload,
  type trueFalsePayload,
} from './lessonBlockPayloads';
import { hiddenWordIndices, MEMORY_VERSE_ROUNDS, seededPermutation, seededShuffle } from './interactiveBlockUtils';
import styles from './InteractiveBlocks.module.css';

interface BlockProps<S extends z.ZodTypeAny> {
  blockId: string;
  payload: z.infer<S>;
}

function Kicker({ icon, children }: { icon: Parameters<typeof Icon>[0]['name']; children: string }) {
  return (
    <p className={styles.kicker}>
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </p>
  );
}

// ── Правда чи міф ─────────────────────────────────────────────────────────

export function TrueFalseBlock({ payload }: BlockProps<typeof trueFalsePayload>) {
  const [answers, setAnswers] = useState<Record<number, boolean>>({});

  return (
    <div className={styles.block}>
      <Kicker icon="zap">Правда чи міф</Kicker>
      {payload.prompt && <p className={styles.prompt}>{payload.prompt}</p>}
      <ol className={styles.statements}>
        {payload.statements.map((statement, index) => {
          const answer = answers[index];
          const answered = answer !== undefined;
          const correct = answered && answer === statement.isTrue;
          return (
            <li key={index} className={styles.statement}>
              <p className={styles.statementText}>{statement.text}</p>
              <div className={styles.tfButtons} role="group" aria-label="Правда чи міф?">
                {([true, false] as const).map((value) => {
                  const chosen = answered && answer === value;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      className={cx(
                        styles.chip,
                        chosen && (correct ? styles.chipCorrect : styles.chipWrong),
                        answered && !chosen && value === statement.isTrue && styles.chipCorrect,
                      )}
                      disabled={answered}
                      aria-pressed={chosen}
                      onClick={() => setAnswers((prev) => ({ ...prev, [index]: value }))}
                    >
                      {value ? 'Правда' : 'Міф'}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div className={cx(styles.verdict, correct ? styles.verdictCorrect : styles.verdictWrong)} role="status">
                  <Icon name={correct ? 'success' : 'error'} size={16} />
                  <span>
                    <strong>{correct ? 'Так!' : 'Ні.'}</strong> Це {statement.isTrue ? 'правда' : 'міф'}.
                    {statement.explanation && ` ${statement.explanation}`}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Розстав по порядку ────────────────────────────────────────────────────

export function OrderEventsBlock({ blockId, payload }: BlockProps<typeof orderEventsPayload>) {
  const shuffled = useMemo(() => seededPermutation(payload.items.length, blockId), [payload.items.length, blockId]);
  /** Authored indices in the order the reader tapped them. */
  const [placed, setPlaced] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  const pool = shuffled.filter((i) => !placed.includes(i));
  const allPlaced = placed.length === payload.items.length;
  const solved = checked && placed.every((item, position) => item === position);

  return (
    <div className={styles.block}>
      <Kicker icon="trending-up">Розстав по порядку</Kicker>
      <p className={styles.prompt}>{payload.prompt}</p>

      <ol className={styles.orderSlots} aria-label="Твій порядок">
        {payload.items.map((_, position) => {
          const item = placed[position];
          if (item === undefined) {
            return (
              <li key={position} className={styles.orderSlotEmpty}>
                <span className={styles.orderNum}>{position + 1}</span>
              </li>
            );
          }
          const right = checked && item === position;
          const wrong = checked && item !== position;
          return (
            <li key={position}>
              <button
                type="button"
                className={cx(styles.chip, styles.orderChip, right && styles.chipCorrect, wrong && styles.chipWrong)}
                disabled={checked}
                onClick={() => setPlaced((prev) => prev.filter((p) => p !== item))}
                aria-label={checked ? undefined : `${payload.items[item]} — прибрати`}
              >
                <span className={styles.orderNum}>{position + 1}</span>
                <span className={styles.chipLabel}>{payload.items[item]}</span>
                {right && <Icon name="check" size={16} />}
                {wrong && <Icon name="x" size={16} />}
              </button>
            </li>
          );
        })}
      </ol>

      {pool.length > 0 && (
        <div className={styles.pool} aria-label="Події">
          {pool.map((item) => (
            <button
              key={item}
              type="button"
              className={styles.chip}
              onClick={() => setPlaced((prev) => [...prev, item])}
            >
              {payload.items[item]}
            </button>
          ))}
        </div>
      )}

      {allPlaced && !checked && (
        <Button size="sm" onClick={() => setChecked(true)}>
          Перевірити
        </Button>
      )}

      {checked && (
        <>
          <AnswerFeedback
            correct={solved}
            explanation={
              solved
                ? payload.explanation
                : `Правильно так: ${payload.items.map((text, i) => `${i + 1}. ${text}`).join(' · ')}`
            }
          />
          {!solved && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setPlaced([]);
                setChecked(false);
              }}
            >
              Спробувати ще
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ── Допиши вірш ───────────────────────────────────────────────────────────

export function FillBlankBlock({ blockId, payload }: BlockProps<typeof fillBlankPayload>) {
  const options = useMemo(
    () => seededShuffle([payload.answer, ...payload.distractors], blockId),
    [payload.answer, payload.distractors, blockId],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [before, after] = payload.text.split(FILL_BLANK_MARKER);
  const correct = selected === payload.answer;

  return (
    <div className={styles.block}>
      <Kicker icon="book-open">Допиши вірш</Kicker>
      <blockquote className={styles.verse}>
        <p className={styles.verseText}>
          {before}
          <span className={cx(styles.blank, selected && (correct ? styles.blankCorrect : styles.blankWrong))}>
            {selected ?? <span aria-label="пропуск">______</span>}
          </span>
          {after}
        </p>
        <footer className={styles.verseMeta}>
          <cite>{payload.reference}</cite>
          <span className={styles.translation}>{payload.translation}</span>
        </footer>
      </blockquote>
      <div className={styles.options}>
        {options.map((option, index) => {
          let visualState: 'idle' | 'correct' | 'wrong' = 'idle';
          if (selected !== null) {
            if (option === payload.answer) visualState = 'correct';
            else if (option === selected) visualState = 'wrong';
          }
          return (
            <AnswerOption
              key={option}
              index={index}
              visualState={visualState}
              disabled={selected !== null}
              onClick={() => setSelected(option)}
            >
              {option}
            </AnswerOption>
          );
        })}
      </div>
      {selected !== null && <AnswerFeedback correct={correct} explanation={payload.explanation} />}
    </div>
  );
}

// ── Зістав ────────────────────────────────────────────────────────────────

export function MatchPairsBlock({ blockId, payload }: BlockProps<typeof matchPairsPayload>) {
  const rightOrder = useMemo(() => seededPermutation(payload.pairs.length, blockId), [payload.pairs.length, blockId]);
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [wrongRight, setWrongRight] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = matched.size === payload.pairs.length;

  function pickRight(pairIndex: number) {
    if (activeLeft === null) return;
    if (pairIndex === activeLeft) {
      setMatched((prev) => new Set(prev).add(pairIndex));
      setActiveLeft(null);
      setWrongRight(null);
    } else {
      setWrongRight(pairIndex);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className={styles.block}>
      <Kicker icon="target">Зістав</Kicker>
      <p className={styles.prompt}>{payload.prompt}</p>
      {!done && (
        <p className={styles.hint}>{activeLeft === null ? 'Обери пункт ліворуч' : 'Тепер обери пару праворуч'}</p>
      )}
      <div className={styles.matchGrid}>
        <div className={styles.matchColumn}>
          {payload.pairs.map((pair, index) => (
            <button
              key={index}
              type="button"
              className={cx(
                styles.chip,
                styles.matchChip,
                matched.has(index) && styles.chipCorrect,
                activeLeft === index && styles.chipActive,
              )}
              disabled={matched.has(index)}
              aria-pressed={activeLeft === index}
              onClick={() => {
                setActiveLeft(index);
                setWrongRight(null);
              }}
            >
              <span className={styles.chipLabel}>{pair.left}</span>
              {matched.has(index) && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
        <div className={styles.matchColumn}>
          {rightOrder.map((pairIndex) => (
            <button
              key={pairIndex}
              type="button"
              className={cx(
                styles.chip,
                styles.matchChip,
                matched.has(pairIndex) && styles.chipCorrect,
                wrongRight === pairIndex && styles.chipWrong,
              )}
              disabled={matched.has(pairIndex) || activeLeft === null}
              onClick={() => pickRight(pairIndex)}
            >
              <span className={styles.chipLabel}>{payload.pairs[pairIndex].right}</span>
              {matched.has(pairIndex) && <Icon name="check" size={16} />}
              {wrongRight === pairIndex && <Icon name="x" size={16} />}
            </button>
          ))}
        </div>
      </div>
      {done && (
        // Every pair is matched by the end — the block is solved either way,
        // so it always closes on success and just reports the slips.
        <AnswerFeedback
          correct
          explanation={mistakes === 0 ? 'Усі пари зіставлено без жодної помилки.' : `Усі пари зіставлено. Помилок по дорозі: ${mistakes}.`}
        />
      )}
    </div>
  );
}

// ── Чи знав ти? ───────────────────────────────────────────────────────────

export function RevealBlock({ payload }: BlockProps<typeof revealPayload>) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.block}>
      <Kicker icon="sparkles">{payload.kicker ?? 'Чи знав ти?'}</Kicker>
      <button
        type="button"
        className={cx(styles.revealCard, open && styles.revealOpen)}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        disabled={open}
      >
        <span className={styles.revealFront}>{payload.front}</span>
        {!open && (
          <span className={styles.revealHint}>
            Торкнись, щоб відкрити <Icon name="chevron-down" size={14} />
          </span>
        )}
      </button>
      {open && (
        <p className={styles.revealBack} role="status">
          {payload.back}
        </p>
      )}
    </div>
  );
}

// ── Що б ти зробив? ───────────────────────────────────────────────────────

export function ScenarioBlock({ payload }: BlockProps<typeof scenarioPayload>) {
  const [chosen, setChosen] = useState<number | null>(null);
  const choice = chosen !== null ? payload.choices[chosen] : null;
  return (
    <div className={styles.block}>
      <Kicker icon="users">Що б ти зробив?</Kicker>
      <p className={styles.situation}>{payload.situation}</p>
      <div className={styles.options}>
        {payload.choices.map((c, index) => (
          <AnswerOption
            key={index}
            index={index}
            visualState={chosen === index ? 'selected' : 'idle'}
            onClick={() => setChosen(index)}
          >
            {c.text}
          </AnswerOption>
        ))}
      </div>
      {choice && (
        <div className={styles.response} role="status" key={chosen}>
          <p className={styles.responseText}>{choice.response}</p>
          {choice.reference && <p className={styles.responseRef}>{choice.reference}</p>}
          <p className={styles.hint}>Можеш обрати інший варіант, щоб побачити й інший погляд.</p>
        </div>
      )}
    </div>
  );
}

// ── Персонаж ──────────────────────────────────────────────────────────────

export function CharacterCardBlock({ payload }: BlockProps<typeof characterCardPayload>) {
  return (
    <section className={styles.character} aria-label={`Персонаж: ${payload.name}`}>
      <div className={styles.characterHead}>
        <span className={styles.avatar} aria-hidden="true">
          {payload.name.trim().charAt(0).toLocaleUpperCase('uk')}
        </span>
        <div>
          <p className={styles.characterName}>{payload.name}</p>
          <p className={styles.characterRole}>{payload.role}</p>
        </div>
      </div>
      <ul className={styles.facts}>
        {payload.facts.map((fact) => (
          <li key={fact}>
            <Icon name="star" size={14} />
            <span>{fact}</span>
          </li>
        ))}
      </ul>
      {(payload.quote || payload.reference) && (
        <blockquote className={styles.characterQuote}>
          {payload.quote && <p>«{payload.quote}»</p>}
          {payload.reference && <cite>{payload.reference}</cite>}
        </blockquote>
      )}
    </section>
  );
}

// ── Вивчи напам'ять ───────────────────────────────────────────────────────

export function MemoryVerseBlock({ blockId, payload }: BlockProps<typeof memoryVersePayload>) {
  const words = useMemo(() => payload.text.split(/\s+/).filter(Boolean), [payload.text]);
  const [round, setRound] = useState(0);
  const [peeked, setPeeked] = useState<Set<number>>(() => new Set());
  const hidden = useMemo(() => hiddenWordIndices(words, round, blockId), [words, round, blockId]);
  const lastRound = round === MEMORY_VERSE_ROUNDS - 1;

  function goTo(next: number) {
    setRound(next);
    setPeeked(new Set());
  }

  return (
    <div className={styles.block}>
      <Kicker icon="brain">Вивчи напам'ять</Kicker>
      <blockquote className={styles.verse}>
        <p className={styles.verseText} aria-live="polite">
          {words.map((word, index) => {
            const isHidden = hidden.has(index) && !peeked.has(index);
            return (
              <span key={index}>
                {isHidden ? (
                  <button
                    type="button"
                    className={styles.hiddenWord}
                    style={{ minWidth: `${Math.max(word.length, 2)}ch` }}
                    aria-label="Приховане слово — показати"
                    onClick={() => setPeeked((prev) => new Set(prev).add(index))}
                  />
                ) : (
                  word
                )}{' '}
              </span>
            );
          })}
        </p>
        <footer className={styles.verseMeta}>
          <cite>{payload.reference}</cite>
          <span className={styles.translation}>{payload.translation}</span>
        </footer>
      </blockquote>
      <p className={styles.hint}>
        {round === 0
          ? 'Прочитай вірш уголос, потім ховай слова крок за кроком.'
          : 'Промовляй вірш, підставляючи сховані слова. Торкнись слова, щоб підглянути.'}
      </p>
      <div className={styles.memoryControls}>
        <span className={styles.roundLabel}>
          Крок {round + 1}/{MEMORY_VERSE_ROUNDS}
        </span>
        {lastRound ? (
          <Button size="sm" variant="secondary" onClick={() => goTo(0)}>
            <Icon name="rotate-ccw" size={16} /> Спочатку
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => goTo(round + 1)}>
            Сховати більше
          </Button>
        )}
      </div>
    </div>
  );
}
