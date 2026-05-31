import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ThemePicker } from '../../../components/ThemePicker';
import { getThemeById } from '../../../data/themes';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import { hasApi, apiUrl } from '../../../repos/apiClient';
import { KAHOOT_DEFAULTS } from '../../../types/gameModes';
import { buildKahootStartLink, copyKahootCode, shareKahootRoom } from '../../../lib/telegram';
import styles from './Kahoot.module.css';

const ANSWER_COLORS = [
  styles.answerRed,
  styles.answerBlue,
  styles.answerYellow,
  styles.answerGreen,
];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function AnswerBars({
  counts,
  options,
  correctIndex,
}: {
  counts: number[];
  options: string[];
  correctIndex?: number;
}) {
  const max = Math.max(1, ...counts);
  return (
    <ul className={styles.answerBars}>
      {options.map((opt, i) => (
        <li key={i} className={styles.answerBarRow}>
          <span className={styles.answerBarLabel}>
            {OPTION_LABELS[i]}. {opt.slice(0, 24)}
            {opt.length > 24 ? '…' : ''}
          </span>
          <div className={styles.answerBarTrack}>
            <span
              className={`${styles.answerBarFill} ${ANSWER_COLORS[i]} ${correctIndex === i ? styles.answerBarCorrect : ''}`}
              style={{ width: `${(counts[i]! / max) * 100}%` }}
            />
          </div>
          <strong className={styles.answerBarCount}>{counts[i]}</strong>
        </li>
      ))}
    </ul>
  );
}

