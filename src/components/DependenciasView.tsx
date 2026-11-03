import React, { useEffect, useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { STALE_DAYS } from '../services/cardHealth';
import { Dependency, DependencyGraph, groupKind, groupOf } from '../services/dependencies';
import { useDependencies } from './DependencyContext';
import { stageKeyOf } from '../services/issueStage';

interface DependenciasViewProps {
  issues: RedmineIssue[];
  config: RedlevelsConfig;
  onSelectIssue: (issue: RedmineIssue) => void;
  /** Publishes the issues shown (blockers and who waits for them), used by the CSV export. */
  onVisibleIssuesChange?: (issues: RedmineIssue[]) => void;
}

const CARD = 'rounded-2xl border border-slate-800 bg-slate-900/80 p-4';
const MATRIX_MAX_GROUPS = 7;

type FilterKey = 'todas' | 'cross' | 'parado' | 'atraso' | 'conflito' | 'fora';

const TAG_TONE = {
  danger: 'border-rose-800/80 bg-rose-950/40 text-rose-300',
  warn: 'border-amber-800/80 bg-amber-950/30 text-amber-300',
  neutral: 'border-slate-700 bg-slate-800/60 text-slate-300',
  ok: 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300',
};

type Tone = keyof typeof TAG_TONE;

export const Tag: React.FC<{ tone: Tone; icon: string; children: React.ReactNode }> = ({ tone, icon, children }) => (
  <span
    className={`inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] font-bold whitespace-nowrap ${TAG_TONE[tone]}`}
  >
    <span aria-hidden="true" className="text-[9px]">
      {icon}
    </span>
    {children}
  </span>
);

const dueLabel = (issue: RedmineIssue | null) =>
  issue?.due_date ? `Prazo ${issue.due_date.slice(8, 10)}/${issue.due_date.slice(5, 7)}` : 'sem prazo';

/** Tags that explain why the blocker is a problem (`side` 'blocker') or why the waiting issue is at risk ('waiting'). */
export const DependencyTags: React.FC<{ edge: Dependency; side: 'blocker' | 'waiting'; groupLabel: string }> = ({
  edge,
  side,
  groupLabel,
}) => (
  <>
    {side === 'blocker' && edge.blockerOutOfScope && (
      <Tag tone="neutral" icon="●">
        Fora do escopo carregado
      </Tag>
    )}
    {side === 'blocker' && edge.overdueDays > 0 && (
      <Tag tone="danger" icon="▲">
        Atrasado {edge.overdueDays} d
      </Tag>
    )}
    {side === 'blocker' && edge.blocker && edge.stalledDays >= STALE_DAYS && (
      <Tag tone="warn" icon="●">
        Parado {edge.stalledDays} d
      </Tag>
    )}
    {side === 'blocker' && edge.blockerUnassigned && (
      <Tag tone="warn" icon="●">
        Sem responsável
      </Tag>
    )}
    {side === 'waiting' && edge.deadlineConflict && (
      <Tag tone="danger" icon="▲">
        Prazo antes do bloqueador
      </Tag>
    )}
    {side === 'waiting' && edge.crossGroup && (
      <Tag tone="warn" icon="●">
        {groupLabel}
      </Tag>
    )}
  </>
);

const Tile: React.FC<{ label: string; value: number; note: string; tone?: 'warn' | 'danger' }> = ({ label, value, note, tone }) => (
  <div className={`${CARD} !p-3`}>
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="mt-1 font-mono text-2xl font-extrabold text-slate-50">{value}</div>
    <div
      className={`mt-0.5 text-[11px] ${value > 0 && tone === 'danger' ? 'text-rose-300' : value > 0 && tone === 'warn' ? 'text-amber-300' : 'text-slate-500'}`}
    >
      {value === 0 && tone ? '✓ nenhum' : note}
    </div>
  </div>
);

const FILTERS: { key: FilterKey; label: (kind: string) => string; icon: string; test: (e: Dependency) => boolean }[] = [
  { key: 'todas', label: () => 'Todas', icon: '', test: () => true },
  { key: 'cross', label: (kind) => `Entre ${kind}s`, icon: '●', test: (e) => e.crossGroup },
  { key: 'parado', label: () => 'Bloqueador parado', icon: '●', test: (e) => !!e.blocker && e.stalledDays >= STALE_DAYS },
  { key: 'atraso', label: () => 'Bloqueador atrasado', icon: '▲', test: (e) => !!e.blocker && e.overdueDays > 0 },
  { key: 'conflito', label: () => 'Conflito de prazo', icon: '▲', test: (e) => e.deadlineConflict },
  { key: 'fora', label: () => 'Fora do escopo', icon: '●', test: (e) => e.blockerOutOfScope },
];

interface BlockerGroup {
  id: number;
  blocker: RedmineIssue | null;
  edges: Dependency[];
  score: number;
}

const Matrix: React.FC<{ graph: DependencyGraph; config: RedlevelsConfig; kind: string }> = ({ graph, config, kind }) => {
  const { cells, groups, truncated } = useMemo(() => {
    const cells = new Map<string, number>();
    const totals = new Map<string, number>();
    graph.active
      .filter((e) => e.blocker && e.waiting)
      .forEach((e) => {
        const row = groupOf(e.waiting!, config);
        const col = groupOf(e.blocker!, config);
        cells.set(`${row}|${col}`, (cells.get(`${row}|${col}`) ?? 0) + 1);
        totals.set(row, (totals.get(row) ?? 0) + 1);
        totals.set(col, (totals.get(col) ?? 0) + 1);
      });
    const groups = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MATRIX_MAX_GROUPS)
      .map(([name]) => name);
    return { cells, groups, truncated: totals.size > MATRIX_MAX_GROUPS };
  }, [graph, config]);

  if (groups.length === 0) return null;
  return (
    <div className={`${CARD} overflow-x-auto`}>
      <div className="text-[13px] font-bold text-slate-50">Quem espera quem</div>
      <div className="mb-2.5 mt-0.5 text-[11px] text-slate-500">
        Linhas: {kind}s que aguardam. Colunas: {kind}s que bloqueiam. Fora da diagonal = dependência entre {kind}s.
        {truncated && ` Mostrando os ${MATRIX_MAX_GROUPS} mais envolvidos.`}
      </div>
      <table className="border-separate text-xs" style={{ borderSpacing: 3 }} aria-label={`Dependências entre ${kind}s`}>
        <thead>
          <tr>
            <th className="px-1.5 py-1 text-left text-[11px] font-bold text-slate-400">Aguarda ↓ · Bloqueia →</th>
            {groups.map((c) => (
              <th key={c} title={c} className="max-w-[120px] truncate px-1.5 py-1 text-[11px] font-bold text-slate-400">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((r) => (
            <tr key={r}>
              <th title={r} className="max-w-[160px] truncate px-1.5 py-1 text-left text-[11px] font-bold text-slate-400">
                {r}
              </th>
              {groups.map((c) => {
                const n = cells.get(`${r}|${c}`) ?? 0;
                const diagonal = r === c;
                const tone = n === 0 ? 'bg-slate-950/60 text-slate-600' : diagonal ? 'bg-slate-800 text-slate-300' : 'bg-amber-950/50 text-amber-300';
                return (
                  <td key={c} className="min-w-[64px]">
                    <div
                      title={`${n} tarefa(s) de "${r}" aguardam "${c}"`}
                      className={`rounded-md px-2 py-1.5 text-center font-mono font-bold ${tone}`}
                    >
                      {!diagonal && n > 0 && (
                        <span aria-hidden="true" className="mr-1 text-[9px]">
                          ●
                        </span>
                      )}
                      {n}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const DependenciasView: React.FC<DependenciasViewProps> = ({ issues, config, onSelectIssue, onVisibleIssuesChange }) => {
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [query, setQuery] = useState('');
  const graph = useDependencies();
  const kind = groupKind(config);
  const kindOther = kind === 'equipe' ? 'outra equipe' : 'outro projeto';
  const k = graph.kpis;
  const openCount = useMemo(() => issues.filter((i) => stageKeyOf(i, config) !== 'done').length, [issues, config]);

  const blockers = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const q = query.trim().toLowerCase();
    const matches = (e: Dependency) =>
      !q ||
      [e.blockerId, e.waitingId, e.blocker?.subject, e.waiting?.subject, e.blocker?.assigned_to?.name, e.waiting?.assigned_to?.name]
        .join(' ')
        .toLowerCase()
        .includes(q);
    const byBlocker = new Map<number, BlockerGroup>();
    graph.active
      .filter((e) => test(e) && matches(e))
      .forEach((e) => {
        const g = byBlocker.get(e.blockerId) ?? { id: e.blockerId, blocker: e.blocker, edges: [], score: 0 };
        g.edges.push(e);
        g.score = Math.max(g.score, e.score);
        byBlocker.set(e.blockerId, g);
      });
    return [...byBlocker.values()].sort((a, b) => b.score - a.score || b.edges.length - a.edges.length || a.id - b.id);
  }, [graph, filter, query]);

  const shown = useMemo(() => {
    const seen = new Set<number>();
    const out: RedmineIssue[] = [];
    const add = (i: RedmineIssue | null) => {
      if (i && !seen.has(i.id)) {
        seen.add(i.id);
        out.push(i);
      }
    };
    blockers.forEach((b) => {
      add(b.blocker);
      b.edges.forEach((e) => add(e.waiting));
    });
    return out;
  }, [blockers]);

  useEffect(() => {
    onVisibleIssuesChange?.(shown);
    return () => onVisibleIssuesChange?.([]);
  }, [shown, onVisibleIssuesChange]);

  const noRelations = k.relations === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-50">
          <Link2 className="w-5 h-5 text-rose-400" /> Dependências
        </h1>
        <p className="mt-0.5 max-w-[75ch] text-xs text-slate-400">
          Quem está esperando quem. Lê as relações "Bloqueia" e "Precede" do Redmine entre tarefas abertas; uma dependência fica
          ativa enquanto quem bloqueia não for concluído.
        </p>
      </div>

      {noRelations ? (
        <div className={CARD}>
          <div className="text-[13px] font-bold text-slate-50">Nenhuma relação encontrada</div>
          <div className="mt-1 text-xs text-slate-400">
            Cadastre relações "Bloqueia" ou "Precede" entre as tarefas no Redmine (aba Tarefas relacionadas). A extensão as lê na
            sincronização; se você acabou de atualizar a extensão, use <b>Sincronizar › Carga completa</b> uma vez.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
            <Tile
              label="Aguardando outra tarefa"
              value={k.waiting}
              tone="warn"
              note={`● ${openCount ? Math.round((k.waiting / openCount) * 100) : 0}% das ${openCount} abertas`}
            />
            <Tile label={`Entre ${kind}s`} value={k.crossGroup} tone="warn" note={`● dependem de ${kindOther}`} />
            <Tile label="Bloqueadores parados" value={k.stalledBlockers} tone="warn" note={`● sem atualização há ${STALE_DAYS}+ dias`} />
            <Tile label="Bloqueadores atrasados" value={k.overdueBlockers} tone="danger" note="▲ prazo vencido" />
            <Tile label="Conflitos de prazo" value={k.deadlineConflicts} tone="danger" note="▲ bloqueador vence depois" />
            <Tile label="Fora do escopo" value={k.outOfScope} note="bloqueador não está nos dados carregados" />
          </div>

          <Matrix graph={graph} config={config} kind={kind} />

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros de dependências">
            {FILTERS.map((f) => {
              const n = graph.active.filter(f.test).length;
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
                    on ? 'border-rose-500 bg-rose-950/50 text-rose-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  } ${n === 0 && !on ? 'opacity-50' : ''}`}
                >
                  {f.icon && (
                    <span aria-hidden="true" className="text-[9px]">
                      {f.icon}
                    </span>
                  )}
                  {f.label(kind)}
                  <span className="font-mono text-slate-400">{n}</span>
                </button>
              );
            })}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tarefa, #ID ou responsável…"
              aria-label="Buscar dependências"
              className="ml-auto h-8 min-w-[200px] rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-xs text-slate-200"
            />
          </div>

          {blockers.length === 0 ? (
            <div className={`${CARD} text-xs text-slate-400`}>
              {graph.active.length
                ? 'Nenhuma dependência com esses filtros.'
                : '✓ Nenhuma dependência ativa: nenhuma tarefa aberta aguarda outra.'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {blockers.map((b) => {
                const danger = b.edges.some((e) => e.overdueDays > 0 || e.stalledDays >= STALE_DAYS || e.deadlineConflict);
                const warn = b.edges.some((e) => e.crossGroup || e.blockerOutOfScope || e.blockerUnassigned);
                const border = danger ? 'border-l-rose-500' : warn ? 'border-l-amber-400' : 'border-l-slate-600';
                const A = b.blocker;
                return (
                  <section
                    key={b.id}
                    aria-label={`Bloqueador #${b.id}`}
                    className={`overflow-hidden rounded-xl border border-l-4 border-slate-800 bg-slate-900/80 ${border}`}
                  >
                    <button
                      type="button"
                      disabled={!A}
                      onClick={() => A && onSelectIssue(A)}
                      title={A ? `Abrir #${b.id}` : 'Fora do escopo carregado'}
                      className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b border-slate-800 bg-slate-900 px-3.5 py-2.5 text-left enabled:hover:bg-slate-800"
                    >
                      <span className="font-mono text-[11.5px] font-bold text-slate-400">#{b.id}</span>
                      <span className="min-w-[200px] flex-1 text-[13px] font-bold text-slate-100">
                        {A ? A.subject : '(fora do escopo carregado)'}
                      </span>
                      {A?.status && <span className="text-[11.5px] text-slate-500">{A.status.name}</span>}
                      {A && <span className="text-[11.5px] text-slate-500">{A.assigned_to ? A.assigned_to.name : 'Sem responsável'}</span>}
                      {A && <span className="text-[11.5px] text-slate-500">{groupOf(A, config)}</span>}
                      {A && <span className="text-[11.5px] text-slate-500">{dueLabel(A)}</span>}
                      <DependencyTags edge={b.edges[0]} side="blocker" groupLabel={kindOther} />
                      <Tag tone="neutral" icon="⛓">
                        bloqueia {b.edges.length}
                      </Tag>
                    </button>
                    {[...b.edges]
                      .sort((x, y) => y.score - x.score)
                      .map((e) => (
                        <button
                          key={e.waitingId}
                          type="button"
                          disabled={!e.waiting}
                          onClick={() => e.waiting && onSelectIssue(e.waiting)}
                          title={e.waiting ? `Abrir #${e.waitingId}` : 'Fora do escopo carregado'}
                          className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-800/70 py-2 pl-7 pr-3.5 text-left text-[12.5px] text-slate-300 first:border-t-0 enabled:hover:bg-slate-800/60"
                        >
                          <span className="font-mono text-[11.5px] font-bold text-slate-400">↳ #{e.waitingId}</span>
                          <span className="min-w-[180px] flex-1 font-semibold text-slate-100">
                            {e.waiting ? e.waiting.subject : '(fora do escopo carregado)'}
                          </span>
                          <span className="text-[11.5px] text-slate-500">
                            {e.waiting?.assigned_to ? e.waiting.assigned_to.name : 'Sem responsável'}
                          </span>
                          {e.waiting && <span className="text-[11.5px] text-slate-500">{groupOf(e.waiting, config)}</span>}
                          {e.waiting && <span className="text-[11.5px] text-slate-500">{dueLabel(e.waiting)}</span>}
                          <DependencyTags edge={e} side="waiting" groupLabel={kindOther.replace(/^./, (c) => c.toUpperCase())} />
                        </button>
                      ))}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
