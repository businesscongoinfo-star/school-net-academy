import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type Variant = 'success' | 'error' | 'info';
type Toast = { id: number; title: string; description?: string; variant: Variant };

interface ToastApi {
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++counter.current;
    setToasts((list) => [...list.slice(-3), { ...toast, id }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    push,
    success: (title, description) => push({ title, description, variant: 'success' }),
    error: (title, description) => push({ title, description, variant: 'error' }),
    info: (title, description) => push({ title, description, variant: 'info' }),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((toast) => {
          const Icon = toast.variant === 'success' ? CheckCircle2 : toast.variant === 'error' ? AlertTriangle : Info;
          return (
            <div key={toast.id} className={`toast ${toast.variant}`}>
              <span className="t-icon"><Icon size={16} /></span>
              <div className="grow">
                <strong>{toast.title}</strong>
                {toast.description && <p>{toast.description}</p>}
              </div>
              <button className="close" onClick={() => dismiss(toast.id)} aria-label="Fermer la notification">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider');
  return ctx;
}
