import type { RedlevelsConfig, RedmineIssue, WipLimits } from '../types/redmine';
import { isOverdue, stageKeyOf } from './issueStage';
import { teamsOf } from './teams';

/**
 * Flow metrics for the "Fluxo" tab, computed over the issues already loaded. Pure functions.
 *
 * Definitions:
 * - lead time = creation -> closing (closed_on, or updated_on when Redmine did not send it);
 * - age = now - creation; stale ("parada") = now - last update;
 * - throughput = issues finished per week (Monday to Sunday), by closing date;
 * - WIP = open issues in the stages backlog / analysis / in progress.
 */

export type FlowLevel = 'operacional' | 'tatico' | 'todos';
export type WipStage = 'backlog' | 'analysis' | 'in_progress';

export const WIP_STAGES: { key: WipStage; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'analysis', label: 'Análise' },
  { key: 'in_progress', label: 'Em andamento' },
];

const DAY_MS = 86_400_000;

export interface FlowOptions {
  level: FlowLevel;
  /** Only the issues assigned to members of this team ('' = everyone). */
  teamId: string;
  /** Number of weeks in the window, counting the current one. */
  weeks: number;
  now?: number;
}

export interface FlowStageStat {
  key: WipStage;
  label: string;
  count: number;
  /** Median age in days of the open issues in this stage. */
  medianAge: number | null;
  oldestAge: number | null;
}

export interface FlowAgingItem {
  issue: RedmineIssue;
  ageDays: number;
  staleDays: number;
}

export interface FlowMetrics {
  open: RedmineIssue[];
  finished: RedmineIssue[];
  /** Finished per week, oldest first; the last one is the week in progress. */
  weeks: { start: number; count: number }[];
  /** Average finished per week over the complete weeks (null when there is none). */
  throughputAvg: number | null;
  /** Lead times in days, ascending. */
  leadTimes: number[];
  leadP50: number | null;
  leadP85: number | null;
  stages: FlowStageStat[];
  inProgress: RedmineIssue[];
  /** In-progress count per assignee, biggest first. */
  perPerson: [string, number][];
  oldestInProgress: FlowAgingItem[];
  leadBuckets: { label: string; count: number }[];
  inProgressMedianAge: number | null;
  blocked: number;
  overdue: number;
}

/** Percentile (nearest rank) of an ascending list. */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** Monday 00:00 of the week of `ms`. */
export function weekStart(ms: number): Date {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const LEAD_BUCKETS: [string, number, number][] = [
  ['Até 3 dias', 0, 3],
  ['4 a 7 dias', 3, 7],
  ['8 a 14 dias', 7, 14],
  ['15 a 30 dias', 14, 30],
  ['Mais de 30 dias', 30, Infinity],
];

export function computeFlow(issues: RedmineIssue[], config: RedlevelsConfig, options: FlowOptions): FlowMetrics {
  const now = options.now ?? Date.now();
  const tactical = config.tacticalTrackerIds || [];
  const operational = config.operationalTrackerIds || [];
  const inLevel = (issue: RedmineIssue) => {
    const tracker = issue.tracker?.id;
    if (options.level === 'tatico') return tactical.includes(tracker);
    if (options.level === 'operacional') return operational.length ? operational.includes(tracker) : !tactical.includes(tracker);
    return true;
  };

  const team = teamsOf(config).find((t) => t.id === options.teamId);
  const memberIds = team ? new Set(team.members.map((m) => m.id)) : null;
  const scoped = issues
    .filter((i) => inLevel(i) && (!memberIds || (i.assigned_to && memberIds.has(i.assigned_to.id))))
    .map((issue) => ({ issue, stage: stageKeyOf(issue, config) }));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // Window of whole weeks: from the Monday of (current week - (N-1)) until now.
  const first = weekStart(now);
  first.setDate(first.getDate() - 7 * (options.weeks - 1));
  const weeks: FlowMetrics['weeks'] = [];
  for (const d = new Date(first); d.getTime() <= now; d.setDate(d.getDate() + 7)) {
    weeks.push({ start: d.getTime(), count: 0 });
  }

  const open = scoped.filter((r) => r.stage !== 'done');
  const finished = scoped
    .filter((r) => r.stage === 'done')
    .map((r) => ({ issue: r.issue, end: new Date(r.issue.closed_on || r.issue.updated_on).getTime() }))
    .filter((r) => r.end >= first.getTime() && r.end <= now);

  finished.forEach((r) => {
    let idx = 0;
    weeks.forEach((w, j) => {
      if (w.start <= r.end) idx = j;
    });
    weeks[idx].count++;
  });

  const leadTimes = finished
    .map((r) => (r.end - new Date(r.issue.created_on).getTime()) / DAY_MS)
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);

  const complete = weeks.slice(0, -1);
  const throughputAvg = complete.length ? complete.reduce((sum, w) => sum + w.count, 0) / complete.length : null;

  const ageOf = (i: RedmineIssue) => (now - new Date(i.created_on).getTime()) / DAY_MS;
  const staleOf = (i: RedmineIssue) => (now - new Date(i.updated_on).getTime()) / DAY_MS;

  const stages: FlowStageStat[] = WIP_STAGES.map(({ key, label }) => {
    const ages = open
      .filter((r) => r.stage === key)
      .map((r) => ageOf(r.issue))
      .sort((a, b) => a - b);
    return {
      key,
      label,
      count: ages.length,
      medianAge: percentile(ages, 50),
      oldestAge: ages.length ? ages[ages.length - 1] : null,
    };
  });

  const inProgress = open.filter((r) => r.stage === 'in_progress').map((r) => r.issue);
  const byPerson = new Map<string, number>();
  inProgress.forEach((i) => {
    const name = i.assigned_to ? i.assigned_to.name : 'Sem responsável';
    byPerson.set(name, (byPerson.get(name) || 0) + 1);
  });

  return {
    open: open.map((r) => r.issue),
    finished: finished.map((r) => r.issue),
    weeks,
    throughputAvg,
    leadTimes,
    leadP50: percentile(leadTimes, 50),
    leadP85: percentile(leadTimes, 85),
    stages,
    inProgress,
    perPerson: [...byPerson.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')),
    oldestInProgress: inProgress
      .map((issue) => ({ issue, ageDays: ageOf(issue), staleDays: staleOf(issue) }))
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 10),
    leadBuckets: LEAD_BUCKETS.map(([label, from, to]) => ({
      label,
      count: leadTimes.filter((d) => (from === 0 ? d <= to : d > from && d <= to)).length,
    })),
    inProgressMedianAge: percentile(inProgress.map(ageOf).sort((a, b) => a - b), 50),
    blocked: open.filter((r) => r.issue.is_blocked).length,
    overdue: open.filter((r) => isOverdue(r.issue, config, today)).length,
  };
}

export type LimitState = 'none' | 'over' | 'at' | 'within';

/** Compares a WIP count with its limit (0/undefined = no limit). */
export function limitState(count: number, limit: number | undefined): LimitState {
  if (!limit || limit <= 0) return 'none';
  if (count > limit) return 'over';
  if (count === limit) return 'at';
  return 'within';
}

/** Keeps only positive integers from an untrusted value (imported file, old storage). */
export function sanitizeWipLimits(value: unknown): WipLimits {
  const limits: WipLimits = {};
  if (!value || typeof value !== 'object') return limits;
  (['backlog', 'analysis', 'in_progress', 'perPerson'] as const).forEach((key) => {
    const n = Number((value as Record<string, unknown>)[key]);
    if (Number.isInteger(n) && n > 0) limits[key] = n;
  });
  return limits;
}
