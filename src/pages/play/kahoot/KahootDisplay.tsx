import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import { usePlayer } from '../../../context/PlayerContext';
import { normalizeBollsTranslation } from '../../../lib/bollsConstants';
import { ScripturePanel } from '../../../components/ScripturePanel';
import { buildKahootStartLink } from '../../../lib/telegram';
import styles from './Kahoot.module.css';

const ANSWER_COLORS = [
  styles.answerRed,
  styles.answerBlue,
  styles.answerYellow,
  styles.answerGreen,
];

export function KahootDisplay() {
  const { code } = useParams<{ code: string }>();
  const { profile } = usePlayer();
  const translation = normalizeBollsTranslation(profile.bibleTranslation);
  const { room, error, connected, joinAsDisplay } = useKahootRoom({ displayOnly: true });
  const [timeLeft, setTimeLeft] = useState(0);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!code || joined || !connected) return;
    void joinAsDisplay(code).then(() => setJoined(true));
  }, [code, connected, joinAsDisplay, joined]);

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
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [room?.questionEndsAt, room?.thinkEndsAt, room?.phase]);

  const joinUrl = useMemo(() => (code ? buildKahootStartLink(code) : ''), [code]);
  const qrSrc = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(joinUrl)}`
    : '';

  if (!connected) {
    return (
      <section className={styles.displayPage}>
        <p className={styles.warn}>Підключення…</p>
      </section>
    );
  }

  if (error || !room) {
    return (
      <section className={styles.displayPage}>
        <p className={styles.error}>{error || `Кімната ${code} недоступна`}</p>
        <Link to="/play/kahoot" className={styles.btnSecondary}>
          Назад
        </Link>
      </section>
    );
  }

  const q = room.question;
  const maxCount = Math.max(1, ...(room.answerCounts ?? [0]));

  if (room.phase === 'lobby') {
    return (
      <section className={styles.displayPage}>
        <h1 className={styles.displayTitle}>{room.settings.roomTitle || 'Біблійна гра Kahoot'}</h1>
        <p className={styles.displaySubtitle}>Приєднуйся!</p>
        <div className={styles.displayCode}>{room.code}</div>
        {qrSrc && (
          <img src={qrSrc} alt="QR код для join" className={styles.displayQr} width={280} height={280} />
        )}
        <p className={styles.displayPlayers}>{room.players.length} гравців у лобі</p>
      </section>
    );
  }

  if (room.phase === 'finished') {
    return (
      <section className={styles.displayPage}>
        <h1 className={styles.displayTitle}>Фінал!</h1>
        <ol className={styles.displayLeaderboard}>
          {room.players.slice(0, 5).map((p) => (
            <li key={p.id}>
              <span>#{p.rank}</span>
              <span>{p.name}</span>
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if (room.phase === 'leaderboard') {
    return (
      <section className={styles.displayPage}>
        <h2 className={styles.displayTitle}>Таблиця лідерів</h2>
        <ol className={styles.displayLeaderboard}>
          {room.players.slice(0, 5).map((p) => (
            <li key={p.id}>
              <span>#{p.rank}</span>
              <span>{p.name}</span>
              <strong>{p.score}</strong>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  if ((room.phase === 'think' || room.phase === 'question') && q) {
    return (
      <section className={styles.displayPage}>
        <div className={styles.displayTopBar}>
          <span>
            {q.index + 1} / {q.total}
          </span>
          <span>{timeLeft} с</span>
          <span>
            {room.answeredCount}/{room.totalActivePlayers} відповіли
          </span>
        </div>
        <h2 className={styles.displayQuestion}>{q.text}</h2>
        {room.phase === 'question' && (
          <ul className={styles.displayOptions}>
            {q.options.map((opt, i) => (
              <li key={i} className={ANSWER_COLORS[i]}>
                {opt}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (room.phase === 'reveal' && q) {
    return (
      <section className={styles.displayPage}>
        <h2 className={styles.displayQuestion}>{q.text}</h2>
        {room.answerCounts && (
          <ul className={styles.displayBars}>
            {q.options.map((opt, i) => (
              <li key={i}>
                <span>{opt}</span>
                <div className={styles.displayBarTrack}>
                  <span
                    className={`${styles.displayBarFill} ${ANSWER_COLORS[i]}`}
                    style={{ width: `${((room.answerCounts![i] ?? 0) / maxCount) * 100}%` }}
                  />
                </div>
                <strong>{room.answerCounts?.[i] ?? 0}</strong>
              </li>
            ))}
          </ul>
        )}
        {room.correctIndex != null && (
          <p className={styles.displayCorrect}>
            ✅ {q.options[room.correctIndex]}
          </p>
        )}
        {room.reference && (
          <>
            <p className={styles.ref}>📖 {room.reference}</p>
            <ScripturePanel reference={room.reference} translation={translation} compact />
          </>
        )}
      </section>
    );
  }

  return (
    <section className={styles.displayPage}>
      <p className={styles.muted}>Очікування…</p>
    </section>
  );
}
