import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ThemePicker } from '../../../components/ThemePicker';
import { getThemeById } from '../../../data/themes';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import { KAHOOT_DEFAULTS } from '../../../types/gameModes';
import styles from './Kahoot.module.css';

const ANSWER_COLORS = [
  styles.answerRed,
  styles.answerBlue,
  styles.answerYellow,
  styles.answerGreen,
];

export function KahootRoom() {
  const { code: urlCode } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    room,
    error,
    connected,
    isHost,
    myId,
    updateSettings,
    startGame,
    submitAnswer,
    leaveRoom,
  } = useKahootRoom();

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [localThemes, setLocalThemes] = useState<string[]>([]);

  useEffect(() => {
    if (room?.settings.themeIds) {
      setLocalThemes(room.settings.themeIds);
    }
  }, [room?.settings.themeIds]);

  useEffect(() => {
    if (!room?.questionEndsAt || room.phase !== 'question') {
      setTimeLeft(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((room.questionEndsAt! - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [room?.questionEndsAt, room?.phase]);

  useEffect(() => {
    if (room?.phase === 'question') {
      setSelectedAnswer(null);
    }
  }, [room?.question?.id, room?.phase]);

  const me = room?.players.find((p) => p.id === myId);
  const timerPct = useMemo(() => {
    if (!room || room.phase !== 'question') return 100;
    const total = room.settings.timePerQuestion;
    return Math.max(0, (timeLeft / total) * 100);
  }, [room, timeLeft]);

  if (!connected) {
    return (
      <section className={styles.page}>
        <p className={styles.warn}>Підключення до сервера…</p>
      </section>
    );
  }

  if (!room) {
    return (
      <section className={styles.page}>
        <p className={styles.error}>Кімната {urlCode} недоступна</p>
        <Link to="/play/kahoot/join" className={styles.btnSecondary}>
          Приєднатися знову
        </Link>
      </section>
    );
  }

  const handleThemeChange = async (ids: string[]) => {
    setLocalThemes(ids);
    if (isHost && room.phase === 'lobby') {
      await updateSettings({ themeIds: ids });
    }
  };

  const handleStart = async () => {
    await startGame();
  };

  const handleAnswer = async (index: number) => {
    if (room.phase !== 'question' || selectedAnswer != null) return;
    setSelectedAnswer(index);
    await submitAnswer(index);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/play/kahoot');
  };

  if (room.phase === 'lobby') {
    return (
      <section className={styles.page}>
        <div className={styles.lobbyTop}>
          <button type="button" className={styles.leaveBtn} onClick={handleLeave}>
            Вийти
          </button>
          <div className={styles.codeBadge}>
            <small>Код кімнати</small>
            <strong>{room.code}</strong>
          </div>
        </div>

        <h1 className={styles.title}>Лобі</h1>
        <p className={styles.muted}>
          {isHost ? 'Поділися кодом — гравці приєднуються з нікнеймом' : 'Чекаємо на старт від ведучого'}
        </p>

        {isHost && (
          <>
            <h2 className={styles.sub}>Теми</h2>
            <ThemePicker
              selected={localThemes.length ? localThemes : room.settings.themeIds}
              onChange={handleThemeChange}
            />
          </>
        )}

        {!isHost && room.settings.themeIds.length > 0 && (
          <p className={styles.themeList}>
            Теми:{' '}
            {room.settings.themeIds
              .map((id) => getThemeById(id)?.title ?? id)
              .join(', ')}
          </p>
        )}

        <ul className={styles.playerList}>
          {room.players.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              {p.id === room.hostId && <em>ведучий</em>}
            </li>
          ))}
        </ul>

        <p className={styles.muted}>
          {room.settings.questionCount || KAHOOT_DEFAULTS.questionCount} питань ·{' '}
          {room.settings.timePerQuestion}с на відповідь
        </p>

        {error && <p className={styles.error}>{error}</p>}

        {isHost ? (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleStart}
            disabled={room.players.length < 1 || room.settings.themeIds.length === 0}
          >
            Почати гру ({room.players.length} гравців)
          </button>
        ) : (
          <p className={styles.waiting}>⏳ Очікування старту…</p>
        )}
      </section>
    );
  }

  if (room.phase === 'finished') {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>Гра завершена!</h1>
        <ol className={styles.leaderboard}>
          {room.players.map((p, i) => (
            <li key={p.id} className={p.id === myId ? styles.me : ''}>
              <span className={styles.rank}>{i + 1}</span>
              <span className={styles.pname}>{p.name}</span>
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
        {me && (
          <p className={styles.myScore}>
            Твій результат: <strong>{me.score}</strong> очок
          </p>
        )}
        <button type="button" className={styles.btnPrimary} onClick={handleLeave}>
          До меню Kahoot
        </button>
      </section>
    );
  }

  const q = room.question;

  if (room.phase === 'reveal' && q) {
    return (
      <section className={`${styles.page} ${styles.gamePage}`}>
        <div className={styles.revealHeader}>
          <span>
            Питання {q.index + 1} / {q.total}
          </span>
        </div>
        <h2 className={styles.questionReveal}>{q.text}</h2>
        <ul className={styles.optionsReveal}>
          {q.options.map((opt, i) => {
            let cls = ANSWER_COLORS[i];
            if (room.correctIndex === i) cls += ` ${styles.optionCorrect}`;
            else if (selectedAnswer === i) cls += ` ${styles.optionWrong}`;
            return (
              <li key={i} className={cls}>
                {opt}
              </li>
            );
          })}
        </ul>
        {room.reference && <p className={styles.ref}>📖 {room.reference}</p>}

        <ul className={styles.leaderboardCompact}>
          {room.players.slice(0, 5).map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              {p.lastPoints != null && (
                <span className={p.lastCorrect ? styles.plus : styles.minus}>
                  {p.lastCorrect ? `+${p.lastPoints}` : '—'}
                </span>
              )}
              <strong>{p.score}</strong>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (room.phase === 'question' && q) {
    const answered = selectedAnswer != null;

    return (
      <section className={`${styles.page} ${styles.gamePage}`}>
        <div className={styles.gameTop}>
          <span>
            {q.index + 1} / {q.total}
          </span>
          <span className={styles.scoreMini}>{me?.score ?? 0} очок</span>
        </div>

        <div className={styles.timerBar} aria-hidden>
          <span style={{ width: `${timerPct}%` }} />
        </div>
        <p className={styles.timerNum}>{timeLeft} с</p>

        <h2 className={styles.questionLive}>{q.text}</h2>

        <div className={styles.kahootGrid}>
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.kahootBtn} ${ANSWER_COLORS[i]} ${selectedAnswer === i ? styles.picked : ''}`}
              onClick={() => handleAnswer(i)}
              disabled={answered}
            >
              <span className={styles.shape} />
              <span className={styles.optText}>{opt}</span>
            </button>
          ))}
        </div>

        {answered && (
          <p className={styles.answeredHint}>
            Відповідь прийнято · чекаємо інших ({room.answeredCount}/{room.players.length})
          </p>
        )}
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <p className={styles.muted}>Завантаження…</p>
    </section>
  );
}
