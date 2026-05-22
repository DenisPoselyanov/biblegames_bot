import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemePicker } from '../../../components/ThemePicker';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import { useTelegram } from '../../../hooks/useTelegram';
import { playlistManager } from '../../../lib/playlists';
import { KAHOOT_DEFAULTS } from '../../../types/gameModes';
import type { KahootRoomSettings } from '../../../types/kahoot';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../../types';
import styles from './Kahoot.module.css';

type QuestionSource = 'themes' | 'playlist';

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function KahootCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { createRoom, error, connected, setError } = useKahootRoom();
  const { userId } = useTelegram();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const presetPlaylistId = query.get('playlistId');
  const presetQuestions = query.get('q');

  const [source, setSource] = useState<QuestionSource>('themes');
  const [hostName, setHostName] = useState('');
  const [themeIds, setThemeIds] = useState<string[]>(['geography']);
  const [questionCount, setQuestionCount] = useState(KAHOOT_DEFAULTS.questionCount);
  const [timePerQuestion, setTimePerQuestion] = useState(KAHOOT_DEFAULTS.timePerQuestionSec);
  const [difficulty, setDifficulty] = useState(KAHOOT_DEFAULTS.difficulty);
  const [playlistId, setPlaylistId] = useState('');
  const [explicitQuestionIds, setExplicitQuestionIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const playlistOptions = useMemo(() => {
    const all = [...playlistManager.getUserPlaylists(userId), ...playlistManager.getPublicPlaylists()];
    const unique = new Map<string, (typeof all)[number]>();
    for (const p of all) unique.set(p.id, p);
    return [...unique.values()].sort((a, b) => b.plays - a.plays);
  }, [userId]);

  const selectedPlaylist = useMemo(
    () => (playlistId ? playlistManager.getPlaylist(playlistId) : undefined),
    [playlistId],
  );

  useEffect(() => {
    if (!presetPlaylistId) return;
    setSource('playlist');
    setPlaylistId(presetPlaylistId);
    if (presetQuestions) {
      const ids = presetQuestions.split(',').map((s) => s.trim()).filter(Boolean);
      setExplicitQuestionIds(ids.length ? ids : null);
    }
  }, [presetPlaylistId, presetQuestions]);

  useEffect(() => {
    if (source !== 'playlist') return;
    if (!selectedPlaylist) return;
    const max = Math.min(20, Math.max(3, selectedPlaylist.questions.length));
    if (questionCount > max) setQuestionCount(max);
  }, [source, selectedPlaylist, questionCount]);

  const handleCreate = async () => {
    if (!hostName.trim()) {
      setError('Введіть нікнейм ведучого');
      return;
    }

    let settings: KahootRoomSettings;

    if (source === 'playlist') {
      if (!playlistId) {
        setError('Оберіть плейлист');
        return;
      }
      if (!selectedPlaylist) {
        setError('Плейлист не знайдено');
        return;
      }

      const pool = selectedPlaylist.questions;
      const max = Math.min(20, Math.max(3, pool.length));
      const count = Math.min(max, Math.max(3, questionCount));
      const picked = explicitQuestionIds?.length ? explicitQuestionIds : shuffle(pool).slice(0, count);

      settings = {
        themeIds: selectedPlaylist.themes,
        questionCount: Math.min(20, Math.max(3, picked.length)),
        timePerQuestion,
        difficulty,
        playlistId,
        questionIds: picked,
      };
    } else {
      if (themeIds.length === 0) {
        setError('Оберіть хоча б одну тему');
        return;
      }

      settings = {
        themeIds,
        questionCount,
        timePerQuestion,
        difficulty,
      };
    }

    setLoading(true);
    const state = await createRoom(hostName.trim(), settings);
    setLoading(false);
    if (state) navigate(`/play/kahoot/room/${state.code}`);
  };

  return (
    <section className={styles.page}>
      <Link to="/play/kahoot" className={styles.back}>
        ← Kahoot
      </Link>

      <h1 className={styles.title}>Створити кімнату</h1>

      {!connected && (
        <p className={styles.warn}>⏳ Підключення до сервера… Запустіть `npm run server`</p>
      )}

      <label className={styles.field}>
        <span>Твій нікнейм (ведучий)</span>
        <input
          type="text"
          maxLength={24}
          placeholder="Наприклад: Олександр"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
      </label>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${source === 'themes' ? styles.tabActive : ''}`}
          onClick={() => {
            setSource('themes');
            setExplicitQuestionIds(null);
          }}
        >
          Теми
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${source === 'playlist' ? styles.tabActive : ''}`}
          onClick={() => setSource('playlist')}
        >
          Плейлист
        </button>
      </div>

      {source === 'playlist' ? (
        <>
          <label className={styles.field}>
            <span>Плейлист</span>
            <select
              value={playlistId}
              onChange={(e) => {
                setPlaylistId(e.target.value);
                setExplicitQuestionIds(null);
              }}
            >
              <option value="">Оберіть плейлист</option>
              {playlistOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isPublic ? ' (публічний)' : ''}
                </option>
              ))}
            </select>
          </label>

          <p className={styles.muted}>
            {selectedPlaylist ? `Питань у плейлисті: ${selectedPlaylist.questions.length}` : ' '}
          </p>

          <label className={styles.field}>
            <span>Кількість питань: {questionCount}</span>
            <input
              type="range"
              min={3}
              max={selectedPlaylist ? Math.min(20, Math.max(3, selectedPlaylist.questions.length)) : 20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
            />
          </label>

          <Link to="/play/kahoot/playlists" className={styles.btnSecondary}>
            Перейти до плейлистів
          </Link>
        </>
      ) : (
        <>
          <h2 className={styles.sub}>Теми для гри</h2>
          <ThemePicker selected={themeIds} onChange={setThemeIds} />

          <label className={styles.field}>
            <span>Кількість питань: {questionCount}</span>
            <input
              type="range"
              min={3}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
            />
          </label>
        </>
      )}

      <label className={styles.field}>
        <span>Складність питань</span>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Час на відповідь: {timePerQuestion} с</span>
        <input
          type="range"
          min={10}
          max={45}
          step={5}
          value={timePerQuestion}
          onChange={(e) => setTimePerQuestion(Number(e.target.value))}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.btnPrimary}
        onClick={handleCreate}
        disabled={loading || !connected}
      >
        {loading ? 'Створення…' : 'Створити кімнату'}
      </button>
    </section>
  );
}