export function KahootRoom() {
  const { code: urlCode } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const controlOnly = searchParams.get('control') === '1';
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
    advancePhase,
    leaveRoom,
  } = useKahootRoom();

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [localThemes, setLocalThemes] = useState<string[]>([]);
  const [shareHint, setShareHint] = useState('');

  useEffect(() => {
    if (room?.settings.themeIds) {
      setLocalThemes(room.settings.themeIds);
    }
  }, [room?.settings.themeIds]);

  useEffect(() => {
    const endsAt =
      room?.phase === 'question'
        ? room.questionEndsAt
        : room?.phase === 'think'
          ? room.thinkEndsAt
          : undefined;
    if (!endsAt) {
      setTimeLeft(0);
      return;
    }

    const tick = () => {
      setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [room?.questionEndsAt, room?.thinkEndsAt, room?.phase]);

  useEffect(() => {
    if (room?.phase === 'question') {
      setSelectedAnswer(null);
    }
  }, [room?.question?.id, room?.phase]);

  const me = room?.players.find((p) => p.id === myId);
  const canAnswer = isHost ? room?.settings.hostParticipates : true;
  const timerPct = useMemo(() => {
    if (!room || room.phase !== 'question') return 100;
    const total = room.settings.timePerQuestion;
    return Math.max(0, (timeLeft / total) * 100);
  }, [room, timeLeft]);

  const handleShare = () => {
    if (!room) return;
    shareKahootRoom(room.code, room.settings.roomTitle);
    setShareHint('Запрошення надіслано');
    setTimeout(() => setShareHint(''), 2500);
  };

  const handleCopyCode = () => {
    if (!room) return;
    copyKahootCode(room.code);
    setShareHint('Код скопійовано');
    setTimeout(() => setShareHint(''), 2500);
  };

  const handleDownloadCsv = async () => {
    if (!room) return;
    try {
      const base = hasApi() ? apiUrl('/api/kahoot/sessions') : 'http://127.0.0.1:3001/api/kahoot/sessions';
      const res = await fetch(base);
      const data = (await res.json()) as { sessions: Array<{ id: string; code: string }> };
      const session = data.sessions.find((s) => s.code === room.code);
      if (!session) return;
      const csvBase = hasApi()
        ? apiUrl(`/api/kahoot/sessions/${session.id}/csv`)
        : `http://127.0.0.1:3001/api/kahoot/sessions/${session.id}/csv`;
      window.open(csvBase, '_blank');
    } catch {
      /* ignore */
    }
  };

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
    if (room.phase !== 'question' || selectedAnswer != null || !canAnswer) return;
    setSelectedAnswer(index);
    await submitAnswer(index);
  };

  const handleLeave = () => {
    leaveRoom();
    navigate('/play/kahoot');
  };

  const hostManualPanel =
    isHost && room.settings.flowMode === 'manual' && (room.phase === 'reveal' || room.phase === 'leaderboard') ? (
      <div className={styles.hostPanel}>
        {room.phase === 'reveal' && (
          <button type="button" className={styles.btnPrimary} onClick={() => advancePhase()}>
            Показати таблицю
          </button>
        )}
        {room.phase === 'leaderboard' && (
          <button type="button" className={styles.btnPrimary} onClick={() => advancePhase()}>
            {room.question && room.question.index >= room.question.total - 1
              ? 'Завершити гру'
              : 'Наступне питання'}
          </button>
        )}
      </div>
    ) : null;

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

        <h1 className={styles.title}>{room.settings.roomTitle || 'Лобі'}</h1>
        <p className={styles.muted}>
          {isHost ? 'Поділися кодом — гравці приєднуються з нікнеймом' : 'Чекаємо на старт від ведучого'}
        </p>

        {isHost && (
          <div className={styles.shareRow}>
            <button type="button" className={styles.btnOutline} onClick={handleShare}>
              Поділитися
            </button>
            <button type="button" className={styles.btnOutline} onClick={handleCopyCode}>
              Копіювати код
            </button>
            <Link
              to={`/play/kahoot/display/${room.code}`}
              className={styles.btnOutline}
              target="_blank"
              rel="noreferrer"
            >
              Екран залу
            </Link>
          </div>
        )}
        {shareHint && <p className={styles.muted}>{shareHint}</p>}
        {isHost && (
          <p className={styles.mutedSmall}>
            Посилання: {buildKahootStartLink(room.code)}
          </p>
        )}

        {isHost && (
          <>
            {room.settings.questionIds?.length ? (
              <p className={styles.themeList}>
                Джерело: плейлист · {room.settings.questionCount || room.settings.questionIds.length} питань
              </p>
            ) : (
              <>
                <h2 className={styles.sub}>Теми</h2>
                <ThemePicker
                  selected={localThemes.length ? localThemes : room.settings.themeIds}
                  onChange={handleThemeChange}
                />
              </>
            )}
          </>
        )}

        {!isHost &&
          (room.settings.themeIds.length > 0 ? (
            <p className={styles.themeList}>
              Теми:{' '}
              {room.settings.themeIds
                .map((id) => getThemeById(id)?.title ?? id)
                .join(', ')}
            </p>
          ) : room.settings.questionIds?.length ? (
            <p className={styles.themeList}>Джерело: плейлист</p>
          ) : null)}

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
          {room.settings.timePerQuestion}с · {room.settings.flowMode === 'manual' ? 'ручний темп' : 'авто'}
        </p>

        {error && <p className={styles.error}>{error}</p>}

        {isHost ? (
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleStart}
            disabled={
              room.players.length < 1 ||
              (room.settings.themeIds.length === 0 && !room.settings.questionIds?.length)
            }
          >
            Почати гру ({room.players.length} у кімнаті)
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
          {room.players.map((p) => (
            <li key={p.id} className={p.id === myId ? styles.me : ''}>
              <span className={styles.rank}>#{p.rank ?? '—'}</span>
              <span className={styles.pname}>{p.name}</span>
              {p.streak >= 3 && <span className={styles.streakBadge}>🔥{p.streak}</span>}
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
        {me && (
          <p className={styles.myScore}>
            Твій результат: <strong>{me.score}</strong> очок
            {me.rank != null && ` · місце #${me.rank}`}
          </p>
        )}
        {isHost && (
          <button type="button" className={styles.btnOutline} onClick={handleDownloadCsv}>
            Завантажити CSV
          </button>
        )}
        <button type="button" className={styles.btnPrimary} onClick={handleLeave}>
          До меню Kahoot
        </button>
      </section>
    );
  }

  if (room.phase === 'leaderboard') {
    const top = room.players.slice(0, 5);
    if (controlOnly && !isHost) {
      return (
        <section className={styles.page}>
          <p className={styles.muted}>Режим керування — очікування ведучого…</p>
        </section>
      );
    }
    return (
      <section className={`${styles.page} ${styles.gamePage}`}>
        <h2 className={styles.title}>Таблиця лідерів</h2>
        <ol className={styles.leaderboard}>
          {top.map((p) => (
            <li key={p.id} className={p.id === myId ? styles.me : ''}>
              <span className={styles.rank}>#{p.rank ?? '—'}</span>
              <span className={styles.pname}>{p.name}</span>
              {p.lastPoints != null && (
                <span className={p.lastCorrect ? styles.plus : styles.minus}>
                  {p.lastCorrect ? `+${p.lastPoints}` : '—'}
                </span>
              )}
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
        {!controlOnly && hostManualPanel}
        {room.settings.flowMode === 'auto' && (
          <p className={styles.muted}>Наступне питання незабаром…</p>
        )}
      </section>
    );
  }

  const q = room.question;

  if (room.phase === 'think' && q) {
    return (
      <section className={`${styles.page} ${styles.gamePage}`}>
        <div className={styles.gameTop}>
          <span>
            {q.index + 1} / {q.total}
          </span>
          <span className={styles.timerNum}>{timeLeft} с</span>
        </div>
        <p className={styles.thinkHint}>Час на обдумування</p>
        <h2 className={styles.questionLive}>{q.text}</h2>
        <p className={styles.muted}>Варіанти з&apos;являться незабаром…</p>
      </section>
    );
  }

  if (room.phase === 'reveal' && q) {
    return (
      <section className={`${styles.page} ${styles.gamePage}`}>
        <div className={styles.revealHeader}>
          <span>
            Питання {q.index + 1} / {q.total}
          </span>
        </div>
        <h2 className={styles.questionReveal}>{q.text}</h2>
        {room.answerCounts && (
          <AnswerBars
            counts={room.answerCounts}
            options={q.options}
            correctIndex={room.correctIndex}
          />
        )}
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
        {!controlOnly && hostManualPanel}
      </section>
    );
  }

  if (room.phase === 'question' && q) {
    const answered = selectedAnswer != null;
    const hostSpectating = isHost && !canAnswer;

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

        {hostSpectating ? (
          <p className={styles.muted}>
            Ви ведучий · відповіли {room.answeredCount}/{room.totalActivePlayers}
          </p>
        ) : (
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
        )}

        {answered && (
          <p className={styles.answeredHint}>
            Відповідь прийнято · чекаємо інших ({room.answeredCount}/{room.totalActivePlayers})
          </p>
        )}
        {isHost && room.settings.flowMode === 'manual' && (
          <Link
            to={`/play/kahoot/room/${room.code}?control=1`}
            className={styles.mutedSmall}
          >
            Відкрити пульт керування
          </Link>
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
