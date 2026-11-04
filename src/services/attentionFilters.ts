import type { RedmineIssue } from '../types/redmine';
import { STALE_DAYS } from './cardHealth';

/**
 * Attention shortcuts of the level panels: "what needs action". Each one only applies to OPEN issues.
 * Several selected shortcuts mean "any of them" (union). Pure functions; `now` is injectable.
 */

export type AttentionKey = 'blocked' | 'late' | 'stale' | 'noassignee';

export interface AttentionFilter {
  key: AttentionKey;
  label: string;
  /** ▲ needs action, ● keep an eye on it. The icon always accompanies the text. */
  icon: '▲' | '●';
  tone: 'danger' | 'warn';
  title: string;
  test: (issue: RedmineIssue, now: number) => boolean;
}

const DAY_MS = 86_400_000;

export const ATTENTION_FILTERS: AttentionFilter[] = [
  { key: 'blocked', label: 'Bloqueadas', icon: '▲', tone: 'danger', title: 'Abertas com impedimento', test: (i) => !!i.is_blocked },
  {
    key: 'late',
    label: 'Atrasadas',
    icon: '▲',
    tone: 'danger',
    title: 'Abertas com prazo vencido',
    test: (i, now) => {
      if (!i.due_date) return false;
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      return new Date(`${i.due_date.slice(0, 10)}T00:00:00`) < today;
    },
  },
  {
    key: 'stale',
    label: `Paradas +${STALE_DAYS} d`,
    icon: '●',
    tone: 'warn',
    title: `Abertas sem atualização há ${STALE_DAYS} dias ou mais`,
    test: (i, now) => !!i.updated_on && (now - new Date(i.updated_on).getTime()) / DAY_MS >= STALE_DAYS,
  },
  { key: 'noassignee', label: 'Sem responsável', icon: '●', tone: 'warn', title: 'Abertas sem responsável', test: (i) => !i.assigned_to },
];

/** Open = not in a "done" status of the mapping and not closed in Redmine. */
export function isOpenIssue(issue: RedmineIssue, doneStatusIds: number[]): boolean {
  return !issue.status?.is_closed && !doneStatusIds.includes(issue.status?.id);
}

/** True when nothing is selected, or the issue is open and matches any selected shortcut. */
export function passesAttention(
  issue: RedmineIssue,
  selected: AttentionKey[],
  doneStatusIds: number[],
  now: number = Date.now()
): boolean {
  if (selected.length === 0) return true;
  if (!isOpenIssue(issue, doneStatusIds)) return false;
  return ATTENTION_FILTERS.some((f) => selected.includes(f.key) && f.test(issue, now));
}

/** Count of open issues per shortcut, for the chips. */
export function attentionCounts(
  issues: RedmineIssue[],
  doneStatusIds: number[],
  now: number = Date.now()
): Record<AttentionKey, number> {
  const open = issues.filter((i) => isOpenIssue(i, doneStatusIds));
  const counts = {} as Record<AttentionKey, number>;
  ATTENTION_FILTERS.forEach((f) => {
    counts[f.key] = open.filter((i) => f.test(i, now)).length;
  });
  return counts;
}

export function toggleAttention(selected: AttentionKey[], key: AttentionKey): AttentionKey[] {
  return selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
}
