import type { RedlevelsConfig, RedmineIssue, Team } from '../types/redmine';
import { isOverdue, stageKeyOf } from './issueStage';

/**
 * Workload per person for the "Equipes" tab. Pure functions; `today` is injectable for tests.
 *
 * - open: everything that is not in the done stage (including statuses without mapping);
 * - backlog / analysis / in_progress: open issues in that stage;
 * - blocked / overdue: open issues with an impediment / with a due date before today;
 * - done: finished issues inside the loaded window (see "dias de histórico" in the settings).
 */

export const NO_OWNER = 'none';

export interface PersonStats {
  open: number;
  backlog: number;
  analysis: number;
  in_progress: number;
  blocked: number;
  overdue: number;
  done: number;
}

export interface PersonRow {
  /** Redmine user id, or NO_OWNER for issues without assignee. */
  id: number | typeof NO_OWNER;
  name: string;
  issues: RedmineIssue[];
  stats: PersonStats;
}

export const emptyStats = (): PersonStats => ({
  open: 0,
  backlog: 0,
  analysis: 0,
  in_progress: 0,
  blocked: 0,
  overdue: 0,
  done: 0,
});

export function sumStats(rows: PersonRow[]): PersonStats {
  const total = emptyStats();
  rows.forEach((row) => {
    (Object.keys(total) as (keyof PersonStats)[]).forEach((k) => {
      total[k] += row.stats[k];
    });
  });
  return total;
}

/** One row per assignee found in `issues`, plus every member of a team (even with no issues). */
export type HeatLevel = 'zero' | 'neutral' | 'danger' | 'warn' | 'ok';

export interface HeatCell {
  level: HeatLevel;
  /** Always shown with the number, so the state never depends on color alone. */
  icon: '' | '▲' | '●' | '✓';
  title: string;
}

/**
 * Heat map of the people table. "Andamento" is compared with the WIP limit per person (Fluxo tab);
 * "Bloq." and "Atras." stand out at any value above zero; zero is dimmed. Total rows (`isTotal`)
 * do not compare with the individual limit.
 */
export function heatCell(key: keyof PersonStats, value: number, perPersonLimit: number | undefined, isTotal: boolean): HeatCell {
  if (value === 0) return { level: 'zero', icon: '', title: '' };
  if (key === 'blocked') return { level: 'danger', icon: '▲', title: 'Abertas com impedimento' };
  if (key === 'overdue') return { level: 'danger', icon: '▲', title: 'Abertas com prazo vencido' };
  if (key === 'in_progress' && perPersonLimit && perPersonLimit > 0 && !isTotal) {
    const state = value > perPersonLimit ? 'acima do limite' : value === perPersonLimit ? 'no limite' : 'dentro do limite';
    const title = `${value} em andamento · limite por pessoa: ${perPersonLimit} (${state})`;
    if (value > perPersonLimit) return { level: 'danger', icon: '▲', title };
    if (value === perPersonLimit) return { level: 'warn', icon: '●', title };
    return { level: 'ok', icon: '✓', title };
  }
  return { level: 'neutral', icon: '', title: '' };
}

export function buildPeople(
  issues: RedmineIssue[],
  config: RedlevelsConfig,
  teams: Team[],
  today: Date = new Date()
): Map<PersonRow['id'], PersonRow> {
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  const people = new Map<PersonRow['id'], PersonRow>();
  const get = (id: PersonRow['id'], name: string) => {
    let row = people.get(id);
    if (!row) {
      row = { id, name, issues: [], stats: emptyStats() };
      people.set(id, row);
    }
    return row;
  };

  teams.forEach((team) => team.members.forEach((m) => get(m.id, m.name)));

  issues.forEach((issue) => {
    const assignee = issue.assigned_to;
    const row = get(assignee ? assignee.id : NO_OWNER, assignee ? assignee.name : 'Sem responsável');
    if (assignee) row.name = assignee.name;
    row.issues.push(issue);

    const stage = stageKeyOf(issue, config);
    if (stage === 'done') {
      row.stats.done++;
      return;
    }
    row.stats.open++;
    if (stage !== 'other') row.stats[stage]++;
    if (issue.is_blocked) row.stats.blocked++;
    if (isOverdue(issue, config, day)) row.stats.overdue++;
  });

  return people;
}
