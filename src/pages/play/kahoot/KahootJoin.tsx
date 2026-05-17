import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useKahootRoom } from '../../../hooks/useKahootRoom';
import styles from './Kahoot.module.css';

export function KahootJoin() {
  const navigate = useNavigate();
  const { joinRoom, error, connected, setError } = useKahootRoom();
  const [code, setCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

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
      <Link to="/play/kahoot" className={styles.back}>
        ← Kahoot
      </Link>

      <h1 className={styles.title}>Приєднатися</h1>

      {!connected && (
        <p className={styles.warn}>⏳ Підключення до сервера… Запустіть `npm run server`</p>
      )}

      <label className={styles.field}>
        <span>Код кімнати</span>
        <input
          type="text"
          maxLength={6}
          placeholder="ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className={styles.codeInput}
        />
      </label>

      <label className={styles.field}>
        <span>Твій нікнейм</span>
        <input
          type="text"
          maxLength={24}
          placeholder="Будь-яке ім’я"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
      </label>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.btnPrimary}
        onClick={handleJoin}
        disabled={loading || !connected}
      >
        {loading ? 'Вхід…' : 'Увійти в кімнату'}
      </button>
    </section>
  );
}
