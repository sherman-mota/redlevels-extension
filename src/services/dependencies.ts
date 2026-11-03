import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { STALE_DAYS } from './cardHealth';
import { stageKeyOf } from './issueStage';
import { NO_TEAM_LABEL, teamsOf } from './teams';

/**
 * Dependencies between issues: who is waiting for whom.
 *
 * Source: the Redmine relations "blocks" (and its inverse "blocked") and "precedes" (and "follows");
 * other relation types are ignored. An edge is ACTIVE while the waiting issue is open and the blocker
 * is not finished yet (or is not in the loaded data, which is reported as "out of scope").
 * Pure functions; `now` is injectable.
 */

const DAY_MS = 86_400_000;

export type DependencyKind = 'blocks' | 'precedes';

export interface Dependency {
  /** The blocker (the issue others wait for) and the issue that waits. */
  blockerId: number;
  waitingId: number;
  kind: DependencyKind;
  /** Null when the issue is not among the loaded ones. */
  blocker: RedmineIssue | null;
  waiting: RedmineIssue | null;
  active: boolean;
  /** Days without update of the blocker. */
  stalledDays: number;
  /** Days the blocker is past its due date (0 = not overdue). */
  overdueDays: number;
  /** The blocker is due after the issue that waits for it. */
  deadlineConflict: boolean;
  /** Blocker and waiting issue are in different teams (or projects, when there are no teams). */
  crossGroup: boolean;
  blockerUnassigned: boolean;
  blockerOutOfScope: boolean;
  /** Higher = worse; orders the list. */
  score: number;
}

export interface DependencyKpis {
  waiting: number;
  crossGroup: number;
  stalledBlockers: number;
  overdueBlockers: number;
  deadlineConflicts: number;
  outOfScope: number;
  relations: number;
}

export interface DependencyGraph {
  edges: Dependency[];
  active: Dependency[];
  /** Active edges by id of the issue that waits / by id of the blocker (only for loaded issues). */
  waitingOn: Map<number, Dependency[]>;
  blocking: Map<number, Dependency[]>;
  /** Every edge (active or resolved) touching an issue. */
  byIssue: Map<number, { waits: Dependency[]; blocks: Dependency[] }>;
  kpis: DependencyKpis;
}

/** Team name of the assignee when teams exist, else the project name. */
export function groupOf(issue: RedmineIssue, config: Pick<RedlevelsConfig, 'teams'>): string {
  const teams = teamsOf(config);
  if (teams.length) {
    const personId = issue.assigned_to?.id;
    return teams.find((t) => t.members.some((m) => m.id === personId))?.name ?? NO_TEAM_LABEL;
  }
  return issue.project?.name ?? '—';
}

/** What the group is called in the UI ("equipe" or "projeto"). */
export function groupKind(config: Pick<RedlevelsConfig, 'teams'>): 'equipe' | 'projeto' {
  return teamsOf(config).length ? 'equipe' : 'projeto';
}

function edgeOf(
  blockerId: number,
  waitingId: number,
  kind: DependencyKind,
  blocker: RedmineIssue | null,
  waiting: RedmineIssue | null,
  config: RedlevelsConfig,
  today: Date,
  now: number
): Dependency {
  const isOpen = (i: RedmineIssue) => stageKeyOf(i, config) !== 'done';
  const waitingOpen = waiting ? isOpen(waiting) : true;
  const blockerOpen = blocker ? isOpen(blocker) : true;
  const stalledDays = blocker?.updated_on ? Math.max(0, Math.floor((now - new Date(blocker.updated_on).getTime()) / DAY_MS)) : 0;
  const overdueDays = blocker?.due_date
    ? Math.max(0, Math.round((today.getTime() - new Date(`${blocker.due_date.slice(0, 10)}T00:00:00`).getTime()) / DAY_MS))
    : 0;
  const deadlineConflict = !!(blocker?.due_date && waiting?.due_date && blocker.due_date > waiting.due_date);
  const crossGroup = !!(blocker && waiting && groupOf(blocker, config) !== groupOf(waiting, config));
  const blockerUnassigned = !!blocker && !blocker.assigned_to;
  const score =
    (overdueDays > 0 ? 3 : 0) +
    (stalledDays >= STALE_DAYS ? 3 : 0) +
    (deadlineConflict ? 2 : 0) +
    (crossGroup ? 2 : 0) +
    (!blocker ? 1 : 0) +
    (blockerUnassigned ? 1 : 0);
  return {
    blockerId,
    waitingId,
    kind,
    blocker,
    waiting,
    active: waitingOpen && blockerOpen,
    stalledDays,
    overdueDays,
    deadlineConflict,
    crossGroup,
    blockerUnassigned,
    blockerOutOfScope: !blocker,
    score,
  };
}

