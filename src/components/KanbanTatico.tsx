import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  AlertTriangle,
  FolderGit2,
  User,
  Search,
  X,
  Target,
  ChevronsUpDown,
} from 'lucide-react';
import {
  RedmineIssue,
  RedmineStatus,
  RedmineProject,
  RedmineTracker,
  RedmineCustomFieldDef,
  StatusMapping,
} from '../types/redmine';
import { KanbanBoard, buildColumns, BoardLane } from './KanbanBoard';
import { SearchableMultiSelect } from './SearchableMultiSelect';

interface KanbanTaticoProps {
  issues: RedmineIssue[];
  statuses: RedmineStatus[];
  projects: RedmineProject[];
  trackers: RedmineTracker[];
  tacticalTrackerIds: number[];
  customFields: RedmineCustomFieldDef[];
  strategicCustomFieldId?: number;
  statusMapping: StatusMapping;
  pendingIssueIds: Set<number>;
  columnOrder?: number[];
  onUpdateColumnOrder?: (newOrder: number[]) => void;
  onSelectIssue: (issue: RedmineIssue) => void;
  onMoveIssue: (issueId: number, targetStatusId: number) => Promise<void>;
  isLoading?: boolean;
  /** Publishes the list currently shown (after filters), used by the CSV export. */
  onVisibleIssuesChange?: (issues: RedmineIssue[]) => void;
}

