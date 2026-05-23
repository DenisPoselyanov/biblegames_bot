import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/Icon';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import styles from './Kahoot.module.css';

export function KahootJoin() {
  const navigate = useNavigate();
  const { joinRoom, error, connected, setError } = useKahootRoom();
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Введіть код кімнати');
      return;
    }
    if (!playerName.trim()) {
      setError('Введіть нікнейм');
      return;
    }

    setLoading(true);
    const state = await joinRoom(code.trim(), playerName.trim());
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

      <div className={styles.joinCenter}>
        <h1 className={styles.pageTitle}>Приєднатися</h1>

        <div className={styles.codeGrid} onClick={() => hiddenRef.current?.focus()} role="presentation">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`${styles.codeCell} ${code[i] ? styles.codeCellFilled : ''}`}>
              {code[i] || ''}
            </div>
          ))}
          <input
            ref={hiddenRef}
            type="text"
            maxLength={6}
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={styles.codeHiddenInput}
            aria-label="Код кімнати"
          />
        </div>

        <label className={styles.field}>
          <span>Твій нікнейм</span>
          <input
            type="text"
            maxLength={24}
            placeholder="Будь-яке ім'я"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </label>

        {!connected && (
          <p className={styles.serverError}>Не вдалося з'єднатися з сервером. Перевірте підключення.</p>
        )}
        {error && <p className={styles.error}>{error}</p>}

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleJoin}
          disabled={loading || !connected}
        >
          {loading ? 'Вхід…' : 'Увійти в кімнату'}
        </button>
      </div>
    </section>
  );
}
