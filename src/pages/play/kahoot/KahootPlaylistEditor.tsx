import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ThemePicker } from '../../../components/ThemePicker';
import { playlistManager } from '../../../lib/playlists';
import { useTelegram } from '../../../hooks/useTelegram';
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '../../../types';
import styles from './Kahoot.module.css';

function clampCount(value: number) {
  return Math.min(20, Math.max(3, value));
}

export function KahootPlaylistEditor() {
  const navigate = useNavigate();
  const { playlistId } = useParams<{ playlistId: string }>();
  const { userId, displayName } = useTelegram();

  const existing = useMemo(() => (playlistId ? playlistManager.getPlaylist(playlistId) : undefined), [playlistId]);
  const canEdit = !existing || existing.creatorId === userId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [themeIds, setThemeIds] = useState<string[]>(['geography']);
  const [difficulty, setDifficulty] = useState<Difficulty>('youth');
  const [questionCount, setQuestionCount] = useState(10);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) {
      const picked = playlistManager.pickQuestionsForPlaylist({ themeIds, difficulty, count: questionCount });
      setQuestionIds(picked);
      return;
    }
    setName(existing.name);
    setDescription(existing.description);
    setIsPublic(existing.isPublic);
    setThemeIds(existing.themes.length ? existing.themes : ['geography']);
    setQuestionCount(clampCount(existing.questions.length || 10));
    setQuestionIds(existing.questions);
  }, [existing]);

  useEffect(() => {
    if (!canEdit) return;
    if (existing) return;
    setQuestionIds(playlistManager.pickQuestionsForPlaylist({ themeIds, difficulty, count: questionCount }));
  }, [themeIds, difficulty, questionCount, canEdit, existing]);

  const handleRegenerate = () => {
    setQuestionIds(playlistManager.pickQuestionsForPlaylist({ themeIds, difficulty, count: questionCount }));
  };

  const handleSave = () => {
    if (!canEdit) return;

    const validation = playlistManager.validatePlaylist({
      name,
      description,
      isPublic,
      questions: questionIds,
      creatorId: userId,
      creatorName: displayName,
    });
    if (!validation.valid) {
      setError(validation.errors[0] ?? 'Перевірте дані плейлисту');
      return;
    }

    if (existing) {
      const updated = playlistManager.updatePlaylist(existing.id, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        questions: questionIds,
      });
      if (!updated) {
        setError('Не вдалося зберегти плейлист');
        return;
      }
      navigate(`/play/kahoot/playlists/${updated.id}`);
      return;
    }

    const created = playlistManager.createPlaylist(
      name.trim(),
      description.trim(),
      userId,
      displayName,
      questionIds,
      isPublic,
    );
    navigate(`/play/kahoot/playlists/${created.id}`);
  };

  if (!canEdit) {
    return (
      <section className={styles.page}>
        <Link to="/play/kahoot/playlists" className={styles.back}>
          ← Плейлисти
        </Link>
        <p className={styles.error}>Немає доступу до редагування цього плейлисту</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <Link to={existing ? `/play/kahoot/playlists/${existing.id}` : '/play/kahoot/playlists'} className={styles.back}>
        ← Плейлисти
      </Link>

      <h1 className={styles.title}>{existing ? 'Редагувати плейлист' : 'Створити плейлист'}</h1>

      <label className={styles.field}>
        <span>Назва</span>
        <input
          type="text"
          maxLength={40}
          value={name}
          placeholder="Наприклад: Євангелія — спринт"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span>Опис</span>
        <input
          type="text"
          maxLength={120}
          value={description}
          placeholder="Для швидкої гри з друзями"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label className={styles.checkboxRow}>
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        <span>Зробити публічним</span>
      </label>

      <h2 className={styles.sub}>Теми</h2>
      <ThemePicker selected={themeIds} onChange={setThemeIds} />

      <label className={styles.field}>
        <span>Складність</span>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Кількість питань у плейлисті: {questionCount}</span>
        <input
          type="range"
          min={3}
          max={20}
          value={questionCount}
          onChange={(e) => setQuestionCount(clampCount(Number(e.target.value)))}
        />
      </label>

      <div className={styles.playlistBuildRow}>
        <p className={styles.muted}>Зараз обрано питань: {questionIds.length}</p>
        <button type="button" className={styles.btnSecondary} onClick={handleRegenerate}>
          Оновити
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="button" className={styles.btnPrimary} onClick={handleSave}>
        Зберегти
      </button>
    </section>
  );
}

