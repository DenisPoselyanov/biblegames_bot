import type { Lesson, LessonBlock, Question, TopicNode } from '../types';
import { getLearningObjectiveId } from './learningObjectives';

const MAX_SCRIPTURE_BLOCKS = 2;

/**
 * Assembles a Lesson from data that already exists — node description and
 * sample question references. No new authoring pipeline; real AI-authored
 * lesson content is Phase 10's job, this only fills the schema/UI contract.
 */
export function buildLessonForNode(
  themeId: string,
  node: TopicNode,
  sampleQuestions: Question[],
): Lesson {
  const blocks: LessonBlock[] = [];

  blocks.push({
    id: `${node.id}-intro`,
    type: 'text',
    content: node.description?.trim()
      ? node.description
      : `Вивчи цю тему, а потім перевір себе в практиці: ${node.title}.`,
  });

  const seenReferences = new Set<string>();
  for (const question of sampleQuestions) {
    if (!question.reference || seenReferences.has(question.reference)) continue;
    seenReferences.add(question.reference);
    blocks.push({
      id: `${node.id}-scripture-${seenReferences.size}`,
      type: 'scripture',
      content: question.text,
      reference: question.reference,
    });
    if (seenReferences.size >= MAX_SCRIPTURE_BLOCKS) break;
  }

  return {
    id: `lesson:${themeId}:${node.id}`,
    learningObjectiveId: getLearningObjectiveId(themeId, node.id),
    themeId,
    nodeId: node.id,
    title: node.title,
    blocks,
  };
}
