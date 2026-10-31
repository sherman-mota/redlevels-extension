import type { KanbanColumnKey, RedlevelsConfig, RedmineIssue, StatusMapping } from '../types/redmine';

const STAGE_ORDER: KanbanColumnKey[] = ['backlog', 'analysis', 'in_progress', 'done'];

/**
 * Kanban stage of an issue according to the status mapping of its level (tactical or operational).
 * Statuses without mapping fall back to `done` when Redmine marks them as closed, else `other`.
 */
export function stageKeyOf(issue: RedmineIssue, config: RedlevelsConfig): KanbanColumnKey | 'other' {
  const isTactical = config.tacticalTrackerIds.includes(issue.tracker?.id);
  const mapping: Partial<StatusMapping> =
    (isTactical ? config.tacticalStatusMapping : config.operationalStatusMapping) ||
    config.statusMapping ||
    {};
  for (const key of STAGE_ORDER) {
    if (mapping[key]?.includes(issue.status?.id)) return key;
  }
  return issue.status?.is_closed ? 'done' : 'other';
}

/** True when the issue has a due date before today and is not finished. */
export function isOverdue(issue: RedmineIssue, config: RedlevelsConfig, today: Date): boolean {
  if (!issue.due_date || stageKeyOf(issue, config) === 'done') return false;
  return new Date(`${issue.due_date.slice(0, 10)}T00:00:00`) < today;
}
