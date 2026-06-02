import type { Question } from '../types';

function adminApiBase(): string {
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (env) return env.replace(/\/$/, '');
  if (import.meta.env.DEV) return '';
  return 'http://localhost:3001';
}

function adminUrl(path: string): string {
  return `${adminApiBase()}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function updateQuestionOnServer(question: Question): Promise<Question> {
  const res = await fetch(adminUrl(`/api/admin/questions/${encodeURIComponent(question.id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  const body = (await res.json()) as { question: Question };
  return body.question;
}

export async function deleteQuestionOnServer(questionId: string): Promise<void> {
  const res = await fetch(adminUrl(`/api/admin/questions/${encodeURIComponent(questionId)}`), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
}

export function isQuestionAdminAvailable(): boolean {
  return import.meta.env.DEV || Boolean(import.meta.env.VITE_API_BASE_URL);
}
