import type { RedmineIssue } from '../types/redmine';

/**
 * Age, staleness, due date and health of a Kanban card. Pure functions; `now` is injectable for tests.
 *
 * Definitions: age = days since creation; stale = days since the last update, flagged from STALE_DAYS;
 * due = days until `due_date` (negative = overdue), flagged as "soon" within DUE_SOON_DAYS.
 */

export const STALE_DAYS = 14;
export const DUE_SOON_DAYS = 2;
const DAY_MS = 86_400_000;

export type DueKind = 'overdue' | 'today' | 'soon' | 'later';

export interface CardMeta {
  /** Days since creation (null if unknown). */
  ageDays: number | null;
  /** Days since the last update, only when it reaches STALE_DAYS. */
  staleDays: number | null;
  due: { kind: DueKind; days: number; label: string } | null;
}

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const daysBetween = (fromMs: number, toMs: number) => Math.floor((toMs - fromMs) / DAY_MS);

const formatShortDate = (isoDate: string) => {
  const [, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}`;
};

export function cardMeta(issue: RedmineIssue, now: number = Date.now()): CardMeta {
  const created = issue.created_on ? new Date(issue.created_on).getTime() : NaN;
  const updated = issue.updated_on ? new Date(issue.updated_on).getTime() : NaN;
  const ageDays = isNaN(created) ? null : Math.max(0, daysBetween(created, now));
  const sinceUpdate = isNaN(updated) ? 0 : Math.max(0, daysBetween(updated, now));
  const staleDays = sinceUpdate >= STALE_DAYS ? sinceUpdate : null;

  let due: CardMeta['due'] = null;
  if (issue.due_date) {
    const dueMs = new Date(`${issue.due_date.slice(0, 10)}T00:00:00`).getTime();
    if (!isNaN(dueMs)) {
      const days = Math.round((dueMs - startOfDay(now)) / DAY_MS);
      if (days < 0) due = { kind: 'overdue', days, label: `Atrasada ${-days} d` };
      else if (days === 0) due = { kind: 'today', days, label: 'Vence hoje' };
      else if (days <= DUE_SOON_DAYS) due = { kind: 'soon', days, label: `Vence em ${days} d` };
      else due = { kind: 'later', days, label: `Prazo ${formatShortDate(issue.due_date)}` };
    }
  }
  return { ageDays, staleDays, due };
}

/** problema: blocked, overdue or waiting for a problem blocker. atencao: stale, due within 2 days or waiting for someone. done: finished. ok: the rest. */
export type CardHealth = 'problema' | 'atencao' | 'ok' | 'done';

/**
 * `dependencyRisk` (see `dependencyRisk` in dependencies.ts): 2 = waits for a blocker that is stalled,
 * overdue or unassigned (counts as a problem); 1 = waits for someone (counts as attention).
 */
export function cardHealth(
  issue: RedmineIssue,
  isDone: boolean,
  now: number = Date.now(),
  dependencyRisk: 0 | 1 | 2 = 0
): CardHealth {
  if (isDone) return 'done';
  const { staleDays, due } = cardMeta(issue, now);
  if (issue.is_blocked || due?.kind === 'overdue' || dependencyRisk === 2) return 'problema';
  if (staleDays !== null || due?.kind === 'today' || due?.kind === 'soon' || dependencyRisk === 1) return 'atencao';
  return 'ok';
}
