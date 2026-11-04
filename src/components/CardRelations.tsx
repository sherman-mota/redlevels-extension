import React, { useMemo } from 'react';
import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { STALE_DAYS } from '../services/cardHealth';
import { ChildrenRisk, childrenRisk, summarizeChildren } from '../services/childrenSummary';

const RISK_TONE: Record<ChildrenRisk['tone'], string> = {
  danger: 'text-rose-400',
  warn: 'text-amber-300',
  ok: 'text-emerald-400',
};

/** Child tasks of a tactical card: "3/8 concluídas", a progress bar, a risk label and the problem counts. */
export const ChildrenProgress: React.FC<{
  issue: RedmineIssue;
  byId: Map<number, RedmineIssue>;
  config: RedlevelsConfig;
}> = ({ issue, byId, config }) => {
  const children = issue.children ?? [];
  const parentOpen = !issue.status?.is_closed;
  const summary = useMemo(() => summarizeChildren(children, byId, config), [children, byId, config]);

  if (children.length === 0) {
    return parentOpen ? (
      <div
        className="mb-2.5 rounded-lg border border-dashed border-slate-800/80 p-1.5 text-[10px] text-slate-400"
        title="Nenhuma tarefa filha vinculada (campo tarefa pai): esta entrega ainda não foi decomposta."
      >
        <span aria-hidden="true" className="mr-1.5 text-amber-400">
          ●
        </span>
        Sem tarefas filhas
      </div>
    ) : null;
  }

  const risk = childrenRisk(summary, parentOpen);
  const pct = (n: number) => `${summary.total ? (n / summary.total) * 100 : 0}%`;
  const chips: { key: string; icon?: string; tone?: string; text: string }[] = [];
  if (summary.inProgress) chips.push({ key: 'p', text: `${summary.inProgress} em andamento` });
  if (summary.blocked) chips.push({ key: 'b', icon: '▲', tone: 'text-rose-400', text: `${summary.blocked} bloqueada(s)` });
  if (summary.overdue) chips.push({ key: 'o', icon: '▲', tone: 'text-rose-400', text: `${summary.overdue} atrasada(s)` });
  if (summary.stale) chips.push({ key: 's', icon: '●', tone: 'text-amber-300', text: `${summary.stale} parada(s) +${STALE_DAYS} d` });
  if (summary.missing) chips.push({ key: 'm', text: `${summary.missing} fora do escopo carregado` });
  const ids = children.slice(0, 10).map((c) => `#${c.id}`).join(', ') + (children.length > 10 ? '…' : '');

  return (
    <div className="mb-2.5 rounded-lg border border-slate-800/80 bg-slate-900/90 p-1.5" title={`Filhas: ${ids}`}>
      <div className="mb-1 flex items-center justify-between gap-1.5 text-[10px] text-slate-400">
        <span>
          Tarefas filhas · <strong className="text-slate-100">{summary.done}/{summary.total}</strong> concluídas
        </span>
        {risk && (
          <span className="whitespace-nowrap font-semibold text-slate-100">
            <span aria-hidden="true" className={`mr-1 ${RISK_TONE[risk.tone]}`}>
              {risk.icon}
            </span>
            {risk.label}
          </span>
        )}
      </div>
      <div className="flex h-1.5 gap-0.5" role="img" aria-label={`${summary.done} de ${summary.total} tarefas filhas concluídas`}>
        <div className="rounded-l-sm bg-blue-500" style={{ width: pct(summary.done) }} />
        <div className="bg-blue-300" style={{ width: pct(summary.inProgress) }} />
        <div className="flex-1 rounded-r-sm bg-slate-800" />
      </div>
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-300">
          {chips.map((c) => (
            <span key={c.key} className="whitespace-nowrap">
              {c.icon && (
                <span aria-hidden="true" className={`mr-0.5 ${c.tone}`}>
                  {c.icon}
                </span>
              )}
              {c.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** "↑ item pai" line of an operational card: initiative › parent, opens the parent. */
export const ParentLine: React.FC<{
  issue: RedmineIssue;
  byId: Map<number, RedmineIssue>;
  onSelectIssue: (issue: RedmineIssue) => void;
}> = ({ issue, byId, onSelectIssue }) => {
  if (!issue.parent) return null;
  const parent = byId.get(issue.parent.id);
  if (!parent) {
    return <div className="mb-2 text-[10px] text-slate-500">↑ #{issue.parent.id} (item pai fora do escopo carregado)</div>;
  }
  const initiative = String(parent.strategic_initiative ?? '').trim();
  const code = initiative ? initiative.split(':')[0].trim() : '';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelectIssue(parent);
      }}
      title={`${initiative ? `${initiative} › ` : ''}${parent.tracker.name} #${parent.id}: ${parent.subject}`}
      className="mb-2 flex w-full min-w-0 items-center gap-1 text-left text-[10px] text-blue-300"
    >
      {code && <span className="whitespace-nowrap font-semibold text-slate-300">{code} ›</span>}
      <span aria-hidden="true">↑</span>
      <span className="flex-1 truncate">
        <span className="text-slate-500">
          {parent.tracker.name} #{parent.id} ·{' '}
        </span>
        {parent.subject}
      </span>
      {parent.status && <span className="whitespace-nowrap text-slate-400">{parent.status.name}</span>}
    </button>
  );
};
