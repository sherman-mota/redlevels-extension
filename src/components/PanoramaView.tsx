import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import type { RedlevelsConfig, RedmineIssue, TabKey } from '../types/redmine';
import { DependencyStrip } from './DependencyLinks';
import type { AttentionKey } from '../services/attentionFilters';
import { LEVEL_LABEL, LEVEL_QUESTION, LevelKey, LevelsOverview, ProblemTag, verdictOf } from '../services/levelHealth';

interface PanoramaViewProps {
  issues: RedmineIssue[];
  overview: LevelsOverview;
  config: RedlevelsConfig;
  onSelectTab: (tab: TabKey) => void;
  /** Opens Operacional or Tático with these attention shortcuts already on. */
  onOpenFiltered: (level: 'operacional' | 'tatico', keys: AttentionKey[]) => void;
  onSelectIssue: (issue: RedmineIssue) => void;
}

const WORST_SHOWN = 3;

const VERDICT_TONE = {
  problema: 'border-rose-800/80 bg-rose-950/40 text-rose-300',
  atencao: 'border-amber-800/80 bg-amber-950/30 text-amber-300',
  ok: 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300',
};

const TAG_TONE = {
  danger: 'border-rose-800/80 bg-rose-950/40 text-rose-300',
  warn: 'border-amber-800/80 bg-amber-950/30 text-amber-300',
};

const Tag: React.FC<{ tag: ProblemTag }> = ({ tag }) => (
  <span
    className={`inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] font-bold whitespace-nowrap ${TAG_TONE[tag.tone]}`}
  >
    <span aria-hidden="true" className="text-[9px]">
      {tag.icon}
    </span>
    {tag.label}
  </span>
);

interface Row {
  key: string | number;
  title: string;
  id?: number;
  tags: ProblemTag[];
  meta: string;
  issue?: RedmineIssue;
}

const LevelCard: React.FC<{
  level: LevelKey;
  overview: LevelsOverview;
  rows: Row[];
  totalProblems: number;
  onOpenTab: () => void;
  onOpenIssue: (issue: RedmineIssue) => void;
  /** Only for Operacional and Tático. */
  onShortcut?: (key: AttentionKey) => void;
}> = ({ level, overview, rows, totalProblems, onOpenTab, onOpenIssue, onShortcut }) => {
  const name = LEVEL_LABEL[level];
  const verdict = verdictOf(level, overview.levels[level]);
  return (
    <section aria-label={`${name}: ${verdict.label}`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-400">{name}</div>
        <div className="mt-0.5 text-xs text-slate-400">{LEVEL_QUESTION[level]}</div>
      </div>

      <div role="status" className={`flex flex-col gap-0.5 rounded-xl border border-l-4 px-3 py-2 ${VERDICT_TONE[verdict.state]}`}>
        <div className="text-sm font-extrabold">
          <span aria-hidden="true" className="mr-1.5">
            {verdict.icon}
          </span>
          {verdict.label}
        </div>
        <div className="text-xs leading-snug text-slate-300">{verdict.detail}</div>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {level === 'estrategico' ? 'Iniciativas em risco' : 'Piores itens'}
          </div>
          {rows.map((row) => {
            const content = (
              <>
                <div className="flex min-w-0 items-baseline gap-2">
                  {row.id !== undefined && <span className="shrink-0 font-mono text-[11px] font-bold text-slate-400">#{row.id}</span>}
                  <span className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-100">{row.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  {row.tags.map((t) => (
                    <Tag key={t.label} tag={t} />
                  ))}
                  <span>{row.meta}</span>
                </div>
              </>
            );
            const cls = `flex w-full flex-col gap-1.5 rounded-lg border border-slate-800 border-l-4 px-2.5 py-2 text-left bg-slate-950/50 ${
              row.tags[0]?.tone === 'danger' ? 'border-l-rose-500' : 'border-l-amber-400'
            }`;
            return row.issue ? (
              <button key={row.key} type="button" onClick={() => onOpenIssue(row.issue!)} className={`${cls} hover:border-slate-600`}>
                {content}
              </button>
            ) : (
              <div key={row.key} className={cls}>
                {content}
              </div>
            );
          })}
          {totalProblems > rows.length && (
            <div className="px-0.5 text-xs text-slate-400">+ {totalProblems - rows.length} outro(s) com alerta</div>
          )}
        </div>
      ) : (
        <div className="px-0.5 py-1 text-xs text-slate-400">✓ Nada exige atenção neste nível.</div>
      )}

      {onShortcut && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Abrir ${name} já filtrado`}>
          {(
            [
              ['blocked', '▲', 'bloqueada(s)', overview.levels[level].blocked, 'danger'],
              ['late', '▲', 'atrasada(s)', overview.levels[level].overdue, 'danger'],
              ['stale', '●', 'parada(s)', overview.levels[level].stale, 'warn'],
            ] as const
          )
            .filter(([, , , n]) => n > 0)
            .map(([key, icon, label, n, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => onShortcut(key)}
                title={`Abrir ${name} mostrando só as ${label}`}
                className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-bold hover:brightness-125 ${TAG_TONE[tone]}`}
              >
                <span aria-hidden="true" className="text-[9px]">
                  {icon}
                </span>
                {n} {label}
              </button>
            ))}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenTab}
        className="self-start rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        Abrir {name} →
      </button>
    </section>
  );
};

