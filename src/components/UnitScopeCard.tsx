import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderTree, Search, X } from 'lucide-react';
import { RedlevelsConfig, RedmineProject } from '../types/redmine';
import { buildProjectTree, unitScopeOf } from '../services/unitScope';

interface UnitScopeCardProps {
  config: RedlevelsConfig;
  projects: RedmineProject[];
  onSaveConfig: (updated: Partial<RedlevelsConfig>) => Promise<void>;
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Picks the unit(s) (Redmine projects, e.g. a coordination) whose issues are downloaded.
 * Applying changes the data scope, so the app reloads everything for the new scope.
 */
export const UnitScopeCard: React.FC<UnitScopeCardProps> = ({ config, projects, onSaveConfig }) => {
  const tree = useMemo(() => buildProjectTree(projects), [projects]);
  const saved = unitScopeOf(config);
  const savedIds = saved?.projectIds ?? [];
  const savedSub = saved ? saved.includeSubprojects : config.unitIncludeSubprojects !== false;

  const [selected, setSelected] = useState<Set<number>>(() => new Set(savedIds));
  const [includeSub, setIncludeSub] = useState(savedSub);
  const [search, setSearch] = useState('');
  // Ancestors of the saved units start expanded so the selection is visible.
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const open = new Set<number>();
    savedIds.forEach((id) => {
      let parent = tree.byId.get(id)?.parent;
      for (let guard = 0; parent && guard < 50; guard++) {
        open.add(parent.id);
        parent = tree.byId.get(parent.id)?.parent;
      }
    });
    return open;
  });

  const selectedIds = Array.from(selected).sort((a, b) => a - b);
  const dirty = !sameIds(selectedIds, savedIds) || (selectedIds.length > 0 && includeSub !== savedSub);

  const toggle = (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const query = search.trim().toLowerCase();
  const matches = (p: RedmineProject) =>
    !query || p.name.toLowerCase().includes(query) || (p.identifier || '').toLowerCase().includes(query);
  // A project is shown when it, or any project below it, matches the search.
  const visible = useMemo(() => {
    const memo = new Map<number, boolean>();
    const check = (p: RedmineProject): boolean => {
      const cached = memo.get(p.id);
      if (cached !== undefined) return cached;
      let result = matches(p);
      (tree.children.get(p.id) || []).forEach((child) => {
        if (check(child)) result = true;
      });
      memo.set(p.id, result);
      return result;
    };
    return check;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, query]);

  const rows: { project: RedmineProject; depth: number }[] = [];
  const walk = (project: RedmineProject, depth: number) => {
    if (query && !visible(project)) return;
    rows.push({ project, depth });
    if (query || expanded.has(project.id)) {
      (tree.children.get(project.id) || []).forEach((child) => walk(child, depth + 1));
    }
  };
  tree.roots.forEach((root) => walk(root, 0));

  const fullName = (id: number) => tree.pathOf(id).join(' › ') || `#${id}`;

  const apply = () => onSaveConfig({ unitProjectIds: selectedIds, unitIncludeSubprojects: includeSub });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3" role="region" aria-label="Unidade: escopo da sincronização">
      <div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
          <FolderTree className="w-4 h-4" />
          <span>Unidade · Escopo da sincronização</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Escolha a unidade (projeto do Redmine, como a sua Coordenadoria). O app passa a baixar só as tarefas dela e dos
          sistemas que ficam abaixo, reduzindo o volume e acelerando a carga.
        </p>
      </div>

      <p className={`text-xs ${saved ? 'text-slate-200' : 'text-slate-400'}`}>
        <span className={saved ? 'text-emerald-400 mr-1.5' : 'mr-1.5'} aria-hidden="true">
          {saved ? '✓' : '●'}
        </span>
        {saved
          ? `Escopo ativo: ${saved.projectIds.map((id) => tree.byId.get(id)?.name ?? `#${id}`).join('; ')} (${
              saved.includeSubprojects ? 'com' : 'sem'
            } subprojetos)`
          : 'Sem restrição: todos os projetos que o seu usuário enxerga.'}
      </p>

      {config.isDemoMode ? (
        <p className="text-xs text-amber-300">No modo demonstração não há projetos do Redmine para escolher.</p>
      ) : projects.length === 0 ? (
        <p className="text-xs text-amber-300">
          A lista de projetos ainda não foi carregada. Conecte-se ao Redmine e sincronize para listar as unidades.
        </p>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => (
                <span
                  key={id}
                  title={fullName(id)}
                  className="inline-flex items-center gap-1.5 max-w-[340px] bg-slate-800 border border-slate-700 rounded-full pl-2.5 pr-1 py-0.5 text-[11px] text-slate-100"
                >
                  <span className="truncate">{fullName(id)}</span>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => toggle(s, id))}
                    aria-label={`Remover ${fullName(id)}`}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar unidade ou sistema..."
              aria-label="Buscar projeto"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div role="tree" className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 py-1">
            {rows.length === 0 ? (
              <p className="px-3 py-2.5 text-xs text-slate-500">Nenhum projeto encontrado.</p>
            ) : (
              rows.map(({ project, depth }) => {
                const hasChildren = (tree.children.get(project.id) || []).length > 0;
                const open = !!query || expanded.has(project.id);
                const checked = selected.has(project.id);
                const below = tree.descendantsOf(project.id);
                return (
                  <div
                    key={project.id}
                    role="treeitem"
                    aria-selected={checked}
                    aria-expanded={hasChildren ? open : undefined}
                    className={`flex items-center gap-1.5 pr-3 py-1 ${checked ? 'bg-slate-800/60' : ''}`}
                    style={{ paddingLeft: 10 + depth * 18 }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((s) => toggle(s, project.id))}
                        aria-label={open ? 'Recolher' : 'Expandir'}
                        className="w-4 text-slate-400 hover:text-white"
                      >
                        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}
                    <label className="flex items-center gap-2 flex-1 min-w-0 text-xs text-slate-200 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => setSelected((s) => toggle(s, project.id))} />
                      <span className="truncate" title={fullName(project.id)}>
                        {project.name}
                      </span>
                      {below > 0 && <span className="text-[10px] text-slate-500 whitespace-nowrap">{below} abaixo</span>}
                    </label>
                  </div>
                );
              })
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
            <input type="checkbox" checked={includeSub} onChange={(e) => setIncludeSub(e.target.checked)} />
            Incluir subprojetos (os sistemas que ficam abaixo da unidade)
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={apply}
              disabled={!dirty}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors disabled:bg-slate-700 disabled:opacity-60"
            >
              {selectedIds.length > 0 ? 'Aplicar e recarregar' : 'Remover restrição e recarregar'}
            </button>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800/80 transition-colors"
              >
                Limpar seleção
              </button>
            )}
            <span className="text-[11px] text-slate-500 flex-1 min-w-[200px]">
              Ao aplicar, o app baixa de novo só o escopo escolhido. Cada unidade selecionada vira uma consulta ao Redmine.
              O Inbox também fica restrito à unidade.
            </span>
          </div>
        </>
      )}
    </div>
  );
};