export const KanbanTatico: React.FC<KanbanTaticoProps> = ({
  issues,
  statuses,
  projects,
  trackers,
  tacticalTrackerIds,
  customFields,
  strategicCustomFieldId,
  statusMapping,
  pendingIssueIds,
  columnOrder,
  onUpdateColumnOrder,
  onSelectIssue,
  onMoveIssue,
  onVisibleIssuesChange,
}) => {
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | 'all'>('all');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [selectedCustomFieldFilter, setSelectedCustomFieldFilter] = useState<{ fieldId: number; value: string } | null>(null);
  const [groupByStrategic, setGroupByStrategic] = useState(true);
  const [collapsedLanes, setCollapsedLanes] = useState<Record<string, boolean>>({});
  const [columnDensity, setColumnDensity] = useState<'compact' | 'normal' | 'wide'>('normal');

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

  // Extract custom fields values for tactical issues filter
  const filterableCustomField = useMemo(() => {
    if (strategicCustomFieldId) {
      return customFields.find((cf) => cf.id === strategicCustomFieldId) || customFields[0];
    }
    return customFields[0];
  }, [customFields, strategicCustomFieldId]);

  // Distinct values for the filterable custom field
  const customFieldOptions = useMemo(() => {
    if (!filterableCustomField) return [];
    const values = new Set<string>();
    issues.forEach((issue) => {
      const f = issue.custom_fields?.find((cf) => cf.id === filterableCustomField.id);
      if (f && f.value) {
        values.add(String(f.value));
      }
    });
    return Array.from(values).sort();
  }, [issues, filterableCustomField]);

  // Filter tactical issues
  const tacticalIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Must be tactical tracker if configured
      if (tacticalTrackerIds.length > 0 && !tacticalTrackerIds.includes(issue.tracker.id)) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = issue.subject.toLowerCase().includes(q);
        const matchesId = String(issue.id).includes(q);
        const matchesStrategic = (issue.strategic_initiative || '').toLowerCase().includes(q);
        if (!matchesSubject && !matchesId && !matchesStrategic) return false;
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

      // Tracker filter
      if (selectedTrackerId !== 'all' && issue.tracker.id !== selectedTrackerId) {
        return false;
      }

      // Blocked filter
      if (onlyBlocked && !issue.is_blocked) {
        return false;
      }

      // Custom field filter
      if (selectedCustomFieldFilter) {
        const cf = issue.custom_fields?.find((f) => f.id === selectedCustomFieldFilter.fieldId);
        if (!cf || String(cf.value) !== selectedCustomFieldFilter.value) {
          return false;
        }
      }

      return true;
    });
  }, [
    issues,
    tacticalTrackerIds,
    searchQuery,
    selectedProjectIds,
    selectedAssignees,
    selectedTrackerId,
    onlyBlocked,
    selectedCustomFieldFilter,
  ]);

  useEffect(() => {
    onVisibleIssuesChange?.(tacticalIssues);
    return () => onVisibleIssuesChange?.([]);
  }, [tacticalIssues, onVisibleIssuesChange]);

  // Statuses that belong to tactical task types
  const tacticalStatuses = useMemo(() => {
    const allTactical = issues.filter(
      (i) => tacticalTrackerIds.length === 0 || tacticalTrackerIds.includes(i.tracker.id)
    );
    if (allTactical.length === 0) return statuses;

    const validStatusIds = new Set<number>();
    allTactical.forEach((issue) => {
      validStatusIds.add(issue.status.id);
      issue.allowed_statuses?.forEach((st) => validStatusIds.add(st.id));
    });

    if (validStatusIds.size === 0) return statuses;
    return statuses.filter((s) => validStatusIds.has(s.id));
  }, [issues, tacticalTrackerIds, statuses]);

  // Columns ordered by status mapping and columnOrder (only tactical task statuses)
  const columns = useMemo(
    () => buildColumns(tacticalStatuses, statusMapping, tacticalIssues, columnOrder),
    [tacticalStatuses, statusMapping, tacticalIssues, columnOrder]
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

  // Grouping by Strategic Initiative (Requisito 6)
  const lanes = useMemo<BoardLane[]>(() => {
    if (!groupByStrategic) {
      return [{ key: 'all', issues: tacticalIssues }];
    }

    const map = new Map<string, { key: string; title: string; issues: RedmineIssue[] }>();

    tacticalIssues.forEach((issue) => {
      const initName = issue.strategic_initiative || 'Sem Iniciativa Vinculada';
      if (!map.has(initName)) {
        map.set(initName, { key: initName, title: initName, issues: [] });
      }
      map.get(initName)!.issues.push(issue);
    });

    return Array.from(map.values()).map((g) => ({
      key: `strat-${g.key}`,
      title: (
        <span className="flex items-center gap-2 text-sm font-bold text-black tracking-tight">
          <Target className="w-4 h-4 text-purple-400" />
          <span>{g.title}</span>
        </span>
      ),
      issues: g.issues,
    }));
  }, [groupByStrategic, tacticalIssues]);

  const handleToggleLaneCollapse = (laneKey: string) => {
    setCollapsedLanes((prev) => ({
      ...prev,
      [laneKey]: !prev[laneKey],
    }));
  };

  const allLanesCollapsed = useMemo(() => {
    if (lanes.length <= 1) return false;
    return lanes.every((l) => Boolean(collapsedLanes[l.key]));
  }, [lanes, collapsedLanes]);

  const toggleAllLanes = () => {
    if (allLanesCollapsed) {
      setCollapsedLanes({});
    } else {
      const next: Record<string, boolean> = {};
      lanes.forEach((l) => {
        next[l.key] = true;
      });
      setCollapsedLanes(next);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedProjectIds([]);
    setSelectedAssignees([]);
    setSelectedTrackerId('all');
    setOnlyBlocked(false);
    setSelectedCustomFieldFilter(null);
  };

  const activeFiltersCount =
    (selectedProjectIds.length > 0 ? 1 : 0) +
    (selectedAssignees.length > 0 ? 1 : 0) +
    (selectedTrackerId !== 'all' ? 1 : 0) +
    (onlyBlocked ? 1 : 0) +
    (selectedCustomFieldFilter ? 1 : 0) +
    (searchQuery ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="relative z-30 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-rose-500" />
              <span>Demandas Táticas</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {tacticalIssues.length} tarefas
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão de demandas táticas
            </p>
          </div>

          {/* Controls: Density and Group by Strategic */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* Column Width / Density Selector */}
            <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-2 font-medium">Largura:</span>
              <button
                type="button"
                onClick={() => setColumnDensity('compact')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${columnDensity === 'compact'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                  }`}
                title="Colunas compactas (224px) - ideal para múltiplos status"
              >
                Compacta
              </button>
              <button
                type="button"
                onClick={() => setColumnDensity('normal')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${columnDensity === 'normal'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                  }`}
                title="Colunas padrão (272px)"
              >
                Padrão
              </button>
              <button
                type="button"
                onClick={() => setColumnDensity('wide')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${columnDensity === 'wide'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
                  }`}
                title="Colunas amplas (320px)"
              >
                Ampla
              </button>
            </div>

            {/* Requisito 6: Agrupar por Iniciativa Estratégica */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={groupByStrategic}
                onChange={(e) => setGroupByStrategic(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900 border-slate-700 bg-slate-900 cursor-pointer"
              />
              <span className="font-medium">Agrupar por Iniciativa Estratégica</span>
            </label>

            {/* Collapse/Expand All Button when grouped */}
            {lanes.length > 1 && (
              <button
                type="button"
                onClick={toggleAllLanes}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all shadow-sm"
                title={allLanesCollapsed ? 'Expandir todos os grupos' : 'Colapsar todos os grupos'}
              >
                <ChevronsUpDown className="w-3.5 h-3.5 text-purple-400" />
                <span>{allLanesCollapsed ? 'Expandir Todos' : 'Colapsar Todos'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar (Requisito 7) */}
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

          {/* Tracker Filter */}
          <div>
            <select
              value={selectedTrackerId}
              onChange={(e) =>
                setSelectedTrackerId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Todos os Tipos Táticos</option>
              {trackers
                .filter((t) => tacticalTrackerIds.length === 0 || tacticalTrackerIds.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Custom field of tactical type filter (Requisito 7) */}
          <div>
            <select
              value={selectedCustomFieldFilter ? selectedCustomFieldFilter.value : 'all'}
              onChange={(e) => {
                if (e.target.value === 'all' || !filterableCustomField) {
                  setSelectedCustomFieldFilter(null);
                } else {
                  setSelectedCustomFieldFilter({
                    fieldId: filterableCustomField.id,
                    value: e.target.value,
                  });
                }
              }}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">
                {filterableCustomField ? `Filtrar: ${filterableCustomField.name}` : 'Campo Personalizado'}
              </option>
              {customFieldOptions.map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </div>

          {/* Blocked only toggle */}
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

      {/* Shared Kanban Board with Tactical styling */}
      <KanbanBoard
        lanes={lanes}
        columns={columns}
        accent="purple"
        density={columnDensity}
        pendingIssueIds={pendingIssueIds}
        collapsedLanes={collapsedLanes}
        onToggleLaneCollapse={handleToggleLaneCollapse}
        onMoveIssue={onMoveIssue}
        onMoveColumn={onUpdateColumnOrder ? handleMoveColumn : undefined}
        onSelectIssue={onSelectIssue}
        emptyColumnLabel="Nenhuma entrega tática"
        renderCard={(issue) => (
          <>
            {/* Top Bar: Requisito 3: ID da tarefa, tracker */}
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-white bg-purple-950/50 px-1.5 py-0.2 rounded border border-purple-900/50">
                  #{issue.id}
                </span>
                <span className="text-[10px] font-medium text-slate-300 bg-slate-800/70 px-1.5 py-0.2 rounded">
                  {issue.tracker.name}
                </span>
              </div>

              {issue.done_ratio !== undefined && (
                <span className="text-[10px] font-mono text-slate-400">
                  {issue.done_ratio}%
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
            <h5 className="text-xs font-semibold text-slate-100 group-hover:text-white line-clamp-2 leading-snug mb-2">
              {issue.subject}
            </h5>

            {/* Requisito 3: IDs das tarefas filhas */}
            {issue.children && issue.children.length > 0 && (
              <div className="mb-2.5 p-1.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="font-medium">Tarefas Filhas:</span>
                  <span className="font-mono font-bold text-slate-300">
                    {issue.children.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {issue.children.slice(0, 4).map((child) => (
                    <span
                      key={child.id}
                      className="font-mono text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60"
                    >
                      #{child.id}
                    </span>
                  ))}
                  {issue.children.length > 4 && (
                    <span className="text-[9px] font-mono text-slate-500">
                      +{issue.children.length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Bottom row: Requisito 3: Projeto & Responsável */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
              <span className="truncate flex items-center gap-1 max-w-[55%]" title={issue.project.name}>
                <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{issue.project.name}</span>
              </span>

              <span className="truncate flex items-center gap-1 font-medium text-slate-300 max-w-[45%]" title={issue.assigned_to?.name || 'Não atribuído'}>
                <User className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">{issue.assigned_to?.name || 'Sem resp.'}</span>
              </span>
            </div>
          </>
        )}
      />
    </div>
  );
};
