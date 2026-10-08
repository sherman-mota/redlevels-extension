import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  ChevronRight,
  ChevronDown,
  Target,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  User,
  Clock,
  Filter,
  Search,
  Tag,
  ArrowUpRight,
  Plus,
  X,
  ExternalLink,
  Activity
} from 'lucide-react';
import {
  RedmineIssue,
  RedmineProject,
  RedmineStatus,
  RedmineCustomFieldDef,
  StrategicInitiative
} from '../types/redmine';
import { DEMO_STRATEGIC_INITIATIVES } from '../services/demoData';

interface IniciativasEstrategicasProps {
  issues: RedmineIssue[];
  projects: RedmineProject[];
  statuses: RedmineStatus[];
  customFields: RedmineCustomFieldDef[];
  tacticalTrackerIds: number[];
  operationalTrackerIds: number[];
  strategicCustomFieldId?: number;
  onSelectIssue: (issue: RedmineIssue) => void;
  onUpdateStatus: (issueId: number, statusId: number) => Promise<void>;
}

export const IniciativasEstrategicas: React.FC<IniciativasEstrategicasProps> = ({
  issues,
  projects,
  statuses,
  customFields,
  tacticalTrackerIds,
  operationalTrackerIds,
  strategicCustomFieldId,
  onSelectIssue,
  onUpdateStatus,
}) => {
  // Tree expansion state - expanded by default
  const [collapsedInitiatives, setCollapsedInitiatives] = useState<Record<string, boolean>>({});
  const [collapsedTacticalIssues, setCollapsedTacticalIssues] = useState<Record<number, boolean>>({});

  const isInitiativeExpanded = (title: string) => !collapsedInitiatives[title];
  const isTacticalIssueExpanded = (id: number) => !collapsedTacticalIssues[id];

  const toggleInitiative = (title: string) => {
    setCollapsedInitiatives((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const toggleTacticalIssue = (id: number) => {
    setCollapsedTacticalIssues((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Filter state (Requisito 5)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | 'all'>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string | 'all'>('all');
  const [selectedStatusId, setSelectedStatusId] = useState<number | 'all'>('all');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [selectedCustomFieldFilter, setSelectedCustomFieldFilter] = useState<{ fieldId: number; value: string } | null>(null);

  // Extract assignees
  const assignees = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => {
      if (i.assigned_to?.name) set.add(i.assigned_to.name);
    });
    return Array.from(set).sort();
  }, [issues]);

  // Sorted projects alphabetically
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [projects]);

  // Extract definition of the configured strategic custom field
  const strategicCustomField = useMemo(() => {
    if (!strategicCustomFieldId) return undefined;
    return customFields.find((cf) => cf.id === strategicCustomFieldId);
  }, [customFields, strategicCustomFieldId]);

  // Extract filterable custom field for the filter toolbar
  const filterableCustomField = useMemo(() => {
    if (strategicCustomFieldId) {
      return customFields.find((cf) => cf.id === strategicCustomFieldId) || customFields[0];
    }
    return customFields[0];
  }, [customFields, strategicCustomFieldId]);

  // Distinct values for filterable custom field
  const customFieldOptions = useMemo(() => {
    if (!filterableCustomField) return [];
    const values = new Set<string>();
    issues.forEach((issue) => {
      const f = issue.custom_fields?.find((cf) => cf.id === filterableCustomField.id);
      if (f && f.value) values.add(String(f.value));
    });
    return Array.from(values).sort();
  }, [issues, filterableCustomField]);

  // Separate tactical and operational issues
  const tacticalIssues = useMemo(() => {
    return issues.filter(
      (i) => tacticalTrackerIds.length === 0 || tacticalTrackerIds.includes(i.tracker.id)
    );
  }, [issues, tacticalTrackerIds]);

  const operationalIssues = useMemo(() => {
    return issues.filter(
      (i) => operationalTrackerIds.length === 0 || operationalTrackerIds.includes(i.tracker.id)
    );
  }, [issues, operationalTrackerIds]);

  // Helper to extract the strategic initiative value for a tactical issue using the chosen custom field
  const getStrategicValue = (issue: RedmineIssue): string => {
    if (strategicCustomFieldId) {
      const cf = issue.custom_fields?.find((f) => f.id === strategicCustomFieldId);
      if (cf && cf.value !== null && cf.value !== undefined) {
        if (Array.isArray(cf.value)) {
          const str = cf.value
            .map((v) => (typeof v === 'object' && v ? v.name || v.value : String(v)))
            .filter(Boolean)
            .join(', ')
            .trim();
          if (str) return str;
        } else if (typeof cf.value === 'object' && cf.value) {
          const str = cf.value.name || cf.value.value || '';
          if (String(str).trim()) return String(str).trim();
        } else {
          const str = String(cf.value).trim();
          if (str) return str;
        }
      }
    }
    if (
      issue.strategic_initiative &&
      issue.strategic_initiative.trim() &&
      issue.strategic_initiative !== 'Sem Iniciativa Vinculada'
    ) {
      return issue.strategic_initiative.trim();
    }
    return '';
  };

  // Build strategic initiatives dynamically based on the chosen custom field
  const strategicInitiatives = useMemo<StrategicInitiative[]>(() => {
    const list: StrategicInitiative[] = [];
    const seen = new Set<string>();

    const addInitiative = (title: string, customCode?: string, customDesc?: string) => {
      const trimmed = title.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) return;
      seen.add(trimmed.toLowerCase());

      const demo = DEMO_STRATEGIC_INITIATIVES.find(
        (d) =>
          d.title.trim().toLowerCase() === trimmed.toLowerCase() ||
          (d.code && trimmed.toUpperCase().includes(d.code))
      );

      const code =
        demo?.code ||
        customCode ||
        (trimmed.includes(':') ? trimmed.split(':')[0].trim() : trimmed.slice(0, 10).toUpperCase());

      const description =
        demo?.description ||
        customDesc ||
        (strategicCustomField
          ? `${strategicCustomField.name}: ${trimmed}`
          : 'Iniciativa Estratégica');

      list.push({
        id: trimmed,
        code,
        title: trimmed,
        description,
        status: demo?.status || 'Em Andamento',
        progress: demo?.progress || 0,
        tacticalIssueIds: demo?.tacticalIssueIds || [],
      });
    };

    // 1. If possible values are configured on the custom field (e.g. list), add them in order
    if (strategicCustomField?.possible_values) {
      strategicCustomField.possible_values.forEach((pv) => {
        const val = typeof pv === 'object' ? pv.value : String(pv);
        if (val) addInitiative(val);
      });
    }

    // 2. Discover values present on actual tactical issues
    let hasUnassigned = false;
    tacticalIssues.forEach((issue) => {
      const val = getStrategicValue(issue);
      if (val) {
        addInitiative(val);
      } else {
        hasUnassigned = true;
      }
    });

    // 3. If no custom field is configured and in demo mode, preserve demo initiatives
    if (!strategicCustomFieldId && list.length === 0) {
      DEMO_STRATEGIC_INITIATIVES.forEach((init) => addInitiative(init.title));
    }

    // 4. If there are tactical tasks without value in this custom field, add 'Sem Iniciativa Vinculada'
    if (hasUnassigned || list.length === 0) {
      list.push({
        id: 'Sem Iniciativa Vinculada',
        code: 'OUTROS',
        title: 'Sem Iniciativa Vinculada',
        description: strategicCustomField
          ? `Tarefas táticas com o campo "${strategicCustomField.name}" não preenchido`
          : 'Tarefas táticas sem iniciativa estratégica vinculada',
        status: 'Em Andamento',
        progress: 0,
        tacticalIssueIds: [],
      });
    }

    return list;
  }, [tacticalIssues, strategicCustomField, strategicCustomFieldId]);

  // Has active filters
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedProjectId !== 'all' ||
    selectedAssignee !== 'all' ||
    selectedStatusId !== 'all' ||
    onlyBlocked ||
    Boolean(selectedCustomFieldFilter);

  // Map tactical issues to initiatives
  const initiativeTree = useMemo(() => {
    return strategicInitiatives
      .map((initiative) => {
        const isNoInit = initiative.title === 'Sem Iniciativa Vinculada';

        // Find tactical issues linked to this initiative
        const linkedTactical = tacticalIssues.filter((tIssue) => {
          const val = getStrategicValue(tIssue);
          const matchesInitiative = isNoInit
            ? !val
            : val.trim().toLowerCase() === initiative.title.trim().toLowerCase() ||
            (initiative.code && val.toUpperCase().includes(initiative.code));

          if (!matchesInitiative) return false;

          // Apply filters (Requisito 5)
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matches =
              tIssue.subject.toLowerCase().includes(q) ||
              String(tIssue.id).includes(q) ||
              (tIssue.assigned_to?.name || '').toLowerCase().includes(q);
            if (!matches) return false;
          }

          if (selectedProjectId !== 'all' && tIssue.project.id !== selectedProjectId) {
            return false;
          }

          if (selectedAssignee !== 'all' && tIssue.assigned_to?.name !== selectedAssignee) {
            return false;
          }

          if (selectedStatusId !== 'all' && tIssue.status.id !== selectedStatusId) {
            return false;
          }

          if (onlyBlocked && !tIssue.is_blocked) {
            return false;
          }

          if (selectedCustomFieldFilter) {
            const cf = tIssue.custom_fields?.find((f) => f.id === selectedCustomFieldFilter.fieldId);
            if (!cf || String(cf.value) !== selectedCustomFieldFilter.value) {
              return false;
            }
          }

          return true;
        });

        // Calculate aggregated progress & blockers count
        const totalTactical = linkedTactical.length;
        const blockedTactical = linkedTactical.filter((t) => t.is_blocked).length;
        const avgProgress =
          totalTactical > 0
            ? Math.round(
              linkedTactical.reduce((acc, cur) => acc + (cur.done_ratio || 0), 0) / totalTactical
            )
            : initiative.progress;

        const dynamicStatus =
          totalTactical === 0
            ? initiative.status
            : blockedTactical > 0
              ? 'Em Risco'
              : avgProgress === 100
                ? 'Concluído'
                : 'Em Andamento';

        return {
          initiative: {
            ...initiative,
            status: dynamicStatus as any,
            progress: avgProgress,
          },
          tacticalIssues: linkedTactical,
          totalTactical,
          blockedTactical,
          progress: avgProgress,
        };
      })
      .filter((item) => {
        // If filters are active, only show groups with matching tactical tasks
        if (hasActiveFilters) {
          return item.totalTactical > 0;
        }
        // Always show if it has tactical tasks or if it's one of the configured initiatives
        return item.totalTactical > 0 || item.initiative.title !== 'Sem Iniciativa Vinculada';
      });
  }, [
    strategicInitiatives,
    tacticalIssues,
    searchQuery,
    selectedProjectId,
    selectedAssignee,
    selectedStatusId,
    onlyBlocked,
    selectedCustomFieldFilter,
    hasActiveFilters,
    strategicCustomFieldId,
  ]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProjectId('all');
    setSelectedAssignee('all');
    setSelectedStatusId('all');
    setOnlyBlocked(false);
    setSelectedCustomFieldFilter(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-rose-500" />
              <span>Iniciativas Estratégicas</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Hierarquia 3 Níveis
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Rastreabilidade ponta a ponta: <strong>Estratégico ➔ Tático ➔ Operacional </strong>
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {strategicCustomField ? (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-rose-400" />
                  <span>Agrupando tarefas táticas por: <strong className="text-white">{strategicCustomField.name}</strong></span>
                </span>
              ) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/70 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>Nenhum campo customizado configurado. Selecione na aba <strong>Configurações</strong> (Item 4).</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const anyOpen = initiativeTree.some((i) => isInitiativeExpanded(i.initiative.title));
                const nextState: Record<string, boolean> = {};
                initiativeTree.forEach((i) => {
                  nextState[i.initiative.title] = anyOpen;
                });
                setCollapsedInitiatives(nextState);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
            >
              Alternar Todas as Iniciativas
            </button>
          </div>
        </div>

        {/* Filter Toolbar (Requisito 5) */}
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

          {/* Project Filter */}
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

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusId}
              onChange={(e) =>
                setSelectedStatusId(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Todos os Status</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom field filter */}
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

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title="Limpar filtros"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Strategic Initiatives Tree View */}
      <div className="space-y-4">
        {initiativeTree.map(({ initiative, tacticalIssues: linkedTactical, totalTactical, blockedTactical, progress }) => {
          const isExpanded = isInitiativeExpanded(initiative.title);

          return (
            <div
              key={initiative.id || initiative.title}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all"
            >
              {/* Level 1 Header: Iniciativa Estratégica */}
              <div
                onClick={() => toggleInitiative(initiative.title)}
                className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 hover:bg-slate-850 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                  {/* Requisito 2: Botão para expandir e exibir tarefas táticas */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleInitiative(initiative.title);
                    }}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0 mt-0.5 sm:mt-0"
                    title={isExpanded ? 'Recolher' : 'Expandir'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-rose-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {initiative.code || 'ESTRATÉGIA'}
                      </span>
                      <h3 className="text-base font-bold text-white tracking-tight truncate">
                        {initiative.title}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${initiative.status === 'Em Risco'
                          ? 'bg-red-950/70 text-red-300 border border-red-800/60'
                          : initiative.status === 'Concluído'
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            : 'bg-blue-950/70 text-blue-300 border border-blue-800/60'
                        }`}>
                        {initiative.status}
                      </span>
                    </div>
                    {initiative.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {initiative.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress & Stats indicators */}
                <div className="flex items-center gap-4 shrink-0 pl-10 md:pl-0">
                  {blockedTactical > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-xs font-semibold text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>{blockedTactical} bloqueio{blockedTactical > 1 ? 's' : ''}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span className="font-semibold text-slate-200">{totalTactical}</span>
                    <span className="hidden sm:inline">táticas</span>
                  </div>

                  <div className="flex items-center gap-2.5 min-w-[130px]">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-red-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs font-bold text-white min-w-[32px]">
                      {progress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Level 2: Requisito 3: Tarefas Táticas Relacionadas em Árvore */}
              {isExpanded && (
                <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3 pl-6 sm:pl-10">
                  {linkedTactical.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                      Nenhuma tarefa tática encontrada com os filtros selecionados para esta iniciativa.
                    </div>
                  ) : (
                    linkedTactical.map((tactical) => {
                      const isTacticalExpanded = isTacticalIssueExpanded(tactical.id);

                      // Requisito 4: Encontrar tarefas operacionais vinculadas (parent.id === tactical.id)
                      const childOperationalIssues = operationalIssues.filter(
                        (op) => op.parent?.id === tactical.id || tactical.children?.some((c) => c.id === op.id)
                      );

                      return (
                        <div
                          key={tactical.id}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden transition-all shadow-sm"
                        >
                          {/* Tactical Item Header */}
                          <div
                            onClick={() => toggleTacticalIssue(tactical.id)}
                            className="p-3.5 hover:bg-slate-850 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                              {/* Requisito 4: Ao clicar na tarefa tática, exibe tarefas operacionais */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTacticalIssue(tactical.id);
                                }}
                                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors shrink-0 mt-0.5 sm:mt-0"
                                title={isTacticalExpanded ? 'Recolher tarefas operacionais' : 'Ver tarefas operacionais'}
                              >
                                {isTacticalExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                )}
                              </button>

                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs px-2 py-0.2 rounded font-bold bg-purple-950/60 text-purple-300 border border-purple-800/60">
                                    #{tactical.id}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.2 rounded">
                                    {tactical.tracker.name}
                                  </span>
                                  <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                                    <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span className="truncate">{tactical.project.name}</span>
                                  </span>
                                </div>

                                <h4 className="text-sm font-semibold text-white truncate hover:text-rose-300 transition-colors">
                                  {tactical.subject}
                                </h4>
                              </div>
                            </div>

                            {/* Tactical Meta & Actions */}
                            <div className="flex items-center gap-3 shrink-0 pl-7 md:pl-0">
                              {tactical.is_blocked && (
                                <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/80">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>Bloqueado</span>
                                </span>
                              )}

                              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                <User className="w-3.5 h-3.5 text-purple-400" />
                                <span>{tactical.assigned_to?.name || 'Sem resp.'}</span>
                              </div>

                              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-800 text-slate-300">
                                {tactical.status.name}
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectIssue(tactical);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Abrir detalhes completos da tarefa tática"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Level 3: Requisito 4: Tarefas Operacionais Relacionadas em Árvore */}
                          {isTacticalExpanded && (
                            <div className="p-3.5 bg-slate-950/80 border-t border-slate-800/80 space-y-2 pl-6 sm:pl-10">
                              <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-slate-800/60">
                                <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-slate-300">
                                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                                  Tarefas Operacionais Filhas ({childOperationalIssues.length})
                                </span>
                              </div>

                              {childOperationalIssues.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">
                                  Nenhuma tarefa operacional filha vinculada diretamente a este épico/entrega tática.
                                </p>
                              ) : (
                                childOperationalIssues.map((opIssue) => (
                                  <div
                                    key={opIssue.id}
                                    onClick={() => onSelectIssue(opIssue)}
                                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors"
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <span className="font-mono text-[11px] font-bold text-rose-300 bg-rose-950/50 px-1.5 py-0.2 rounded border border-rose-900/50">
                                        #{opIssue.id}
                                      </span>
                                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded">
                                        {opIssue.tracker.name}
                                      </span>
                                      <span className="text-slate-200 font-medium truncate">
                                        {opIssue.subject}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      {opIssue.is_blocked && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-950 text-rose-400 border border-rose-800">
                                          Impedimento
                                        </span>
                                      )}

                                      <span className="text-slate-400 hidden sm:inline">
                                        {opIssue.assigned_to?.name || 'Sem resp.'}
                                      </span>

                                      <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                                        {opIssue.status.name}
                                      </span>

                                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
