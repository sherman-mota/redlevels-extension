import React, { useEffect, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import type { RedmineUser } from '../types/redmine';
import { LOCK_MINUTES, hostOf, isUnlocked, lockEdit, subscribeLock, unlockEdit, unlockMinutesLeft, userLabel } from '../services/writeGuard';
import { askConfirm } from './ConfirmHost';

interface EditLockButtonProps {
  user?: RedmineUser;
  redmineUrl: string;
  /** Short message (toast) after locking or unlocking. */
  onNotify: (kind: 'info' | 'warning', text: string) => void;
}

/** Safe edit mode: padlock of the topbar. Read-only until the user unlocks it on purpose. */
export const EditLockButton: React.FC<EditLockButtonProps> = ({ user, redmineUrl, onNotify }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const refresh = () => tick((n) => n + 1);
    const unsubscribe = subscribeLock(refresh);
    const timer = setInterval(refresh, 15_000); // also notices the automatic relock
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const unlocked = isUnlocked();
  const minutes = unlockMinutesLeft();

  const onClick = async () => {
    if (unlocked) {
      lockEdit();
      onNotify('info', 'Edição bloqueada novamente (somente leitura).');
      return;
    }
    const ok = await askConfirm({
      title: 'Liberar a edição?',
      changes: ['O app passa a poder alterar tarefas no Redmine.', 'Cada alteração ainda pede confirmação.'],
      user: userLabel(user),
      server: hostOf(redmineUrl),
      warning: `A edição volta a bloquear sozinha após ${LOCK_MINUTES} minutos sem gravações.`,
      confirmLabel: 'Liberar edição',
    });
    if (ok) {
      unlockEdit();
      onNotify('warning', `Edição liberada por ${LOCK_MINUTES} min. Cada gravação pedirá confirmação.`);
    }
  };

  const Icon = unlocked ? LockOpen : Lock;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={unlocked}
      className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-slate-800/80 ${
        unlocked ? 'border-amber-400 text-amber-200' : 'border-slate-500/40 text-slate-300'
      }`}
      title={
        unlocked
          ? `Edição liberada por mais ${minutes} min. Clique para bloquear agora.`
          : 'Somente leitura: nada é gravado no Redmine. Clique para liberar a edição.'
      }
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{unlocked ? `Edição liberada · ${minutes} min` : 'Somente leitura'}</span>
    </button>
  );
};
