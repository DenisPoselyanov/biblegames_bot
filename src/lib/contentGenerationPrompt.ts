/**
 * Question-generation prompt template (content quality gate). New AI questions
 * must meet the same level rubric the reviewer checks — including level-
 * appropriate explanations — so the rubric is written into the prompt instead
 * of left to whoever types it. Used by `npm run ai -- generate-questions
 * --theme … --level …` and the Studio "Нова задача" template button.
 */
import type { Difficulty } from '../types';
import { COMMON_QUESTION_RULES, describeLevelForPrompt } from './contentLevelRubric';

export const GENERATION_PROMPT_VERSION = 'question.generate.v2';

export interface GenerationPromptInput {
  themeTitle: string;
  level: Difficulty;
  count: number;
  /** Optional narrower focus: a topic, book or story. */
  focus?: string;
}

export function buildQuestionGenerationPrompt(input: GenerationPromptInput): string {
  const count = Math.max(1, Math.min(50, Math.floor(input.count)));
  return [
    'Ти автор біблійної вікторини українською мовою (переклад Огієнка).',
    `Склади ${count} нових питань на тему «${input.themeTitle}»${input.focus ? `, зосередься на: ${input.focus}` : ''}.`,
    '',
    describeLevelForPrompt(input.level),
    '',
    'Правила:',
    ...COMMON_QUESTION_RULES.map((r) => `- ${r}`),
    '- Чотири варіанти відповіді схожої довжини; правильна відповідь у випадковій позиції.',
    '- Не повторюй відомі формулювання; кожне питання перевіряє інший факт.',
    '',
    'Відповідь лише JSON-масив: [{"text": string, "options": string[4], "correctIndex": number, "explanationShort": string, "explanationDeep": string, "reference": string}]',
  ].join('\n');
}
