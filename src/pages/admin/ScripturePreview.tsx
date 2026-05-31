import { useState } from 'react';
import { DEFAULT_BOLLS_TRANSLATION, BOLLS_TRANSLATIONS, BOLLS_TRANSLATION_LABELS, type BollsTranslation } from '../../lib/bollsConstants';
import { ScripturePanel } from '../../components/ScripturePanel';
import styles from '../AdminPanel.module.css';

export function ScripturePreview() {
  const [reference, setReference] = useState('Лк. 15:11-32');
  const [translation, setTranslation] = useState<BollsTranslation>(DEFAULT_BOLLS_TRANSLATION);
  const [previewKey, setPreviewKey] = useState(0);

  return (
    <section className={styles.scripturePreview}>
      <h2 className={styles.sectionTitle}>📖 Перевірка посилання (bolls.life)</h2>
      <div className={styles.scripturePreviewForm}>
        <label>
          Посилання
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Лк. 15:11-32"
            className={styles.scriptureInput}
          />
        </label>
        <label>
          Переклад
          <select
            value={translation}
            onChange={(e) => setTranslation(e.target.value as BollsTranslation)}
            className={styles.scriptureSelect}
          >
            {BOLLS_TRANSLATIONS.map((id) => (
              <option key={id} value={id}>
                {id} — {BOLLS_TRANSLATION_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.miniBtn} onClick={() => setPreviewKey((k) => k + 1)}>
          Завантажити
        </button>
      </div>
      <ScripturePanel key={previewKey} reference={reference} translation={translation} />
    </section>
  );
}
