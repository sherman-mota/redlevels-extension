import React from 'react';
import { Link2 } from 'lucide-react';
import type { RedlevelsConfig, RedmineIssue, TabKey } from '../types/redmine';
import { Dependency, groupKind } from '../services/dependencies';
import { useDependencies } from './DependencyContext';
import { DependencyTags, Tag } from './DependenciasView';

/** "Aguarda #12" / "Bloqueia 3" on a card; the icon always goes with the text. */
export const DependencyPills: React.FC<{ issue: RedmineIssue; compact?: boolean }> = ({ issue, compact = false }) => {
  const graph = useDependencies();
  const waits = graph.waitingOn.get(issue.id) ?? [];
  const blocks = graph.blocking.get(issue.id) ?? [];
  if (!waits.length && !blocks.length) return null;

  const waitsTitle = `Depende de: ${waits
    .map((e) => `#${e.blockerId}${e.blocker ? ` ${e.blocker.subject}` : ' (fora do escopo carregado)'}`)
    .join('; ')}`;
  const blocksTitle = `Outras tarefas esperam por esta: ${blocks.map((e) => `#${e.waitingId}`).join(', ')}`;

  if (compact) {
    return (
      <span
        className="text-[10px] font-mono text-amber-300"
        title={[waits.length ? waitsTitle : '', blocks.length ? blocksTitle : ''].filter(Boolean).join(' · ')}
      >
        <span aria-hidden="true">⛓ </span>
        {waits.length ? 'aguarda' : 'bloqueia'}
      </span>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-mono">
      {waits.length > 0 && (
        <span className="text-amber-300" title={waitsTitle}>
          <span aria-hidden="true">⛓ </span>
          {waits.length === 1 ? `Aguarda #${waits[0].blockerId}` : `Aguarda ${waits.length}`}
        </span>
      )}
      {blocks.length > 0 && (
        <span className="text-sky-300" title={blocksTitle}>
          <span aria-hidden="true">⛓ </span>Bloqueia {blocks.length}
        </span>
      )}
    </div>
  );
};

/** "Dependências" section of the issue detail: what it waits for and what waits for it. */
export const DependencySection: React.FC<{ issue: RedmineIssue; onOpenIssue?: (id: number) => void }> = ({
  issue,
  onOpenIssue,
}) => {
  const graph = useDependencies();
  const entry = graph.byIssue.get(issue.id);
  if (!entry || (!entry.waits.length && !entry.blocks.length)) return null;

  const row = (e: Dependency, side: 'waits' | 'blocks') => {
    const id = side === 'waits' ? e.blockerId : e.waitingId;
    const other = side === 'waits' ? e.blocker : e.waiting;
    return (
      <button
        key={`${side}${id}`}
        type="button"
        disabled={!other}
        onClick={() => other && onOpenIssue?.(id)}
        title={other ? `Abrir #${id}` : 'Fora do escopo carregado'}
        className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-800/70 py-2 text-left text-[12.5px] text-slate-300 enabled:hover:bg-slate-800/60"
      >
        <span className="font-mono text-[11.5px] font-bold text-slate-400">#{id}</span>
        <span className="min-w-[160px] flex-1 font-semibold text-slate-100">
          {other ? other.subject : '(fora do escopo carregado)'}
        </span>
        {other?.status && <span className="text-[11.5px] text-slate-500">{other.status.name}</span>}
        {other?.assigned_to && <span className="text-[11.5px] text-slate-500">{other.assigned_to.name}</span>}
        {!e.active && (
          <Tag tone="ok" icon="✓">
            Resolvida
          </Tag>
        )}
        {e.active && side === 'waits' && <DependencyTags edge={e} side="blocker" groupLabel="" />}
      </button>
    );
  };

  const block = (title: string, list: Dependency[], side: 'waits' | 'blocks') =>
    list.length > 0 && (
      <div className="mt-2.5">
        <h5 className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{title}</h5>
        {list.map((e) => row(e, side))}
      </div>
    );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
      <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
        <Link2 className="w-3.5 h-3.5" /> Dependências
      </h4>
      {block('Esta tarefa aguarda', entry.waits, 'waits')}
      {block('Esta tarefa bloqueia', entry.blocks, 'blocks')}
    </div>
  );
};

/** One-line summary on the Panorama, with a shortcut to the Dependências tab. */
export const DependencyStrip: React.FC<{ config: RedlevelsConfig; onSelectTab: (tab: TabKey) => void }> = ({
  config,
  onSelectTab,
}) => {
  const k = useDependencies().kpis;
  if (!k.relations) return null;
  const kind = groupKind(config);
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-[12.5px] text-slate-300"
    >
      <Link2 className="w-4 h-4 text-slate-400" />
      {k.waiting ? (
        <span>
          <b className="font-mono text-slate-50">{k.waiting}</b> tarefa(s) aguardam outra tarefa
        </span>
      ) : (
        <span className="font-bold text-emerald-400">✓ Nenhuma dependência ativa</span>
      )}
      {k.crossGroup > 0 && (
        <span>
          <b className="font-mono text-slate-50">{k.crossGroup}</b> entre {kind}s
        </span>
      )}
      {k.stalledBlockers > 0 && (
        <span>
          <b className="font-mono text-slate-50">{k.stalledBlockers}</b> bloqueador(es) parado(s)
        </span>
      )}
      {k.overdueBlockers > 0 && (
        <span>
          <b className="font-mono text-slate-50">{k.overdueBlockers}</b> bloqueador(es) atrasado(s)
        </span>
      )}
      <button
        type="button"
        onClick={() => onSelectTab('dependencias')}
        className="ml-auto rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        Abrir Dependências →
      </button>
    </div>
  );
};
