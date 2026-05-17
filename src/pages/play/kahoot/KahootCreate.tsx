import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemePicker } from '../../../components/ThemePicker';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import { KAHOOT_DEFAULTS } from '../../../types/gameModes';
import type { KahootRoomSettings } from '../../../types/kahoot';
import { DIFFICULTIES, DIFFICULTY_LABELS } from '../../../types';
import styles from './Kahoot.module.css';

export function KahootCreate() {
  const navigate = useNavigate();
  const { createRoom, error, connected, setError } = useKahootRoom();
  const [hostName, setHostName] = useState('');
  const [themeIds, setThemeIds] = useState<string[]>(['geography']);
  const [questionCount, setQuestionCount] = useState(KAHOOT_DEFAULTS.questionCount);
  const [timePerQuestion, setTimePerQuestion] = useState(KAHOOT_DEFAULTS.timePerQuestionSec);
  const [difficulty, setDifficulty] = useState(KAHOOT_DEFAULTS.difficulty);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!hostName.trim()) {
      setError('Введіть нікнейм ведучого');
      return;
    }
    if (themeIds.length === 0) {
      setError('Оберіть хоча б одну тему');
      return;
    }

    setLoading(true);
    const settings: KahootRoomSettings = {
      themeIds,
      questionCount,
      timePerQuestion,
      difficulty,
    };
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

      <h2 className={styles.sub}>Теми для гри</h2>
      <ThemePicker selected={themeIds} onChange={setThemeIds} />

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
        <span>Кількість питань: {questionCount}</span>
        <input
          type="range"
          min={3}
          max={20}
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
        />
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
