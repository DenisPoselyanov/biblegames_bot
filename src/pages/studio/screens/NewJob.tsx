import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Wand2 } from 'lucide-react';
import { THEMES } from '../../../data/themes';
import { buildQuestionGenerationPrompt, GENERATION_PROMPT_VERSION } from '../../../lib/contentGenerationPrompt';
import { LEVEL_RUBRIC } from '../../../lib/contentLevelRubric';
import type { Difficulty } from '../../../types';
import { useCreateJobMutation } from '../lib/queries';
import { useCan } from '../lib/useStudio';
import { Button, Field, Input, Note, Page, Panel, Select, Term, Textarea } from '../ui/kit';

/**
 * One AI generation call (`content.ai_generate`, Phase 4 WS1) → a raw artifact
 * in object storage — never a draft/revision. Turning that artifact into
 * reviewable content is WS8b's Review screen's job, once it exists.
 */
export function NewJob() {
  const navigate = useNavigate();
  const can = useCan();
  const [promptVersion, setPromptVersion] = useState('question.generate.v1');
  const [prompt, setPrompt] = useState('');
  const [label, setLabel] = useState('');
  const [themeId, setThemeId] = useState(THEMES[0]?.id ?? '');
  const [level, setLevel] = useState<Difficulty>('youth');
  const [count, setCount] = useState('10');

  // Fills the prompt from the level rubric, so generated questions and both
  // explanations are written for their level (content quality gate).
  const applyTemplate = () => {
    const theme = THEMES.find((t) => t.id === themeId);
    if (!theme) return;
    setPrompt(buildQuestionGenerationPrompt({ themeTitle: theme.title, level, count: Number(count) || 10 }));
    setPromptVersion(GENERATION_PROMPT_VERSION);
    setLabel(`generate:${theme.id}:${level}`);
  };
  const mutation = useCreateJobMutation();

  const denied = can('content:ai:run') ? null : 'Потрібне право запускати AI';

  return (
    <Page title="Новий запуск" subtitle="Один виклик AI, зафіксований у джобі з бюджетом і журналом.">
      <Panel>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(
              { promptVersion, prompt, label: label.trim() || undefined },
              { onSuccess: ({ id }) => navigate(`../${id}`) },
            );
          }}
        >
          {/* Narrow: the template button drops to its own row instead of
              squeezing the topic picker. */}
          <div className="grid grid-cols-[1fr_150px_80px] items-end gap-2 @min-[900px]:grid-cols-[1fr_180px_90px_auto]">
            <Field label="Тема">
              <Select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                options={THEMES.map((t) => ({ value: t.id, label: t.title }))}
              />
            </Field>
            <Field label="Рівень">
              <Select
                value={level}
                onChange={(e) => setLevel(e.target.value as Difficulty)}
                options={LEVEL_RUBRIC.map((r) => ({ value: r.level, label: r.label }))}
              />
            </Field>
            <Field label="Скільки">
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} />
            </Field>
            <Button
              variant="ghost"
              size="md"
              onClick={applyTemplate}
              className="justify-self-start @max-[899px]:col-span-3"
            >
              <Wand2 size={14} />
              Шаблон за рубрикою
            </Button>
          </div>
          <Field label={<Term k="job" iconOnly>Версія промпту</Term>} hint="напр. question.generate.v1">
            <Input
              value={promptVersion}
              onChange={(e) => setPromptVersion(e.target.value)}
              required
            />
          </Field>
          <Field label="Промпт">
            <Textarea
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опиши, що саме згенерувати…"
              required
            />
          </Field>
          <Field label="Мітка" hint="Довільний ярлик для списку джобів — не інтерпретується джобом">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>

          {mutation.isError && (
            <Note tone="danger">Не вдалося запустити: {(mutation.error as Error).message}</Note>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              denied={denied}
              disabled={mutation.isPending || !prompt.trim() || !promptVersion.trim()}
            >
              <Play size={14} />
              Запустити
            </Button>
            <Button variant="quiet" type="button" onClick={() => navigate('..')}>
              Скасувати
            </Button>
          </div>
        </form>
      </Panel>
    </Page>
  );
}
