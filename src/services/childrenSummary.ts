import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { STALE_DAYS } from './cardHealth';
import { isOverdue, stageKeyOf } from './issueStage';

/**
 * Progress of the child tasks of a delivery (tactical issue), from the issues already loaded.
 * Children that are not among the loaded issues are counted apart (`missing`). Pure; `now` is injectable.
 */

export interface ChildrenSummary {
  total: number;
  done: number;
  inProgress: number;
  /** Open children that are blocked / overdue / without update for STALE_DAYS or more. */
  blocked: number;
  overdue: number;
  stale: number;
  /** Children that are not in the loaded data. */
  missing: number;
}

export interface ChildrenRisk {
  icon: '▲' | '●' | '✓';
  label: string;
  tone: 'danger' | 'warn' | 'ok';
}

const DAY_MS = 86_400_000;

export function summarizeChildren(
  children: { id: number }[],
  byId: Map<number, RedmineIssue>,
  config: RedlevelsConfig,
  now: number = Date.now()
): ChildrenSummary {
  const summary: ChildrenSummary = { total: children.length, done: 0, inProgress: 0, blocked: 0, overdue: 0, stale: 0, missing: 0 };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  children.forEach((child) => {
    const issue = byId.get(child.id);
    if (!issue) {
      summary.missing++;
      return;
    }
    const stage = stageKeyOf(issue, config);
    if (stage === 'done') {
      summary.done++;
      return;
    }
    if (stage === 'in_progress') summary.inProgress++;
    if (issue.is_blocked) summary.blocked++;
    if (isOverdue(issue, config, today)) summary.overdue++;
    if (issue.updated_on && (now - new Date(issue.updated_on).getTime()) / DAY_MS >= STALE_DAYS) summary.stale++;
  });
  return summary;
}

/** At risk: a blocked or overdue child. Attention: a stale child. Ready to close: every child done. */
export function childrenRisk(summary: ChildrenSummary, parentOpen: boolean): ChildrenRisk | null {
  if (summary.blocked > 0 || summary.overdue > 0) return { icon: '▲', label: 'Em risco', tone: 'danger' };
  if (summary.stale > 0) return { icon: '●', label: 'Atenção', tone: 'warn' };
  if (parentOpen && summary.total > 0 && summary.done === summary.total) return { icon: '✓', label: 'Pronta para fechar', tone: 'ok' };
  return null;
}
