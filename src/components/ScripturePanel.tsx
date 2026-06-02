import type { BollsTranslation } from '../lib/bollsConstants';
import { useScripture } from '../hooks/useScripture';
import { scriptureAvailable } from '../repos/scriptureRepo';
import { openExternalLink } from '../lib/telegram';
import styles from './ScripturePanel.module.css';

interface ScripturePanelProps {
  reference?: string;
  translation: BollsTranslation;
  compact?: boolean;
  /** Показувати блок одразу (наприклад у модалці) */
  autoLoad?: boolean;
  /** Кнопка «Читати на bolls.life» (вимкнено в швидких ігрових режимах) */
  showReaderLink?: boolean;
}

export function ScripturePanel({
  reference,
  translation,
  compact = false,
  autoLoad = true,
  showReaderLink = true,
}: ScripturePanelProps) {
  const ref = autoLoad ? reference : undefined;
  const { state, passage } = useScripture(ref, translation);

  if (!reference?.trim()) return null;

  const rootClass = compact ? `${styles.panel} ${styles.compact}` : styles.panel;

  if (!scriptureAvailable()) {
    return (
      <div className={rootClass}>
        <p className={styles.muted}>Текст Писання доступний, коли підключено сервер (VITE_API_BASE_URL).</p>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className={styles.header}>
        <span className={styles.kicker}>Уривок з Писання</span>
        {passage?.translationLabel && (
          <span className={styles.translation}>{passage.translationLabel}</span>
        )}
      </div>

      {state === 'loading' && <p className={styles.loading}>Завантаження тексту…</p>}

      {state === 'error' && (
        <p className={styles.muted}>
          {passage?.parseError === 'unparsed_reference'
            ? 'Не вдалося розпізнати посилання.'
            : showReaderLink
              ? 'Текст тимчасово недоступний. Спробуй пізніше або відкрий на bolls.life.'
              : 'Текст тимчасово недоступний. Спробуй пізніше.'}
        </p>
      )}

      {state === 'ready' && passage && passage.verses.length > 0 && (
        <ul className={styles.verseList}>
          {passage.verses.map((v) => (
            <li key={v.verse} className={styles.verseItem}>
              <span className={styles.verseNum}>{v.verse}</span>
              <span>{v.text}</span>
            </li>
          ))}
        </ul>
      )}

      {showReaderLink && passage?.readerUrl && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => openExternalLink(passage.readerUrl)}
          >
            Читати на bolls.life
          </button>
        </div>
      )}
    </div>
  );
}
