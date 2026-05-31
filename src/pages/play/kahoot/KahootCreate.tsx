import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/Icon';
import { ThemePicker } from '../../../components/ThemePicker';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import { useTelegram } from '../../../hooks/useTelegram';
import { playlistManager } from '../../../lib/playlists';
import { getQuestionCountByDifficulty } from '../../../data/questions';
import { KAHOOT_DEFAULTS } from '../../../types/gameModes';
import type { KahootFlowMode, KahootRoomSettings, KahootScoringMode } from '../../../types/kahoot';
import { normalizeKahootSettings } from '../../../types/kahoot';
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '../../../types';
import styles from './Kahoot.module.css';

type QuestionSource = 'themes' | 'playlist';

const TIME_OPTIONS = [10, 20, 30, 60];
const THINK_OPTIONS = [0, 5, 10];

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
  const [roomTitle, setRoomTitle] = useState('');
  const [themeIds, setThemeIds] = useState<string[]>(['geography']);
  const [questionCount, setQuestionCount] = useState(KAHOOT_DEFAULTS.questionCount);
  const [timePerQuestion, setTimePerQuestion] = useState(KAHOOT_DEFAULTS.timePerQuestionSec);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([KAHOOT_DEFAULTS.difficulty]);
  const [playlistId, setPlaylistId] = useState('');
  const [explicitQuestionIds, setExplicitQuestionIds] = useState<string[] | null>(null);
  const [flowMode, setFlowMode] = useState<KahootFlowMode>(KAHOOT_DEFAULTS.flowMode);
  const [scoringMode, setScoringMode] = useState<KahootScoringMode>(KAHOOT_DEFAULTS.scoringMode);
  const [thinkTimeSec, setThinkTimeSec] = useState(KAHOOT_DEFAULTS.thinkTimeSec);
  const [hostParticipates, setHostParticipates] = useState(KAHOOT_DEFAULTS.hostParticipates);
  const [customFieldLabel, setCustomFieldLabel] = useState('');
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

  const maxAvailableThemes = useMemo(() => {
    const diffs = difficulties.length > 0 ? difficulties : DIFFICULTIES;
    return themeIds.reduce((sum, id) => sum + diffs.reduce((s, d) => s + getQuestionCountByDifficulty(id, d), 0), 0);
  }, [themeIds, difficulties]);

  const sliderMax = source === 'playlist'
    ? (selectedPlaylist ? Math.max(3, selectedPlaylist.questions.length) : 20)
    : Math.max(maxAvailableThemes, 1);

  const sliderMin = Math.min(3, sliderMax);

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
    const max = Math.max(3, selectedPlaylist.questions.length);
    if (questionCount > max) setQuestionCount(max);
  }, [source, selectedPlaylist, questionCount]);

  const handleCreate = async () => {
    if (!hostName.trim()) {
      setError('Введіть нікнейм ведучого');
      return;
    }

    let base: Pick<KahootRoomSettings, 'themeIds' | 'questionCount' | 'timePerQuestion' | 'difficulty' | 'playlistId' | 'questionIds'>;

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
      const max = Math.max(3, pool.length);
      const count = Math.min(max, Math.max(3, questionCount));
      const picked = explicitQuestionIds?.length ? explicitQuestionIds : shuffle(pool).slice(0, count);

      base = {
        themeIds: selectedPlaylist.themes,
        questionCount: Math.max(3, picked.length),
        timePerQuestion,
        difficulty: difficulties[0] ?? 'youth',
        playlistId,
        questionIds: picked,
      };
    } else {
      if (themeIds.length === 0) {
        setError('Оберіть хоча б одну тему');
        return;
      }

      base = {
        themeIds,
        questionCount,
        timePerQuestion,
        difficulty: difficulties[0] ?? 'youth',
      };
    }

    const settings = normalizeKahootSettings({
      ...base,
      flowMode,
      scoringMode,
      thinkTimeSec,
      hostParticipates,
      roomTitle: roomTitle.trim() || undefined,
      customFieldLabel: customFieldLabel.trim() || undefined,
    });

    setLoading(true);
    const hostTelegramId = userId !== 'guest' ? userId : undefined;
    const state = await createRoom(hostName.trim(), settings, hostTelegramId);
    setLoading(false);
    if (state) navigate(`/play/kahoot/room/${state.code}`);
  };

  return (
    <section className={styles.page}>
      <div className={styles.topRow}>
        <Link to="/play/kahoot" className={styles.backBtn} aria-label="Назад">
          <Icon name="back" size={20} />
        </Link>
      </div>

      <h1 className={styles.pageTitle}>Створити кімнату</h1>

      {!connected && (
        <p className={styles.serverError}>Не вдалося з&apos;єднатися з сервером. Перевірте підключення.</p>
      )}

      <div className={styles.sectionCard}>
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

        <label className={styles.field}>
          <span>Назва кімнати (необов&apos;язково)</span>
          <input
            type="text"
            maxLength={40}
            placeholder="Недільна школа"
            value={roomTitle}
            onChange={(e) => setRoomTitle(e.target.value)}
          />
        </label>

        <div className={styles.segmentControl}>
          <button
            type="button"
            className={`${styles.segmentTab} ${source === 'themes' ? styles.segmentActive : ''}`}
            onClick={() => { setSource('themes'); setExplicitQuestionIds(null); }}
          >
            Теми
          </button>
          <button
            type="button"
            className={`${styles.segmentTab} ${source === 'playlist' ? styles.segmentActive : ''}`}
            onClick={() => setSource('playlist')}
          >
            Плейлист
          </button>
          <span className={`${styles.segmentGlider} ${source === 'themes' ? styles.gliderLeft : styles.gliderRight}`} />
        </div>

        {source === 'playlist' ? (
          <label className={styles.field}>
            <span>Плейлист</span>
            <select
              value={playlistId}
              onChange={(e) => { setPlaylistId(e.target.value); setExplicitQuestionIds(null); }}
            >
              <option value="">Оберіть плейлист</option>
              {playlistOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.isPublic ? ' (публічний)' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <ThemePicker selected={themeIds} onChange={setThemeIds} />
        )}
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.field}>
          <span>Складність питань</span>
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
              style={{ left: `${sliderMax > sliderMin ? ((questionCount - sliderMin) / (sliderMax - sliderMin)) * 100 : 50}%` }}
            >
              {questionCount}
            </span>
            <input
              type="range"
              min={sliderMin}
              max={sliderMax}
              value={questionCount}
              className={styles.rangeSlider}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
            />
          </div>
        </label>

        <div className={styles.field}>
          <span>Час на відповідь</span>
          <div className={styles.chipGroup}>
            {TIME_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.chip} ${timePerQuestion === t ? styles.chipActive : ''}`}
                onClick={() => setTimePerQuestion(t)}
              >
                {t}с
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <span>Час на обдумування (think)</span>
          <div className={styles.chipGroup}>
            {THINK_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.chip} ${thinkTimeSec === t ? styles.chipActive : ''}`}
                onClick={() => setThinkTimeSec(t)}
              >
                {t === 0 ? 'Вимк.' : `${t}с`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.field}>
          <span>Темп гри</span>
          <div className={styles.chipGroup}>
            <button
              type="button"
              className={`${styles.chip} ${flowMode === 'auto' ? styles.chipActive : ''}`}
              onClick={() => setFlowMode('auto')}
            >
              Авто
            </button>
            <button
              type="button"
              className={`${styles.chip} ${flowMode === 'manual' ? styles.chipActive : ''}`}
              onClick={() => setFlowMode('manual')}
            >
              Вручну
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <span>Очки</span>
          <div className={styles.chipGroup}>
            <button
              type="button"
              className={`${styles.chip} ${scoringMode === 'classic' ? styles.chipActive : ''}`}
              onClick={() => setScoringMode('classic')}
            >
              Класичні
            </button>
            <button
              type="button"
              className={`${styles.chip} ${scoringMode === 'simple' ? styles.chipActive : ''}`}
              onClick={() => setScoringMode('simple')}
            >
              5–30
            </button>
          </div>
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={hostParticipates}
            onChange={(e) => setHostParticipates(e.target.checked)}
          />
          <span>Ведучий теж відповідає</span>
        </label>

        <label className={styles.field}>
          <span>Додаткове поле при join (напр. повне ім&apos;я)</span>
          <input
            type="text"
            maxLength={32}
            placeholder="Залиште порожнім, щоб вимкнути"
            value={customFieldLabel}
            onChange={(e) => setCustomFieldLabel(e.target.value)}
          />
        </label>
      </div>

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
