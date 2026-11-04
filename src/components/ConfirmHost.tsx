import React, { useEffect, useRef, useState } from 'react';

/** What the confirmation shows; every field is optional except the title. */
export interface ConfirmRequest {
  title: string;
  /** "#12 — subject" */
  issue?: string;
  /** What changes, one line each. */
  changes?: string[];
  user?: string;
  server?: string;
  warning?: string | null;
  confirmLabel?: string;
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

let pending: Pending | null = null;
const listeners = new Set<(p: Pending | null) => void>();
const emit = () => listeners.forEach((fn) => fn(pending));

/** Opens the confirmation and resolves with the answer. A second request while one is open is refused. */
export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    if (pending) {
      resolve(false);
      return;
    }
    pending = { ...request, resolve };
    emit();
  });
}

function answer(ok: boolean) {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(ok);
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-2 py-0.5 text-xs">
    <span className="min-w-[88px] text-slate-500">{label}</span>
    <span className="flex-1 break-words text-slate-200">{children}</span>
  </div>
);

/** Renders the pending confirmation. Mount it once, near the root. Focus starts on "Cancelar". */
export const ConfirmHost: React.FC = () => {
  const [current, setCurrent] = useState<Pending | null>(pending);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(pending);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        answer(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/75 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) answer(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-write-title"
        className="w-full max-w-[460px] rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-200 shadow-2xl"
      >
        <div id="confirm-write-title" className="mb-2.5 text-[15px] font-bold text-slate-50">
          {current.title}
        </div>
        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
          {current.issue && <Row label="Tarefa">{current.issue}</Row>}
          {(current.changes ?? []).map((line, i) => (
            <Row key={i} label={i === 0 && current.issue ? 'Mudança' : ''}>
              {line}
            </Row>
          ))}
          {current.user && <Row label="Gravando como">{current.user}</Row>}
          {current.server && <Row label="Servidor">{current.server}</Row>}
        </div>
        {current.warning && (
          <div className="mb-3 text-xs leading-snug text-slate-300">
            <span aria-hidden="true" className="mr-1.5 text-amber-400">
              ●
            </span>
            {current.warning}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => answer(false)}
            className="rounded-lg border border-slate-600 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
          >
            {current.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};
