import React, { useState, useMemo, useCallback } from 'react';
import {
  Kanban,
  AlertTriangle,
  FolderGit2,
  User,
  Search,
  X,
  ChevronsUpDown,
  Layers,
  Tag,
  ChevronDown,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { RedmineIssue, RedmineStatus, RedmineProject, RedmineTracker, StatusMapping } from '../types/redmine';
import { KanbanBoard, buildColumns, BoardLane, BoardColumn } from './KanbanBoard';
import { SearchableMultiSelect } from './SearchableMultiSelect';

interface KanbanOperacionalProps {
  issues: RedmineIssue[];
  statuses: RedmineStatus[];
  projects: RedmineProject[];
  trackers: RedmineTracker[];
  operationalTrackerIds: number[];
  /** Status IDs actually used by each tracker in Redmine (tracker id -> status ids) */
  trackerStatusIds?: Record<number, number[]>;
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
  trackerStatusIds = {},
  statusMapping,
  pendingIssueIds,
  columnOrder,
  onUpdateColumnOrder,
  onSelectIssue,
  onMoveIssue,
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | 'all'>('all');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [filterParentId, setFilterParentId] = useState<string>('');
  const [groupBy, setGroupBy] = useState<'none' | 'project' | 'assignee'>('project');
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  const [collapsedTrackers, setCollapsedTrackers] = useState<Record<number, boolean>>({});
  const [columnDensity, setColumnDensity] = useState<'compact' | 'normal' | 'wide'>('normal');

  // Operational trackers list
  const operationalTrackers = useMemo(() => {
    let list = trackers.filter(
      (t) => operationalTrackerIds.length === 0 || operationalTrackerIds.includes(t.id)
    );

    const map = new Map<number, RedmineTracker>();
    list.forEach((t) => map.set(t.id, t));

    // Also include trackers that appear in operational issues
    issues.forEach((i) => {
      if (
        (operationalTrackerIds.length === 0 || operationalTrackerIds.includes(i.tracker.id)) &&
        !map.has(i.tracker.id)
      ) {
        map.set(i.tracker.id, { id: i.tracker.id, name: i.tracker.name });
      }
    });

    const result = Array.from(map.values());
    if (operationalTrackerIds.length > 0) {
      result.sort((a, b) => {
        const idxA = operationalTrackerIds.indexOf(a.id);
        const idxB = operationalTrackerIds.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return result;
  }, [trackers, operationalTrackerIds, issues]);

  // Sorted projects alphabetically (including projects present in issues)
  const sortedProjects = useMemo(() => {
    const map = new Map<number, RedmineProject>();
    projects.forEach((p) => map.set(p.id, p));
    issues.forEach((i) => {
      if (i.project && !map.has(i.project.id)) {
        map.set(i.project.id, { id: i.project.id, name: i.project.name, identifier: '' });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [projects, issues]);

  const projectOptions = useMemo(() => {
    return sortedProjects.map((p) => ({
      id: p.id,
      label: p.name,
      badge: `#${p.id}`,
    }));
  }, [sortedProjects]);

  // Extract distinct assignees
  const assignees = useMemo(() => {
    const map = new Map<string, string>();
    issues.forEach((i) => {
      if (i.assigned_to?.name) {
        map.set(i.assigned_to.name, i.assigned_to.name);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [issues]);

  const assigneeOptions = useMemo(() => {
    return assignees.map((a) => ({
      id: a,
      label: a,
    }));
  }, [assignees]);

  // Filter issues belonging to operational trackers matching active search & filters
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

      // Multi-project filter
      if (
        selectedProjectIds.length > 0 &&
        !selectedProjectIds.some((pId) => String(pId) === String(issue.project.id))
      ) {
        return false;
      }

      // Multi-assignee filter
      if (selectedAssignees.length > 0) {
        const assigneeName = issue.assigned_to?.name;
        if (!assigneeName || !selectedAssignees.includes(assigneeName)) {
          return false;
        }
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
    selectedProjectIds,
    selectedAssignees,
    onlyBlocked,
    filterParentId,
  ]);

  // Swimlanes builder per tracker
  const buildTrackerLanes = useCallback(
    (trackerIssues: RedmineIssue[], trackerId: number): BoardLane[] => {
      if (groupBy === 'project') {
        const map = new Map<number, { id: number; name: string; issues: RedmineIssue[] }>();
        trackerIssues.forEach((issue) => {
          const pId = issue.project.id;
          if (!map.has(pId)) {
            map.set(pId, { id: pId, name: issue.project.name, issues: [] });
          }
          map.get(pId)!.issues.push(issue);
        });

        if (map.size === 0) {
          return [{ key: `t-${trackerId}-all`, issues: [] }];
        }

        return Array.from(map.values()).map((p) => ({
          key: `t-${trackerId}-project-${p.id}`,
          title: (
            <span className="flex items-center gap-2 text-sm font-bold text-blue-500 tracking-tight">
              <FolderGit2 className="w-4 h-4 text-rose-400" />
              <span>{p.name}</span>
            </span>
          ),
          issues: p.issues,
        }));
      }

      if (groupBy === 'assignee') {
        const map = new Map<string, { name: string; issues: RedmineIssue[] }>();
        trackerIssues.forEach((issue) => {
          const aName = issue.assigned_to?.name || 'Não atribuído';
          if (!map.has(aName)) {
            map.set(aName, { name: aName, issues: [] });
          }
          map.get(aName)!.issues.push(issue);
        });

        const list = Array.from(map.values()).sort((a, b) => {
          if (a.name === 'Não atribuído') return 1;
          if (b.name === 'Não atribuído') return -1;
          return a.name.localeCompare(b.name, 'pt-BR');
        });

        return list.map((a) => ({
          key: `t-${trackerId}-assignee-${a.name}`,
          title: (
            <span className="flex items-center gap-2 text-sm font-bold text-blue-500 tracking-tight">
              <User className="w-4 h-4 text-rose-400" />
              <span>{a.name}</span>
            </span>
          ),
          issues: a.issues,
        }));
      }

      return [{ key: `t-${trackerId}-all`, issues: trackerIssues }];
    },
    [groupBy]
  );

  const handleToggleLaneCollapse = (laneKey: string) => {
    setCollapsedLanes((prev) => ({
      ...prev,
      [laneKey]: !prev[laneKey],
    }));
  };

  const handleToggleTrackerCollapse = (trackerId: number) => {
    setCollapsedTrackers((prev) => ({
      ...prev,
      [trackerId]: !prev[trackerId],
    }));
  };

  const handleMoveColumn = (
    trackerCols: BoardColumn[],
    statusId: number,
    direction: 'left' | 'right'
  ) => {
    if (!onUpdateColumnOrder) return;
    const currentOrder = trackerCols.map((c) => c.status.id);
    const idx = currentOrder.indexOf(statusId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return;
    const nextLocalOrder = [...currentOrder];
    const temp = nextLocalOrder[idx];
    nextLocalOrder[idx] = nextLocalOrder[targetIdx];
    nextLocalOrder[targetIdx] = temp;

    const baseOrder = columnOrder && columnOrder.length > 0 ? [...columnOrder] : [];
    const remaining = baseOrder.filter((id) => !nextLocalOrder.includes(id));
    onUpdateColumnOrder([...nextLocalOrder, ...remaining]);
  };

  const activeFiltersCount =
    (selectedProjectIds.length > 0 ? 1 : 0) +
    (selectedAssignees.length > 0 ? 1 : 0) +
    (selectedTrackerId !== 'all' ? 1 : 0) +
    (onlyBlocked ? 1 : 0) +
    (filterParentId ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedProjectIds([]);
    setSelectedAssignees([]);
    setSelectedTrackerId('all');
    setOnlyBlocked(false);
    setFilterParentId('');
  };

  // Render card UI
  const renderCard = (issue: RedmineIssue) => (
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

        {/* ID da tarefa pai */}
        {issue.parent && (
          <span
            className="font-mono text-[10px] font-semibold text-blue-300 bg-blue-950/50 px-1.5 py-0.2 rounded border border-blue-900/50"
            title={`Tarefa Pai #${issue.parent.id}`}
          >
            Pai: #{issue.parent.id}
          </span>
        )}
      </div>

      {/* Sinalização de impedimento */}
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

      {/* Assunto */}
      <h5 className="text-xs font-semibold text-slate-100 group-hover:text-white line-clamp-2 leading-snug mb-2.5">
        {issue.subject}
      </h5>

      {/* Bottom row: Projeto & Responsável */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
        <span className="truncate flex items-center gap-1 max-w-[55%]" title={issue.project.name}>
          <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate">{issue.project.name}</span>
        </span>

        <span
          className="truncate flex items-center gap-1 font-medium text-slate-300 max-w-[45%]"
          title={issue.assigned_to?.name || 'Não atribuído'}
        >
          <User className="w-3 h-3 text-rose-400 shrink-0" />
          <span className="truncate">{issue.assigned_to?.name || 'Sem resp.'}</span>
        </span>
      </div>
    </>
  );

  // Filter trackers to display: all operational trackers or single selected tracker
  const displayedTrackers = useMemo(() => {
    if (selectedTrackerId === 'all') {
      return operationalTrackers;
    }
    return operationalTrackers.filter((t) => t.id === selectedTrackerId);
  }, [operationalTrackers, selectedTrackerId]);

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="relative z-30 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Kanban className="w-5 h-5 text-rose-500" />
              <span>Tarefas Operacionais</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {operationalIssues.length} tarefas
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Kanban de tarefas operacionais individualizado por Tracker com status específicos. Arraste cards para atualizar o status.
            </p>
          </div>

          {/* Controls: Density, Grouping and Collapse All */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Column Width / Density Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-2 font-medium">Largura:</span>
              <button
                type="button"
                onClick={() => setColumnDensity('compact')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${columnDensity === 'compact'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-500'
                  }`}
                title="Colunas compactas (224px) - ideal para múltiplos status"
              >
                Compacta
              </button>
              <button
                type="button"
                onClick={() => setColumnDensity('normal')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${columnDensity === 'normal'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-500'
                  }`}
                title="Colunas padrão (272px)"
              >
                Padrão
              </button>
              <button
                type="button"
                onClick={() => setColumnDensity('wide')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${columnDensity === 'wide'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-500'
                  }`}
                title="Colunas amplas (320px)"
              >
                Ampla
              </button>
            </div>

            {/* Group By Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-2 font-medium">Agrupar:</span>
              <button
                type="button"
                onClick={() => setGroupBy('none')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${groupBy === 'none'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-500'
                  }`}
              >
                Nenhum
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('project')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${groupBy === 'project'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-500'
                  }`}
              >
                Por Projeto
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('assignee')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${groupBy === 'assignee'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-blue-500'
                  }`}
              >
                Por Responsável
              </button>
            </div>
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

          {/* Searchable Multi-Select Project Filter */}
          <div>
            <SearchableMultiSelect
              options={projectOptions}
              selectedValues={selectedProjectIds}
              onChange={(vals) => setSelectedProjectIds(vals as number[])}
              placeholder="Projetos"
              searchPlaceholder="Buscar projetos..."
              allLabel="Todos os Projetos"
            />
          </div>

          {/* Searchable Multi-Select Assignee Filter */}
          <div>
            <SearchableMultiSelect
              options={assigneeOptions}
              selectedValues={selectedAssignees}
              onChange={(vals) => setSelectedAssignees(vals as string[])}
              placeholder="Responsáveis"
              searchPlaceholder="Buscar responsáveis..."
              allLabel="Todos os Responsáveis"
            />
          </div>

          {/* Tracker Filter Dropdown */}
          <div>
            <select
              value={selectedTrackerId}
              onChange={(e) =>
                setSelectedTrackerId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">
                Todos os Trackers {operationalTrackers.length > 1 ? '(Kanban por Tracker)' : ''}
              </option>
              {operationalTrackers.map((t) => (
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

          {/* Blocked only toggle & clear */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyBlocked(!onlyBlocked)}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${onlyBlocked
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

      {/* Tracker Tabs Bar (quando há mais de 1 tracker operacional) */}
      {operationalTrackers.length > 1 && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl backdrop-blur-md overflow-x-auto scrollbar-thin shadow-sm">
          <button
            type="button"
            onClick={() => setSelectedTrackerId('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${selectedTrackerId === 'all'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todos os Trackers</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedTrackerId === 'all'
                ? 'bg-rose-700/80 text-white'
                : 'bg-slate-800 text-slate-400'
                }`}
            >
              {operationalIssues.length}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5 shrink-0" />

          {operationalTrackers.map((t) => {
            const count = operationalIssues.filter((i) => i.tracker.id === t.id).length;
            const isSelected = selectedTrackerId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTrackerId(t.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${isSelected
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{t.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isSelected
                    ? 'bg-rose-700/80 text-white'
                    : 'bg-slate-800 text-slate-400'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty State when no operational trackers */}
      {displayedTrackers.length === 0 && (
        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
          <Kanban className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhum tracker operacional configurado ou encontrado.</p>
        </div>
      )}

      {/* Renderização dos Kanbans por Tracker */}
      <div className="space-y-6">
        {displayedTrackers.map((tracker) => {
          // Issues specific to this tracker matching active filters
          const trackerIssues = operationalIssues.filter((i) => i.tracker.id === tracker.id);

          // Statuses belonging STRICTLY to this tracker:
          // 1) statuses discovered in Redmine for this tracker; 2) current status of its issues;
          // 3) allowed_statuses (workflow) of its issues. Never fall back to all statuses.
          const trackerStatusIdSet = new Set<number>(trackerStatusIds[tracker.id] || []);
          issues.forEach((issue) => {
            if (issue.tracker.id !== tracker.id) return;
            if (issue.status?.id) trackerStatusIdSet.add(issue.status.id);
            issue.allowed_statuses?.forEach((st) => {
              if (st?.id) trackerStatusIdSet.add(st.id);
            });
          });
          const trackerStatuses = statuses.filter((s) => trackerStatusIdSet.has(s.id));

          // Build columns specific to this tracker with only its statuses
          const trackerColumns = buildColumns(
            trackerStatuses,
            statusMapping,
            trackerIssues,
            columnOrder
          );

          // Build swimlanes for this tracker's issues
          const trackerLanes = buildTrackerLanes(trackerIssues, tracker.id);

          const isCollapsed = Boolean(collapsedTrackers[tracker.id]);
          const isSingleView = selectedTrackerId !== 'all';

          return (
            <div
              key={tracker.id}
              className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm transition-all"
            >
              {/* Tracker Section Header (mostrado sempre no modo 'all' ou com múltiplos trackers) */}
              {(!isSingleView || operationalTrackers.length > 1) && (
                <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800/70">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTrackerCollapse(tracker.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      title={isCollapsed ? 'Expandir Kanban deste tracker' : 'Recolher Kanban deste tracker'}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-rose-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-rose-400" />
                      )}
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-4 h-4 text-rose-400 shrink-0" />
                      <h2 className="text-sm font-bold text-white truncate tracking-tight">
                        {tracker.name}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                        {trackerIssues.length} {trackerIssues.length === 1 ? 'tarefa' : 'tarefas'}
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline-block font-mono bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800/80">
                        {trackerColumns.length} colunas
                      </span>
                    </div>
                  </div>

                  {/* Actions on tracker header */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isSingleView && (
                      <button
                        type="button"
                        onClick={() => setSelectedTrackerId(tracker.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-blue-500 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-all"
                        title={`Focar somente no tracker ${tracker.name}`}
                      >
                        <Maximize2 className="w-3 h-3 text-rose-400" />
                        <span className="hidden md:inline">Focar neste tracker</span>
                      </button>
                    )}
                    {isSingleView && operationalTrackers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTrackerId('all')}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-300 hover:text-blue-500 hover:bg-rose-950/40 border border-rose-900/50 transition-all"
                      >
                        <Layers className="w-3 h-3 text-rose-400" />
                        <span>Ver todos os trackers</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Kanban Board do Tracker */}
              {!isCollapsed && trackerColumns.length === 0 && (
                <p className="p-4 text-xs text-slate-500 italic text-center">
                  Nenhum status identificado para este tracker ainda.
                </p>
              )}
              {!isCollapsed && trackerColumns.length > 0 && (
                <KanbanBoard
                  lanes={trackerLanes}
                  columns={trackerColumns}
                  accent="rose"
                  density={columnDensity}
                  pendingIssueIds={pendingIssueIds}
                  collapsedLanes={collapsedLanes}
                  onToggleLaneCollapse={handleToggleLaneCollapse}
                  onMoveIssue={onMoveIssue}
                  onMoveColumn={
                    onUpdateColumnOrder
                      ? (statusId, direction) =>
                        handleMoveColumn(trackerColumns, statusId, direction)
                      : undefined
                  }
                  onSelectIssue={onSelectIssue}
                  emptyColumnLabel="Nenhuma tarefa"
                  renderCard={renderCard}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
