import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  /** Optional button, e.g. "Desfazer". The toast closes after it is clicked. */
  action?: { label: string; onClick: () => void };
  /** Auto-dismiss delay in ms; 0 keeps the toast until the user closes it. */
  durationMs: number;
}

export type ToastInput = Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number };

const DEFAULT_DURATION_MS: Record<ToastKind, number> = {
  info: 5000,
  success: 5000,
  warning: 10000,
  error: 0,
};

/** State for a list of toasts; render it with <ToastHost />. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput): number => {
    const id = nextId.current++;
    const toast: Toast = { ...input, id, durationMs: input.durationMs ?? DEFAULT_DURATION_MS[input.kind] };
    setToasts((list) => [...list.slice(-4), toast]);
    return id;
  }, []);

  return { toasts, pushToast, dismissToast };
}

const ICONS: Record<ToastKind, React.ReactNode> = {
  info: <Info className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />,
  error: <XCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />,
};

const KIND_LABEL: Record<ToastKind, string> = {
  info: 'Aviso',
  success: 'Concluído',
  warning: 'Atenção',
  error: 'Erro',
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex items-start gap-2.5 max-w-md w-full rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur-md px-3.5 py-2.5 shadow-lg shadow-black/40 text-xs text-slate-100 animate-slide-up"
    >
      {ICONS[toast.kind]}
      <p className="flex-1 leading-relaxed">
        <span className="sr-only">{KIND_LABEL[toast.kind]}: </span>
        {toast.text}
      </p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
          className="shrink-0 px-2 py-0.5 rounded-lg border border-slate-600 font-semibold text-slate-100 hover:bg-slate-800 transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fechar aviso"
        className="shrink-0 p-0.5 rounded text-slate-400 hover:text-white"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastHost: React.FC<{ toasts: Toast[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-[calc(100%-2rem)]"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
