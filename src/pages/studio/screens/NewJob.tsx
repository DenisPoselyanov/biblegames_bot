import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useCreateJobMutation } from '../lib/queries';
import { useCan } from '../lib/useStudio';
import { Button, Field, Input, Note, Page, Panel, Term, Textarea } from '../ui/kit';

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