export function buildDependencies(issues: RedmineIssue[], config: RedlevelsConfig, now: number = Date.now()): DependencyGraph {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const byId = new Map(issues.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const edges: Dependency[] = [];

  issues.forEach((issue) => {
    (issue.relations ?? []).forEach((r) => {
      let blockerId = r.issue_id;
      let waitingId = r.issue_to_id;
      let kind = r.relation_type;
      // "A blocked B" and "A follows B" are the same dependency read from the other side.
      if (kind === 'blocked' || kind === 'follows') {
        [blockerId, waitingId] = [waitingId, blockerId];
        kind = kind === 'blocked' ? 'blocks' : 'precedes';
      }
      if (kind !== 'blocks' && kind !== 'precedes') return;
      const key = `${blockerId}>${waitingId}:${kind}`;
      if (seen.has(key)) return;
      seen.add(key);
      const blocker = byId.get(blockerId) ?? null;
      const waiting = byId.get(waitingId) ?? null;
      if (!blocker && !waiting) return;
      edges.push(edgeOf(blockerId, waitingId, kind, blocker, waiting, config, today, now));
    });
  });

  const waitingOn = new Map<number, Dependency[]>();
  const blocking = new Map<number, Dependency[]>();
  const byIssue = new Map<number, { waits: Dependency[]; blocks: Dependency[] }>();
  const entry = (id: number) => {
    let e = byIssue.get(id);
    if (!e) byIssue.set(id, (e = { waits: [], blocks: [] }));
    return e;
  };
  const push = (map: Map<number, Dependency[]>, id: number, e: Dependency) => map.set(id, [...(map.get(id) ?? []), e]);
  edges.forEach((e) => {
    entry(e.waitingId).waits.push(e);
    entry(e.blockerId).blocks.push(e);
    if (e.active) {
      if (e.waiting) push(waitingOn, e.waitingId, e);
      if (e.blocker) push(blocking, e.blockerId, e);
    }
  });

  const active = edges.filter((e) => e.active);
  const distinct = (list: Dependency[]) => new Set(list.map((e) => e.blockerId)).size;
  return {
    edges,
    active,
    waitingOn,
    blocking,
    byIssue,
    kpis: {
      waiting: waitingOn.size,
      crossGroup: new Set(active.filter((e) => e.crossGroup && e.waiting).map((e) => e.waitingId)).size,
      stalledBlockers: distinct(active.filter((e) => e.blocker && e.stalledDays >= STALE_DAYS)),
      overdueBlockers: distinct(active.filter((e) => e.blocker && e.overdueDays > 0)),
      deadlineConflicts: active.filter((e) => e.deadlineConflict).length,
      outOfScope: active.filter((e) => e.blockerOutOfScope).length,
      relations: edges.length,
    },
  };
}

/** "#12 #40": the active blockers the issue waits for, or the issues that wait for it. For the CSV. */
export function dependencyIds(graph: DependencyGraph, issueId: number, side: 'waits' | 'blocks'): string {
  const entry = graph.byIssue.get(issueId);
  if (!entry) return '';
  return side === 'waits'
    ? entry.waits.filter((e) => e.active).map((e) => `#${e.blockerId}`).join(' ')
    : entry.blocks.filter((e) => e.active).map((e) => `#${e.waitingId}`).join(' ');
}
