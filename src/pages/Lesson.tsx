import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { findNodeById, loadTopicHierarchy } from '../data/topicDbLoader';
import { fetchQuestionsForSession } from '../repos/questionsRepo';
import { buildLessonForNode } from '../lib/lessonContent';
import { getStageQuizPath } from '../lib/practiceProgression';
import type { Lesson as LessonData, TopicNode } from '../types';
import { Icon } from '../components/Icon';
import styles from './Lesson.module.css';

export function Lesson() {
  const { themeId, nodeId } = useParams<{ themeId: string; nodeId: string }>();
  const navigate = useNavigate();
  const [node, setNode] = useState<TopicNode | null>(null);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!themeId || !nodeId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const hierarchy = await loadTopicHierarchy(themeId);
      if (cancelled) return;

      const foundNode = hierarchy ? findNodeById(hierarchy, nodeId) : null;
      if (!foundNode) {
        setLoading(false);
        return;
      }
      setNode(foundNode);

      const sampleQuestions = await fetchQuestionsForSession({
        themeId,
        topicNodeId: nodeId,
        difficulty: foundNode.difficulty ?? 'baby',
        count: 3,
        seed: nodeId,
      });
      if (cancelled) return;

      setLesson(buildLessonForNode(themeId, foundNode, sampleQuestions));
      setLoading(false);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [themeId, nodeId]);

  if (loading) {
    return <section className={styles.page} />;
  }

  if (!node || !lesson || !themeId || !nodeId) {
    return (
      <section className={styles.page}>
        <p>Тему не знайдено.</p>
        <Link to="/play/study/themes">← Назад до тем</Link>
      </section>
    );
  }

  const practicePath = getStageQuizPath(themeId, node.difficulty ?? 'baby', 0, nodeId);

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <button
          type="button"
          className={styles.backBtn}
          aria-label="Назад"
          onClick={() => navigate(`/play/study/themes/${themeId}`)}
        >
          <Icon name="back" size={20} />
        </button>
      </div>

      <header className={styles.hero}>
        <span className={styles.icon}>{node.icon}</span>
        <h1>{lesson.title}</h1>
      </header>

      <div className={styles.blocks}>
        {lesson.blocks.map((block) => (
          <div
            key={block.id}
            className={block.type === 'scripture' ? styles.scriptureBlock : styles.textBlock}
          >
            <p>{block.content}</p>
            {block.reference && <cite className={styles.reference}>{block.reference}</cite>}
          </div>
        ))}
      </div>

      <Link to={practicePath} className={styles.cta}>
        Почати практику
      </Link>
    </section>
  );
}
