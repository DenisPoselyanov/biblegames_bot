import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const VARIANT_CONFIG: Record<ToastVariant, { icon: IconName; bg: string; border: string; color: string }> = {
  success: { icon: 'success', bg: 'var(--success-bg)', border: 'var(--success)', color: 'var(--success-text)' },
  error: { icon: 'error', bg: 'var(--danger-bg)', border: 'var(--danger)', color: 'var(--danger-text)' },
  warning: { icon: 'warning', bg: 'var(--warning-bg)', border: 'var(--warning)', color: 'var(--gold-light)' },
  info: { icon: 'info', bg: 'var(--info-bg)', border: 'var(--info)', color: 'var(--info)' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '5.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 'var(--z-toast)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: '400px',
          width: 'calc(100% - 2rem)',
          pointerEvents: 'none',
        }}
        role="region"
        aria-label="Сповіщення"
      >
        {toasts.map((toast) => {
          const cfg = VARIANT_CONFIG[toast.variant];
          return (
            <div
              key={toast.id}
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1rem',
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                borderRadius: 'var(--radius-lg)',
                color: cfg.color,
                fontSize: '0.9rem',
                fontWeight: 600,
                pointerEvents: 'auto',
                animation: 'fadeInUp 0.25s var(--ease-out)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Icon name={cfg.icon} size={20} />
              <span style={{ flex: 1 }}>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Закрити сповіщення"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  opacity: 0.7,
                  display: 'flex',
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
