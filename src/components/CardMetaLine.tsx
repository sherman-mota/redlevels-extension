import React from 'react';
import { RedmineIssue } from '../types/redmine';
import { cardMeta, STALE_DAYS } from '../services/cardHealth';

interface CardMetaLineProps {
  issue: RedmineIssue;
  /** Compact version used by the "Light" view. */
  compact?: boolean;
}

/**
 * Age, "Parada N d" and due date of a card. An icon always accompanies the text so the alert never
 * depends on color alone (▲ = needs action, ● = keep an eye on it).
 */
export const CardMetaLine: React.FC<CardMetaLineProps> = ({ issue, compact = false }) => {
  const { ageDays, staleDays, due } = cardMeta(issue);
  const dueAlert = due?.kind === 'overdue' ? '▲' : due?.kind === 'today' || due?.kind === 'soon' ? '●' : null;
  const dueTone =
    due?.kind === 'overdue' ? 'text-rose-300' : dueAlert ? 'text-amber-300' : 'text-slate-400';

  const title = [
    ageDays !== null ? `Criada há ${ageDays} dia(s)` : null,
    staleDays !== null ? `Sem atualização há ${staleDays} dia(s) (a partir de ${STALE_DAYS})` : null,
    due ? `${due.label}${issue.due_date ? ` (${issue.due_date.slice(0, 10).split('-').reverse().join('/')})` : ''}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  if (ageDays === null && !staleDays && !due) return null;

  if (compact) {
    const alert = dueAlert === '▲' ? '▲' : dueAlert || staleDays !== null ? '●' : '';
    return (
      <span
        className={`text-[10px] font-mono ${due?.kind === 'overdue' ? 'text-rose-300' : alert ? 'text-amber-300' : 'text-slate-500'}`}
        title={title}
      >
        {alert && <span aria-hidden="true">{alert} </span>}
        {ageDays !== null ? `${ageDays}d` : ''}
      </span>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono" title={title}>
      {ageDays !== null && <span className="text-slate-500">{ageDays} d</span>}
      {staleDays !== null && (
        <span className="text-amber-300">
          <span aria-hidden="true">● </span>Parada {staleDays} d
        </span>
      )}
      {due && (
        <span className={dueTone}>
          {dueAlert && <span aria-hidden="true">{dueAlert} </span>}
          {due.label}
        </span>
      )}
    </div>
  );
};