export const PanoramaView: React.FC<PanoramaViewProps> = ({ issues, overview, config, onSelectTab, onOpenFiltered, onSelectIssue }) => {
  const issueRows = (level: 'operacional' | 'tatico'): Row[] =>
    overview.worst[level].slice(0, WORST_SHOWN).map(({ issue, tags }) => ({
      key: issue.id,
      id: issue.id,
      title: issue.subject,
      tags,
      meta: issue.assigned_to ? issue.assigned_to.name : 'Sem responsável',
      issue,
    }));

  const initiativeRows: Row[] = overview.initiatives.slice(0, WORST_SHOWN).map((x) => ({
    key: x.name,
    title: x.name,
    tags: [
      ...(x.atRisk ? [{ tone: 'danger' as const, icon: '▲' as const, label: `${x.atRisk} entrega(s) em risco` }] : []),
      ...(x.stale ? [{ tone: 'warn' as const, icon: '●' as const, label: `${x.stale} parada(s)` }] : []),
    ],
    meta: `de ${x.total} entrega(s) tática(s)`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-50">
          <LayoutDashboard className="w-5 h-5 text-rose-400" /> Panorama
        </h1>
        <p className="mt-0.5 max-w-[70ch] text-xs text-slate-400">
          Como estão os três níveis? Clique em um item para abrir a tarefa, ou em "Abrir" para ir ao painel do nível.
        </p>
      </div>

      {issues.length === 0 ? (
        <div className="text-xs text-slate-400">Nenhuma tarefa carregada ainda. Sincronize ou confira os trackers em Configuração.</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <LevelCard
            level="operacional"
            overview={overview}
            rows={issueRows('operacional')}
            totalProblems={overview.worst.operacional.length}
            onOpenTab={() => onSelectTab('operacional')}
            onShortcut={(key) => onOpenFiltered('operacional', [key])}
            onOpenIssue={onSelectIssue}
          />
          <LevelCard
            level="tatico"
            overview={overview}
            rows={issueRows('tatico')}
            totalProblems={overview.worst.tatico.length}
            onOpenTab={() => onSelectTab('tatico')}
            onShortcut={(key) => onOpenFiltered('tatico', [key])}
            onOpenIssue={onSelectIssue}
          />
          <LevelCard
            level="estrategico"
            overview={overview}
            rows={initiativeRows}
            totalProblems={overview.initiatives.length}
            onOpenTab={() => onSelectTab('estrategico')}
            onOpenIssue={onSelectIssue}
          />
        </div>
      )}

      <DependencyStrip config={config} onSelectTab={onSelectTab} />
    </div>
  );
};
