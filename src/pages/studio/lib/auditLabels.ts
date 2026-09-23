/**
 * Plain-language names for audit actions (Phase 4 WS8c). Shared by the review
 * editor's history and the releases journal so the same event reads the same
 * everywhere; an unknown action falls back to its raw dotted name.
 */
export const ACTION_LABEL: Record<string, string> = {
  'content.review_decision': 'Рішення',
  'content.publish': 'Опубліковано',
  'content.publish_denied': 'Публікацію відхилено',
  'content.rollback': 'Відкат',
  'content.generate': 'AI-генерація',
  'content.job_create': 'Запуск AI',
  'content.job_cancel': 'Зупинка AI',
  'authz.denied': 'Відмова в доступі',
};

export const actionLabel = (action: string): string => ACTION_LABEL[action] ?? action;

/** Actions that changed what players see get a stronger badge than routine ones. */
export function actionTone(action: string, result: string): 'gold' | 'danger' | 'success' | 'neutral' {
  if (result !== 'ok' || action === 'authz.denied' || action.endsWith('_denied')) return 'danger';
  if (action === 'content.publish' || action === 'content.rollback') return 'gold';
  if (action === 'content.review_decision') return 'success';
  return 'neutral';
}
