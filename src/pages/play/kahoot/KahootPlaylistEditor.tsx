import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../../components/Icon';
import { ThemePicker } from '../../../components/ThemePicker';
import { playlistManager } from '../../../lib/playlists';
import { getQuestionCountByDifficulty } from '../../../data/questions';
import { useTelegram } from '../../../hooks/useTelegram';
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '../../../types';
import styles from './Kahoot.module.css';

function clampCount(value: number) {
  return Math.max(3, value);
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
  const [difficulties, setDifficulties] = useState<Difficulty[]>(['youth']);
  const [questionCount, setQuestionCount] = useState(10);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const maxAvailable = useMemo(() => {
    const diffs = difficulties.length > 0 ? difficulties : DIFFICULTIES;
    return themeIds.reduce((sum, id) => sum + diffs.reduce((s, d) => s + getQuestionCountByDifficulty(id, d), 0), 0);
  }, [themeIds, difficulties]);

  const sliderMax = Math.max(maxAvailable, 1);
  const sliderMin = Math.min(3, sliderMax);

  useEffect(() => {
    if (!existing) {
      const picked = playlistManager.pickQuestionsForPlaylist({ themeIds, difficulties, count: questionCount });
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
    setQuestionIds(playlistManager.pickQuestionsForPlaylist({ themeIds, difficulties, count: questionCount }));
  }, [themeIds, difficulties, canEdit]);

  useEffect(() => {
    if (!canEdit) return;
    const timer = setTimeout(() => {
      setQuestionIds(playlistManager.pickQuestionsForPlaylist({ themeIds, difficulties, count: questionCount }));
    }, 400);
    return () => clearTimeout(timer);
  }, [questionCount]);

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
        <div className={styles.topRow}>
          <Link to="/play/kahoot/playlists" className={styles.backBtn} aria-label="Назад">
            <Icon name="back" size={20} />
          </Link>
        </div>
        <p className={styles.error}>Немає доступу до редагування цього плейлисту</p>
      </section>
    );
  }

  const backTo = existing ? `/play/kahoot/playlists/${existing.id}` : '/play/kahoot/playlists';

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link to={backTo} className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
      </div>

      <h1 className={styles.pageTitle}>{existing ? 'Редагувати плейлист' : 'Створити плейлист'}</h1>

      <div className={styles.sectionCard}>
        <label className={styles.field}>
          <span>Назва</span>
          <input
            type="text"
            maxLength={40}
            value={name}
            placeholder="Введіть назву плейлисту"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Опис</span>
          <input
            type="text"
            maxLength={120}
            value={description}
            placeholder="Короткий опис плейлисту"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
          <span>Публічний плейлист</span>
        </label>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionCardHeader}>
          <h3>Теми</h3>
          <span className={styles.sectionCount}>Обрано: {themeIds.length}</span>
        </div>
        <ThemePicker selected={themeIds} onChange={setThemeIds} />
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionCardHeader}>
          <h3>Параметри гри</h3>
        </div>

        <div className={styles.field}>
          <span>Складність</span>
          <div className={styles.chipGroup}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.chip} ${difficulties.includes(d) ? styles.chipActive : ''}`}
                onClick={() => setDifficulties((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
              >
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.sliderTitle}>
            Кількість питань <strong>{questionCount} / {sliderMax}</strong>
          </span>
          <div className={styles.sliderWrap}>
            <span
              className={styles.sliderValue}
              style={{ left: `${(sliderMax > sliderMin ? ((questionCount - sliderMin) / (sliderMax - sliderMin)) * 100 : 50)}%` }}
            >
              {questionCount}
            </span>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              value={questionCount}
              className={styles.rangeSlider}
              onChange={(e) => setQuestionCount(clampCount(Number(e.target.value)))}
            />
          </div>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="button" className={styles.btnPrimary} onClick={handleSave}>
        {existing ? 'Оновити плейлист' : 'Зберегти плейлист'}
      </button>
    </section>
  );
}

