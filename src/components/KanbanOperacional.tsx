import React, { useState, useMemo } from 'react';
import {
  Kanban,
  AlertTriangle,
  FolderGit2,
  User,
  Filter,
  Search,
  X,
} from 'lucide-react';
import { RedmineIssue, RedmineStatus, RedmineProject, RedmineTracker, StatusMapping } from '../types/redmine';
import { KanbanBoard, buildColumns, BoardLane } from './KanbanBoard';

interface KanbanOperacionalProps {
  issues: RedmineIssue[];
  statuses: RedmineStatus[];
  projects: RedmineProject[];
  trackers: RedmineTracker[];
  operationalTrackerIds: number[];
  statusMapping: StatusMapping;
  pendingIssueIds: Set<number>;
  columnOrder?: number[];
  onUpdateColumnOrder?: (newOrder: number[]) => void;
  onSelectIssue: (issue: RedmineIssue) => void;
  onMoveIssue: (issueId: number, targetStatusId: number) => Promise<void>;
  isLoading?: boolean;
}

export const KanbanOperacional: React.FC<KanbanOperacionalProps> = ({
  issues,
  statuses,
  projects,
  trackers,
  operationalTrackerIds,
  statusMapping,
  pendingIssueIds,
  columnOrder,
  onUpdateColumnOrder,
  onSelectIssue,
  onMoveIssue,
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string | 'all'>('all');
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | 'all'>('all');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [filterParentId, setFilterParentId] = useState<string>('');
  const [groupByProject, setGroupByProject] = useState(false);
  const [columnDensity, setColumnDensity] = useState<'compact' | 'normal' | 'wide'>('normal');

  // Sorted projects alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [projects]);

  // Extract distinct assignees
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => {
      if (i.assigned_to?.name) {
        map.set(i.assigned_to.name, i.assigned_to.name);
      }
    });
    return Array.from(map.values()).sort();
  }, [issues]);

  // Filter issues belonging to operational trackers
  const operationalIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Must be an operational tracker if any are configured
      if (operationalTrackerIds.length > 0 && !operationalTrackerIds.includes(issue.tracker.id)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = issue.subject.toLowerCase().includes(q);
        const matchesId = String(issue.id).includes(q);
        const matchesParent = issue.parent && String(issue.parent.id).includes(q);
        if (!matchesSubject && !matchesId && !matchesParent) return false;
      }

      // Project filter
      if (selectedProjectId !== 'all' && issue.project.id !== selectedProjectId) {
        return false;
      }

      // Assignee filter
      if (selectedAssignee !== 'all' && issue.assigned_to?.name !== selectedAssignee) {
        return false;
      }

      // Tracker filter
      if (selectedTrackerId !== 'all' && issue.tracker.id !== selectedTrackerId) {
        return false;
      }

      // Blocked filter
      if (onlyBlocked && !issue.is_blocked) {
        return false;
      }

      // Parent ID filter
      if (filterParentId.trim()) {
        if (!issue.parent || !String(issue.parent.id).includes(filterParentId.trim())) {
          return false;
        }
      }

      return true;
    });
  }, [
    issues,
    operationalTrackerIds,
    searchQuery,
    selectedProjectId,
    selectedAssignee,
    selectedTrackerId,
    onlyBlocked,
    filterParentId,
  ]);

  // Statuses that belong to operational task types
  const operationalStatuses = useMemo(() => {
    const allOperational = issues.filter(
      (i) => operationalTrackerIds.length === 0 || operationalTrackerIds.includes(i.tracker.id)
    );
    if (allOperational.length === 0) return statuses;

    const validStatusIds = new Set<number>();
    allOperational.forEach((issue) => {
      validStatusIds.add(issue.status.id);
      issue.allowed_statuses?.forEach((st) => validStatusIds.add(st.id));
    });

    if (validStatusIds.size === 0) return statuses;
    return statuses.filter((s) => validStatusIds.has(s.id));
  }, [issues, operationalTrackerIds, statuses]);

  // Columns ordered by status mapping and columnOrder (only operational task statuses)
  const columns = useMemo(
    () => buildColumns(operationalStatuses, statusMapping, operationalIssues, columnOrder),
    [operationalStatuses, statusMapping, operationalIssues, columnOrder]
  );

  const handleMoveColumn = (statusId: number, direction: 'left' | 'right') => {
    if (!onUpdateColumnOrder) return;
    const currentOrder = columns.map((c) => c.status.id);
    const idx = currentOrder.indexOf(statusId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const temp = nextOrder[idx];
    nextOrder[idx] = nextOrder[targetIdx];
    nextOrder[targetIdx] = temp;
    onUpdateColumnOrder(nextOrder);
  };

  // Swimlanes
  const lanes = useMemo<BoardLane[]>(() => {
    if (!groupByProject) {
      return [{ key: 'all', issues: operationalIssues }];
    }

    const map = new Map<number, { id: number; name: string; issues: RedmineIssue[] }>();
    operationalIssues.forEach((issue) => {
      const pId = issue.project.id;
      if (!map.has(pId)) {
        map.set(pId, { id: pId, name: issue.project.name, issues: [] });
      }
      map.get(pId)!.issues.push(issue);
    });

    return Array.from(map.values()).map((p) => ({
      key: `project-${p.id}`,
      title: (
        <span className="flex items-center gap-2 text-sm font-bold text-white tracking-tight">
          <FolderGit2 className="w-4 h-4 text-rose-400" />
          <span>{p.name}</span>
        </span>
      ),
      issues: p.issues,
    }));
  }, [groupByProject, operationalIssues]);

  const activeFiltersCount =
    (selectedProjectId !== 'all' ? 1 : 0) +
    (selectedAssignee !== 'all' ? 1 : 0) +
    (selectedTrackerId !== 'all' ? 1 : 0) +
    (onlyBlocked ? 1 : 0) +
    (filterParentId ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedProjectId('all');
    setSelectedAssignee('all');
    setSelectedTrackerId('all');
    setOnlyBlocked(false);
    setFilterParentId('');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Kanban className="w-5 h-5 text-rose-500" />
              <span>Fluxos Operacionais</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {operationalIssues.length} tarefas
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Kanban ágil de execução por status do Redmine. Arraste cards para atualizar o status instantaneamente.
            </p>
          </div>

          {/* Controls: Density and Group by Project */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Column Width / Density Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-2 font-medium">Largura:</span>
              <button
                type="button"
                onClick={() => setColumnDensity('compact')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  columnDensity === 'compact'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Colunas compactas (224px) - ideal para múltiplos status"
              >
                Compacta
              </button>
              <button
                type="button"
                onClick={() => setColumnDensity('normal')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  columnDensity === 'normal'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Colunas padrão (272px)"
              >
                Padrão
              </button>
              <button
                type="button"
                onClick={() => setColumnDensity('wide')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  columnDensity === 'wide'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Colunas amplas (320px)"
              >
                Ampla
              </button>
            </div>

            {/* Group By Project Switch */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={groupByProject}
                onChange={(e) => setGroupByProject(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900 border-slate-700 bg-slate-900 cursor-pointer"
              />
              <span className="font-medium">Agrupar por Projeto</span>
            </label>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-800/80">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar assunto ou #ID..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Project Filter (Alphabetically Sorted) */}
          <div>
            <select
              value={selectedProjectId}
              onChange={(e) =>
                setSelectedProjectId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Todos os Projetos ({sortedProjects.length})</option>
              {sortedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee Filter */}
          <div>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Todos os Responsáveis</option>
              {assignees.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Tracker Filter */}
          <div>
            <select
              value={selectedTrackerId}
              onChange={(e) =>
                setSelectedTrackerId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Todos os Tipos (Trackers)</option>
              {trackers
                .filter((t) => operationalTrackerIds.length === 0 || operationalTrackerIds.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Parent ID Filter */}
          <div>
            <input
              type="text"
              value={filterParentId}
              onChange={(e) => setFilterParentId(e.target.value)}
              placeholder="Filtrar por Pai (#id)..."
              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          {/* Blocked only toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyBlocked(!onlyBlocked)}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                onlyBlocked
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${onlyBlocked ? 'text-rose-400' : 'text-slate-500'}`} />
              <span>Itens Bloqueados</span>
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Limpar filtros"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shared Kanban Board with cards meeting all requirements */}
      <KanbanBoard
        lanes={lanes}
        columns={columns}
        accent="rose"
        density={columnDensity}
        pendingIssueIds={pendingIssueIds}
        onMoveIssue={onMoveIssue}
        onMoveColumn={onUpdateColumnOrder ? handleMoveColumn : undefined}
        onSelectIssue={onSelectIssue}
        emptyColumnLabel="Nenhuma tarefa"
        renderCard={(issue) => (
          <>
            {/* Top Bar: ID, Tracker, Parent ID */}
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-rose-300 bg-rose-950/50 px-1.5 py-0.2 rounded border border-rose-900/50">
                  #{issue.id}
                </span>
                <span className="text-[10px] font-medium text-slate-300 bg-slate-800/70 px-1.5 py-0.2 rounded">
                  {issue.tracker.name}
                </span>
              </div>

              {/* Requisito 3: ID da tarefa pai */}
              {issue.parent && (
                <span
                  className="font-mono text-[10px] font-semibold text-blue-300 bg-blue-950/50 px-1.5 py-0.2 rounded border border-blue-900/50"
                  title={`Tarefa Pai #${issue.parent.id}`}
                >
                  Pai: #{issue.parent.id}
                </span>
              )}
            </div>

            {/* Requisito 2: Sinalização de impedimento */}
            {issue.is_blocked && (
              <div className="mb-2 p-1.5 rounded-lg bg-rose-950/80 border border-rose-700/80 flex items-start gap-1.5 text-[11px] text-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 leading-tight">
                  <strong className="block text-[10px] font-bold uppercase text-rose-300">
                    Impedimento
                  </strong>
                  <span className="text-slate-300 line-clamp-2">
                    {issue.block_reason || 'Item bloqueado'}
                  </span>
                </div>
              </div>
            )}

            {/* Requisito 3: Assunto */}
            <h5 className="text-xs font-semibold text-slate-100 group-hover:text-white line-clamp-2 leading-snug mb-2.5">
              {issue.subject}
            </h5>

            {/* Bottom row: Requisito 3: Projeto & Responsável */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
              <span className="truncate flex items-center gap-1 max-w-[55%]" title={issue.project.name}>
                <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{issue.project.name}</span>
              </span>

              <span className="truncate flex items-center gap-1 font-medium text-slate-300 max-w-[45%]" title={issue.assigned_to?.name || 'Não atribuído'}>
                <User className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{issue.assigned_to?.name || 'Sem resp.'}</span>
              </span>
            </div>
          </>
        )}
      />
    </div>
  );
};
