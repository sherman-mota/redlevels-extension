import type { RedlevelsConfig, RedmineIssue, Team } from '../types/redmine';

/** Teams are only a grouping of people; a person belongs to at most one team. */

export const NO_TEAM_LABEL = 'Sem equipe';

// One shared empty list: a fresh [] on every call would change the identity used in hook dependencies.
const NO_TEAMS: Team[] = [];

export function teamsOf(config: Pick<RedlevelsConfig, 'teams'>): Team[] {
  return Array.isArray(config.teams) ? config.teams : NO_TEAMS;
}

/** person id -> team id */
export function teamIdByPerson(teams: Team[]): Map<number, string> {
  const map = new Map<number, string>();
  teams.forEach((team) => team.members.forEach((m) => map.set(m.id, team.id)));
  return map;
}

/** Name of the team of the issue's assignee, or '' when the person has none (or nobody is assigned). */
export function teamNameOf(issue: RedmineIssue, teams: Team[]): string {
  const personId = issue.assigned_to?.id;
  if (personId === undefined) return '';
  return teams.find((team) => team.members.some((m) => m.id === personId))?.name ?? '';
}

/** Moves a person to a team (or out of every team when `teamId` is null). Returns a new list. */
export function movePerson(teams: Team[], person: { id: number; name: string }, teamId: string | null): Team[] {
  return teams.map((team) => {
    const without = team.members.filter((m) => m.id !== person.id);
    return team.id === teamId ? { ...team, members: [...without, { id: person.id, name: person.name }] } : { ...team, members: without };
  });
}

/** Keeps only well-formed teams from an untrusted value (imported file, old storage). */
export function sanitizeTeams(value: unknown): Team[] {
  if (!Array.isArray(value)) return [];
  const seenPeople = new Set<number>();
  const result: Team[] = [];
  for (const raw of value) {
    if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') continue;
    const members: Team['members'] = [];
    if (Array.isArray(raw.members)) {
      for (const m of raw.members) {
        if (!m || typeof m.id !== 'number' || typeof m.name !== 'string' || seenPeople.has(m.id)) continue;
        seenPeople.add(m.id);
        members.push({ id: m.id, name: m.name });
      }
    }
    result.push({ id: raw.id, name: raw.name, members });
  }
  return result;
}

export function newTeamId(): string {
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
