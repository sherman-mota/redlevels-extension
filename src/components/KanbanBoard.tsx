import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Focus, Loader2 } from 'lucide-react';
import { KanbanColumnKey, RedmineIssue, RedmineStatus, StatusMapping, WipLimits } from '../types/redmine';
import { normalizeStatusMapping } from '../services/storage';
import { CardMetaLine } from './CardMetaLine';
import { DependencyPills } from './DependencyLinks';
import { cardHealth } from '../services/cardHealth';
import { limitState } from '../services/flowMetrics';

export const COLUMN_META: Record<KanbanColumnKey, { label: string; dot: string; chip: string }> = {
  backlog: { label: 'Backlog', dot: 'bg-slate-400', chip: 'bg-slate-800 text-slate-300 border-slate-700' },
  analysis: { label: 'Em Análise', dot: 'bg-blue-400', chip: 'bg-blue-950/60 text-blue-300 border-blue-800/60' },
  in_progress: { label: 'Em Andamento', dot: 'bg-amber-400', chip: 'bg-amber-950/60 text-amber-300 border-amber-800/60' },
  done: { label: 'Concluído', dot: 'bg-emerald-400', chip: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' },
};
const COLUMN_ORDER: KanbanColumnKey[] = ['backlog', 'analysis', 'in_progress', 'done'];
const PAGE = 40;

const FOCUS_STORAGE_KEY = 'redlevels_kanban_focus_problems';

/** "Focus on problems" switch, remembered between sessions. */
export function useFocusProblems(): [boolean, (value: boolean) => void] {
  const [focus, setFocus] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FOCUS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const update = (value: boolean) => {
    setFocus(value);
    try {
      localStorage.setItem(FOCUS_STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  };
  return [focus, update];
}

export const FocusProblemsToggle: React.FC<{ active: boolean; onChange: (value: boolean) => void }> = ({
  active,
  onChange,
}) => (
  <button
    type="button"
    onClick={() => onChange(!active)}
    aria-pressed={active}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-colors shadow-sm ${
      active
        ? 'bg-rose-950/60 border-rose-700/80 text-rose-200'
        : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
    }`}
    title="Esmaece os cards sem problema (bloqueados ou atrasados continuam em destaque); passe o mouse sobre um card esmaecido para vê-lo normal"
  >
    <Focus className="w-3.5 h-3.5 text-rose-400" />
    <span>Foco em problemas{active ? ': ligado' : ''}</span>
  </button>
);

export interface BoardColumn {
  status: RedmineStatus;
  category?: KanbanColumnKey;
}

/** Orders statuses by the configured Kanban mapping and optional custom user order. */
export function buildColumns(
  statuses: RedmineStatus[],
  mapping: StatusMapping,
  issues: RedmineIssue[],
  customOrder?: number[]
): BoardColumn[] {
  const norm = normalizeStatusMapping(mapping);
  const categoryOf = new Map<number, KanbanColumnKey>();
  COLUMN_ORDER.forEach((key) => (norm[key] || []).forEach((id) => categoryOf.set(id, key)));
  const hasMapping = statuses.some((s) => categoryOf.has(s.id));
  if (!hasMapping && (!customOrder || customOrder.length === 0)) {
    return statuses.map((status) => ({ status }));
  }

  const used = new Set(issues.map((i) => i.status.id));
  const mapped = statuses
    .filter((s) => categoryOf.has(s.id))
    .sort((a, b) => COLUMN_ORDER.indexOf(categoryOf.get(a.id)!) - COLUMN_ORDER.indexOf(categoryOf.get(b.id)!));
  // Unmapped statuses are only shown when they hold issues, so nothing silently disappears.
  const extra = statuses.filter((s) => !categoryOf.has(s.id) && used.has(s.id));
  const defaultCols: BoardColumn[] = [
    ...mapped.map((status) => ({ status, category: categoryOf.get(status.id) })),
    ...extra.map((status) => ({ status })),
  ];

  if (customOrder && customOrder.length > 0) {
    const colMap = new Map<number, BoardColumn>(defaultCols.map((c) => [c.status.id, c]));
    const ordered: BoardColumn[] = [];
    customOrder.forEach((id) => {
      const col = colMap.get(id);
      if (col) {
        ordered.push(col);
        colMap.delete(id);
      }
    });
    // Append any columns that exist in defaultCols but weren't explicitly in customOrder
    colMap.forEach((col) => ordered.push(col));
    return ordered;
  }

  return defaultCols;
}

export interface UnmappedSummary {
  count: number;
  byStatus: { name: string; count: number }[];
}

/**
 * Issues whose status belongs to none of the mapping categories (backlog, analysis, in progress, done).
 * They still appear on the board, in extra columns without a category, but are not treated as done and
 * do not count in the stage-based views, so it is worth telling the user.
 */
export function summarizeUnmapped(issues: RedmineIssue[], mapping: StatusMapping): UnmappedSummary {
  const norm = normalizeStatusMapping(mapping);
  const mapped = new Set<number>(COLUMN_ORDER.flatMap((key) => norm[key] || []));
  // With no mapping at all, every status is "unmapped"; that is the mapping screen's business, not a warning.
  if (mapped.size === 0) return { count: 0, byStatus: [] };

  const counts = new Map<string, number>();
  issues.forEach((issue) => {
    if (mapped.has(issue.status.id)) return;
    counts.set(issue.status.name, (counts.get(issue.status.name) || 0) + 1);
  });
  const byStatus = Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { count: byStatus.reduce((sum, s) => sum + s.count, 0), byStatus };
}

export function isDoneColumn(col: { status: RedmineStatus; category?: KanbanColumnKey }): boolean {
  if (col.category === 'done') return true;
  if (col.status.is_closed) return true;
  const name = (col.status.name || '').toLowerCase();
  return /conclu[ií]d|fechad|resolvid|finaliz|closed|done/.test(name);
}

export interface BoardLane {
  key: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  issues: RedmineIssue[];
}

interface KanbanBoardProps {
  lanes: BoardLane[];
  columns: BoardColumn[];
  accent?: 'rose' | 'purple';
  density?: 'compact' | 'normal' | 'wide';
  pendingIssueIds: Set<number>;
  onMoveIssue: (issueId: number, targetStatusId: number) => void;
  onMoveColumn?: (statusId: number, direction: 'left' | 'right') => void;
  onSelectIssue: (issue: RedmineIssue) => void;
  renderCard: (issue: RedmineIssue) => React.ReactNode;
  emptyColumnLabel?: string;
  collapsedLanes?: Record<string, boolean>;
  onToggleLaneCollapse?: (laneKey: string) => void;
  initialCollapseDone?: boolean;
  lightView?: boolean;
  /** Fade the cards that are fine (ok / done) so blocked and overdue ones stand out. */
  focusProblems?: boolean;
  /** WIP limits (Fluxo tab); the column header shows its count against the limit of its stage. */
  wipLimits?: WipLimits;
  /** Issues per stage in the whole panel (all lanes and trackers), to compare with the limit. */
  stageCounts?: Record<KanbanColumnKey, number>;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  lanes,
  columns,
  accent = 'rose',
  density = 'normal',
  pendingIssueIds,
  onMoveIssue,
  onMoveColumn,
  onSelectIssue,
  renderCard,
  emptyColumnLabel = 'Nenhuma tarefa',
  collapsedLanes: controlledCollapsedLanes,
  onToggleLaneCollapse,
  initialCollapseDone = true,
  lightView = false,
  focusProblems = false,
  wipLimits,
  stageCounts,
}) => {
  const [dragged, setDragged] = useState<{ id: number; statusId: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [internalCollapsedLanes, setInternalCollapsedLanes] = useState<Record<string, boolean>>({});
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({});
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});
  const laneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const effectiveCollapsedLanes = controlledCollapsedLanes ?? internalCollapsedLanes;
  const toggleLane = (laneKey: string) => {
    if (onToggleLaneCollapse) {
      onToggleLaneCollapse(laneKey);
    } else {
      setInternalCollapsedLanes((p) => ({ ...p, [laneKey]: !p[laneKey] }));
    }
  };

  const colWidthClass = lightView
    ? density === 'compact'
      ? 'w-[200px]'
      : density === 'wide'
      ? 'w-[280px]'
      : 'w-[240px]'
    : density === 'compact'
    ? 'w-[224px]'
    : density === 'wide'
    ? 'w-[320px]'
    : 'w-[272px]';

  const scrollLane = (laneKey: string, direction: 'left' | 'right') => {
    const el = laneRefs.current[laneKey];
    if (el) {
      const step = density === 'compact' ? 240 : density === 'wide' ? 335 : 285;
      el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
    }
  };

  const accentRing =
    accent === 'purple'
      ? 'bg-purple-950/25 border-purple-500/70 ring-2 ring-purple-500/25'
      : 'bg-rose-950/25 border-rose-500/70 ring-2 ring-rose-500/25';
  const cardHover = accent === 'purple' ? 'hover:border-purple-500/60' : 'hover:border-rose-500/60';

  const statusIds = useMemo(() => new Set(columns.map((c) => c.status.id)), [columns]);
  const showLaneHeaders = lanes.length > 1 || lanes.some((l) => l.title);

  const handleDrop = (e: React.DragEvent, statusId: number) => {
    e.preventDefault();
    const issueId = Number(e.dataTransfer.getData('text/plain'));
    const from = dragged;
    setDragged(null);
    setDropTarget(null);
    if (issueId && from && from.statusId !== statusId) onMoveIssue(issueId, statusId);
  };

  return (
    <div className="space-y-4">
      {lanes.map((lane) => {
        const collapsed = !!effectiveCollapsedLanes[lane.key];
        return (
          <section
            key={lane.key}
            className="bg-slate-950/40 rounded-3xl border border-slate-800/60 animate-slide-up"
          >
            {showLaneHeaders ? (
              <div className="w-full flex items-center justify-between px-4 pt-3 pb-1 border-b border-transparent">
                <button
                  type="button"
                  onClick={() => toggleLane(lane.key)}
                  className="flex items-center gap-2 text-left group min-w-0"
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
                  )}
                  <span className="flex items-center gap-2 min-w-0 truncate">{lane.title}</span>
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 shrink-0">
                    {lane.issues.length}
                  </span>
                </button>

                {!collapsed && columns.length > 4 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => scrollLane(lane.key, 'left')}
                      className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-500 hover:bg-slate-800 transition-colors"
                      title="Rolar colunas para a esquerda"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollLane(lane.key, 'right')}
                      className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-500 hover:bg-slate-800 transition-colors"
                      title="Rolar colunas para a direita"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : columns.length > 4 && !collapsed ? (
              <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[11px] text-slate-500">
                <span>{columns.length} colunas</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollLane(lane.key, 'left')}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-500 hover:bg-slate-800 transition-colors"
                    title="Rolar colunas para a esquerda"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollLane(lane.key, 'right')}
                    className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-blue-500 hover:bg-slate-800 transition-colors"
                    title="Rolar colunas para a direita"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}

            {!collapsed && (
              <div
                ref={(el) => {
                  laneRefs.current[lane.key] = el;
                }}
                className="flex gap-3 overflow-x-auto p-3 pt-2 scroll-smooth custom-scrollbar"
              >
                {columns.map(({ status, category }) => {
                  const columnIssues = lane.issues.filter((i) => i.status.id === status.id);
                  const targetKey = `${lane.key}:${status.id}`;
                  const isDropTarget = dropTarget === targetKey;
                  const meta = category ? COLUMN_META[category] : undefined;
                  const showAll = !!expandedCols[targetKey];
                  const visible = showAll ? columnIssues : columnIssues.slice(0, PAGE);
                  const isDone = isDoneColumn({ status, category });
                  const isColEmpty = columnIssues.length === 0;
                  const isExplicit = targetKey in collapsedCols;
                  const isCollapsed = isExplicit
                    ? collapsedCols[targetKey]
                    : ((initialCollapseDone && isDone) || isColEmpty);

                  if (isCollapsed) {
                    return (
                      <div
                        key={status.id}
                        onDragOver={(e) => {
                          if (!dragged) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dropTarget !== targetKey) setDropTarget(targetKey);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                        }}
                        onDrop={(e) => handleDrop(e, status.id)}
                        onClick={() => setCollapsedCols((p) => ({ ...p, [targetKey]: false }))}
                        className={`snap-start shrink-0 w-12 sm:w-14 min-h-[220px] flex flex-col items-center justify-between py-3.5 px-1 rounded-2xl border border-dashed transition-all duration-150 cursor-pointer select-none group ${isDropTarget
                          ? accentRing
                          : isDone
                          ? 'bg-slate-950/60 border-emerald-900/40 hover:bg-slate-900/80 hover:border-emerald-700/60'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                          }`}
                        title={`${status.name} (${columnIssues.length} ${
                          columnIssues.length === 1 ? 'tarefa' : 'tarefas'
                        } - clique para expandir ou arraste uma tarefa para cá)`}
                      >
                        {/* Top: Status Dot & Badge count */}
                        <div className="flex flex-col items-center gap-1.5 pt-0.5 shrink-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${meta?.dot || (isDone ? 'bg-emerald-400' : 'bg-slate-600')}`} />
                          <span
                            className={`text-[10px] font-mono px-1 py-0.2 rounded-full border ${
                              columnIssues.length > 0
                                ? isDone
                                  ? 'text-emerald-400 bg-emerald-950/50 border-emerald-800/50 font-semibold'
                                  : 'text-slate-300 bg-slate-900 border-slate-800 font-semibold'
                                : 'text-slate-500 bg-slate-900 border-slate-800'
                            }`}
                          >
                            {columnIssues.length}
                          </span>
                        </div>

                        {/* Middle: Rotated 90° Label */}
                        <div className="flex-1 flex items-center justify-center my-3 overflow-hidden">
                          <span
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            className={`text-xs font-bold tracking-wider whitespace-nowrap transition-colors ${
                              isDone ? 'text-emerald-300/80 group-hover:text-emerald-200' : 'text-slate-400 group-hover:text-slate-100'
                            }`}
                          >
                            {status.name}
                          </span>
                        </div>

                        {/* Bottom: Expand hint */}
                        <div
                          className={`pb-1 transition-colors shrink-0 ${
                            isDone ? 'text-emerald-500 group-hover:text-emerald-300' : 'text-slate-500 group-hover:text-blue-400'
                          }`}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={status.id}
                      onDragOver={(e) => {
                        if (!dragged) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dropTarget !== targetKey) setDropTarget(targetKey);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null);
                      }}
                      onDrop={(e) => handleDrop(e, status.id)}
                      className={`snap-start shrink-0 ${colWidthClass} flex flex-col rounded-2xl border transition-all duration-150 ${isDropTarget ? accentRing : 'bg-slate-900/70 border-slate-800/80'
                        }`}
                    >
                      <div className="px-3 py-2.5 border-b border-slate-800/80 flex items-center justify-between gap-2 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {onMoveColumn && (
                            <div className="flex items-center -ml-1 text-slate-500">
                              <button
                                type="button"
                                disabled={columns.findIndex((c) => c.status.id === status.id) === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveColumn(status.id, 'left');
                                }}
                                className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 disabled:opacity-20 disabled:pointer-events-none"
                                title="Mover coluna para a esquerda"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={
                                  columns.findIndex((c) => c.status.id === status.id) === columns.length - 1
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMoveColumn(status.id, 'right');
                                }}
                                className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 disabled:opacity-20 disabled:pointer-events-none"
                                title="Mover coluna para a direita"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <span className={`w-2 h-2 rounded-full shrink-0 ${meta?.dot || 'bg-slate-600'}`} />
                          <h4 className="text-xs font-bold text-slate-200 truncate" title={status.name}>
                            {status.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedCols((p) => ({ ...p, [targetKey]: true }));
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                            title="Recolher coluna"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          {meta && (
                            <span className={`hidden xl:inline text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${meta.chip}`}>
                              {meta.label}
                            </span>
                          )}
                          {(() => {
                            // The limit is per stage: it counts every column of the stage, in every lane, within the current filters.
                            const limit = category && category !== 'done' ? wipLimits?.[category] : undefined;
                            if (!limit || !category || !stageCounts) {
                              return (
                                <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                  {columnIssues.length}
                                </span>
                              );
                            }
                            const total = stageCounts[category];
                            const state = limitState(total, limit);
                            const tone =
                              state === 'over'
                                ? 'bg-rose-950/60 text-rose-300 ring-1 ring-rose-500'
                                : state === 'at'
                                  ? 'bg-amber-950/50 text-amber-300'
                                  : 'bg-slate-800 text-slate-300';
                            const text = state === 'over' ? 'acima do limite' : state === 'at' ? 'no limite' : 'dentro do limite';
                            return (
                              <span
                                className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-full ${tone}`}
                                title={`WIP da etapa: ${total} de ${limit} (${text}). O limite é definido na aba Fluxo.`}
                              >
                                {state === 'over' && <span aria-hidden="true">▲ </span>}
                                {state === 'at' && <span aria-hidden="true">● </span>}
                                {total}/{limit}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className={`p-2 ${lightView ? 'space-y-1.5' : 'space-y-2'} flex-1 overflow-y-auto max-h-[calc(100vh-260px)] min-h-[120px]`}>
                        {columnIssues.length === 0 ? (
                          <div
                            className={`h-20 flex items-center justify-center border border-dashed rounded-xl text-[11px] transition-colors ${isDropTarget ? 'border-current text-slate-300' : 'border-slate-800/70 text-slate-600'
                              }`}
                          >
                            {dragged ? 'Soltar aqui' : emptyColumnLabel}
                          </div>
                        ) : (
                          visible.map((issue) => {
                            const pending = pendingIssueIds.has(issue.id);
                            const isDragging = dragged?.id === issue.id;
                            const health = cardHealth(issue, isDone);
                            return (
                              <div
                                key={issue.id}
                                data-saude={health}
                                draggable={!pending}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', String(issue.id));
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDragged({ id: issue.id, statusId: issue.status.id });
                                }}
                                onDragEnd={() => {
                                  setDragged(null);
                                  setDropTarget(null);
                                }}
                                onClick={() => onSelectIssue(issue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onSelectIssue(issue);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                className={`relative ${
                                  lightView ? 'py-1.5 px-2.5 rounded-lg' : 'p-3 rounded-xl'
                                } border cursor-grab active:cursor-grabbing select-none transition-all duration-150 shadow-sm group ${cardHover} ${issue.is_blocked
                                  ? 'bg-gradient-to-br from-rose-950/50 via-slate-900/90 to-slate-900 border-rose-800/70'
                                  : lightView
                                  ? 'bg-slate-950/70 border-slate-800/70 hover:bg-slate-900/90 hover:border-slate-700'
                                  : 'bg-slate-950/80 border-slate-800/90 hover:bg-slate-900'
                                  } ${isDragging ? 'opacity-40 scale-[0.97]' : 'hover:-translate-y-0.5 hover:shadow-md'} ${pending ? 'opacity-70 pointer-events-none' : ''
                                  } ${health === 'problema' ? 'border-l-[5px] border-l-rose-500 ring-1 ring-rose-500/40' : ''} ${
                                    focusProblems && (health === 'ok' || health === 'done') && !isDragging
                                      ? 'opacity-40 saturate-50 hover:opacity-100 hover:saturate-100 focus-within:opacity-100 focus-within:saturate-100'
                                      : ''
                                  }`}
                              >
                                {pending && (
                                  <Loader2 className="absolute top-2 right-2 w-3.5 h-3.5 animate-spin text-slate-400" />
                                )}
                                {renderCard(issue)}
                                {/* Age, stale days and due date of unfinished issues (all Kanban boards) */}
                                {!isDone && <CardMetaLine issue={issue} compact={lightView} />}
                                {!isDone && <DependencyPills issue={issue} compact={lightView} />}
                              </div>
                            );
                          })
                        )}
                        {columnIssues.length > PAGE && (
                          <button
                            type="button"
                            onClick={() => setExpandedCols((p) => ({ ...p, [targetKey]: !showAll }))}
                            className="w-full py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/60"
                          >
                            {showAll ? 'Mostrar menos' : `Mostrar mais ${columnIssues.length - PAGE}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {lane.issues.some((i) => !statusIds.has(i.status.id)) && (
                  <div className="shrink-0 w-[200px] text-[11px] text-slate-500 p-3">
                    Algumas tarefas estão em status não exibidos. Ajuste o mapeador de status em Configurações.
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
