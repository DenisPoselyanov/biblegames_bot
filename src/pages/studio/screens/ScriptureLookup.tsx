import { useState, type FormEvent } from 'react';
import {
  BOLLS_TRANSLATIONS,
  BOLLS_TRANSLATION_LABELS,
  DEFAULT_BOLLS_TRANSLATION,
  type BollsTranslation,
} from '../../../lib/bollsConstants';
import { useScripture } from '../../../hooks/useScripture';
import { scriptureAvailable } from '../../../repos/scriptureRepo';
import { Button, Disclosure, Field, Input, Note, Select } from '../ui/kit';

/**
 * Ad-hoc Scripture reference check (Phase 4 WS8d) — the Studio home of the
 * legacy `/admin` «Перевірка посилання (bolls.life)» box. Same bolls adapter
 * the revision checks use, but nothing here is stored as evidence: evidence is
 * recorded per revision by the validation pass (WS4), not by typing a
 * reference into a lookup box.
 */
export function ScriptureLookup() {
  const [draft, setDraft] = useState('Лк. 15:11-32');
  const [translation, setTranslation] = useState<BollsTranslation>(DEFAULT_BOLLS_TRANSLATION);
  const [query, setQuery] = useState<{ reference: string; translation: BollsTranslation } | null>(null);
  const { state, passage } = useScripture(query?.reference, query?.translation ?? translation);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setQuery({ reference: draft.trim(), translation });
  };

  return (
    <Disclosure label="Перевірити посилання вручну" hint="bolls.life · нічого не зберігає" className="mb-3">
      <form onSubmit={submit} className="flex items-end gap-3 px-4 py-3">
        <Field label="Посилання" className="flex-1">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Лк. 15:11-32" />
        </Field>
        <Field label="Переклад" className="w-[240px]">
          <Select
            value={translation}
            onChange={(e) => setTranslation(e.target.value as BollsTranslation)}
            options={BOLLS_TRANSLATIONS.map((id) => ({
              value: id,
              label: `${id} — ${BOLLS_TRANSLATION_LABELS[id]}`,
            }))}
          />
        </Field>
        <Button type="submit" variant="primary" size="md" disabled={!draft.trim()}>
          Показати текст
        </Button>
      </form>

      <div className="border-t border-line px-4 py-3">
        {!scriptureAvailable() ? (
          <Note>Текст Писання доступний лише з підключеним сервером (VITE_API_BASE_URL).</Note>
        ) : !query ? (
          <p className="text-[12.5px] text-faint">Введіть посилання й натисніть «Показати текст».</p>
        ) : state === 'loading' ? (
          <p className="text-[12.5px] text-faint">Завантаження тексту…</p>
        ) : state === 'error' ? (
          <Note tone="danger">
            {passage?.parseError === 'unparsed_reference'
              ? 'Не вдалося розпізнати посилання.'
              : 'Текст тимчасово недоступний — bolls.life не відповів.'}
          </Note>
        ) : passage ? (
          <>
            <p className="mb-2 text-[12px] text-faint">
              {passage.translationLabel}
              {passage.readerUrl && (
                <>
                  {' · '}
                  <a
                    href={passage.readerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo underline underline-offset-2"
                  >
                    відкрити на bolls.life
                  </a>
                </>
              )}
            </p>
            <ol className="grid gap-1 text-[13.5px] leading-relaxed">
              {passage.verses.map((v) => (
                <li key={v.verse} className="flex gap-2">
                  <span className="studio-num w-6 shrink-0 text-right text-[12px] text-faint">{v.verse}</span>
                  <span>{v.text}</span>
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </Disclosure>
  );
}
