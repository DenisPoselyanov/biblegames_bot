import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Popup } from 'react-vant';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 3500;

interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<ToastEntry | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      clearTimer();
      setEntry({ id: Date.now(), message, variant });
      setVisible(true);
    },
    [clearTimer],
  );

  useEffect(() => {
    if (!visible || !entry) return;
    clearTimer();
    timerRef.current = setTimeout(() => setVisible(false), TOAST_DURATION_MS);
    return clearTimer;
  }, [visible, entry?.id, entry, clearTimer]);

  const handleClosed = useCallback(() => {
    setEntry(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Popup
        visible={visible && entry != null}
        position="top"
        overlay={false}
        lockScroll={false}
        duration={0}
        style={{
          top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          width: '100%',
          maxWidth: 480,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'transparent',
          boxShadow: 'none',
        }}
        onClose={() => setVisible(false)}
        onClosed={handleClosed}
      >
        {entry && (
          <div
            role="status"
            className={`app-toast app-toast--${entry.variant}`}
            key={entry.id}
          >
            {entry.variant === 'warning' && <span className="app-toast__icon" aria-hidden>⚠️</span>}
            {entry.message}
          </div>
        )}
      </Popup>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
