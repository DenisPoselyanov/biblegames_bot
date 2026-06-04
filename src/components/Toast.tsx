import { createContext, useCallback, useContext, type ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function showHotToast(message: string, variant: ToastVariant = 'info') {
  const opts = {
    duration: 3500,
    className: `hot-toast hot-toast--${variant}`,
  };
  switch (variant) {
    case 'success':
      toast.success(message, opts);
      break;
    case 'error':
      toast.error(message, opts);
      break;
    case 'warning':
      toast(message, { ...opts, icon: '⚠️' });
      break;
    default:
      toast(message, opts);
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    showHotToast(message, variant);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toaster
        position="top-center"
        containerClassName="hot-toast-container"
        toastOptions={{
          className: 'hot-toast',
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
