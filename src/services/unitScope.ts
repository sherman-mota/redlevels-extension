import type { RedlevelsConfig, RedmineProject } from '../types/redmine';

/**
 * "Unit" scope: download only the issues of the chosen Redmine projects (e.g. a coordination and the
 * systems below it) instead of everything the user can see. Pure helpers; the queries themselves are
 * built in `RedmineClient`.
 */

export interface UnitScope {
  projectIds: number[];
  /** Include the subprojects of each chosen project (default). */
  includeSubprojects: boolean;
}

/** The active unit scope, or null when no restriction is configured. */
export function unitScopeOf(
  config: Pick<RedlevelsConfig, 'unitProjectIds' | 'unitIncludeSubprojects'>
): UnitScope | null {
  const ids = Array.from(
    new Set((config.unitProjectIds || []).filter((n) => typeof n === 'number' && !isNaN(n)))
  ).sort((a, b) => a - b);
  return ids.length > 0 ? { projectIds: ids, includeSubprojects: config.unitIncludeSubprojects !== false } : null;
}

export interface ProjectTree {
  byId: Map<number, RedmineProject>;
  children: Map<number, RedmineProject[]>;
  roots: RedmineProject[];
  /** Names from the root down to the project, e.g. Diretoria › Gerência › Coordenadoria. */
  pathOf: (id: number) => string[];
  /** Number of projects below `id` (all levels). */
  descendantsOf: (id: number) => number;
}

const byName = (a: RedmineProject, b: RedmineProject) =>
  a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

/** Builds the project hierarchy from the flat list returned by /projects.json. */
export function buildProjectTree(projects: RedmineProject[]): ProjectTree {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const children = new Map<number, RedmineProject[]>();
  const roots: RedmineProject[] = [];

  projects.forEach((p) => {
    // A project whose parent is not visible to the user is shown as a root.
    const parentId = p.parent && byId.has(p.parent.id) ? p.parent.id : null;
    if (parentId === null) {
      roots.push(p);
    } else {
      const list = children.get(parentId) || [];
      list.push(p);
      children.set(parentId, list);
    }
  });
  roots.sort(byName);
  children.forEach((list) => list.sort(byName));

  const pathOf = (id: number): string[] => {
    const path: string[] = [];
    let current = byId.get(id);
    for (let guard = 0; current && guard < 50; guard++) {
      path.unshift(current.name);
      current = current.parent ? byId.get(current.parent.id) : undefined;
    }
    return path;
  };

  const memo = new Map<number, number>();
  const descendantsOf = (id: number): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let total = 0;
    (children.get(id) || []).forEach((child) => {
      total += 1 + descendantsOf(child.id);
    });
    memo.set(id, total);
    return total;
  };

  return { byId, children, roots, pathOf, descendantsOf };
}

/** Text for the header chip and its tooltip; null when there is no restriction. */
export function describeUnit(
  scope: UnitScope | null,
  projects: RedmineProject[]
): { label: string; title: string } | null {
  if (!scope) return null;
  const tree = buildProjectTree(projects);
  const name = (id: number) => tree.byId.get(id)?.name ?? `#${id}`;
  const extra = scope.projectIds.length > 1 ? ` +${scope.projectIds.length - 1}` : '';
  const paths = scope.projectIds.map((id) => tree.pathOf(id).join(' › ') || `#${id}`);
  return {
    label: `Unidade: ${name(scope.projectIds[0])}${extra}`,
    title:
      `Só as tarefas desta unidade são baixadas ${scope.includeSubprojects ? '(com subprojetos)' : '(sem subprojetos)'}:\n` +
      paths.join('\n'),
  };
}
