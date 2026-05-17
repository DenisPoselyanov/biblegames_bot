import { THEMES } from '../data/themes';
import styles from './ThemePicker.module.css';

interface ThemePickerProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function ThemePicker({ selected, onChange, disabled }: ThemePickerProps) {
  const toggle = (id: string) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    if (disabled) return;
    onChange(THEMES.map((t) => t.id));
  };

  const clearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.linkBtn} onClick={selectAll} disabled={disabled}>
          Усі теми
        </button>
        <button type="button" className={styles.linkBtn} onClick={clearAll} disabled={disabled}>
          Скинути
        </button>
        <span className={styles.count}>Обрано: {selected.length}</span>
      </div>

      <ul className={styles.grid}>
        {THEMES.map((theme) => {
          const active = selected.includes(theme.id);
          return (
            <li key={theme.id}>
              <button
                type="button"
                className={`${styles.chip} ${active ? styles.active : ''}`}
                style={{ '--chip-color': theme.color } as React.CSSProperties}
                onClick={() => toggle(theme.id)}
                disabled={disabled}
              >
                <span>{theme.icon}</span>
                <small>{theme.title}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
