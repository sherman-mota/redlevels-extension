import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { STALE_DAYS, cardMeta } from './cardHealth';
import { isOverdue, stageKeyOf } from './issueStage';

/**
 * Health of each Flight Level, from the open issues already loaded. Pure functions; `now` is injectable.
 *
 * - problema: a blocked or overdue issue, or in-progress count above the WIP limit;
 * - atencao: no problem, but issues without update for STALE_DAYS or more;
 * - ok: none of the above.
 * Strategic level: an initiative is at risk when one of its open tactical issues is blocked or overdue.
 */

export type LevelKey = 'operacional' | 'tatico' | 'estrategico';
export type HealthState = 'problema' | 'atencao' | 'ok';

export const LEVEL_LABEL: Record<LevelKey, string> = {
  operacional: 'Operacional',
  tatico: 'Tático',
  estrategico: 'Estratégico',
};

export const LEVEL_QUESTION: Record<LevelKey, string> = {
  operacional: 'O que as equipes estão executando agora?',
  tatico: 'Como estão as entregas que reúnem várias tarefas?',
  estrategico: 'As iniciativas estão avançando?',
};

export interface LevelHealth {
  state: HealthState;
  /** Issues (or initiatives, at the strategic level) behind the state: problems, else stale ones. */
  count: number;
  blocked: number;
  overdue: number;
  stale: number;
  inProgress: number;
  /** WIP limit applied (0 = none). */
  limit: number;
  overLimit: boolean;
}

export interface ProblemTag {
  tone: 'danger' | 'warn';
  icon: '▲' | '●';
  label: string;
}

export interface WorstItem {
  issue: RedmineIssue;
  tags: ProblemTag[];
  /** Higher = worse. */
  score: number;
}

export interface InitiativeRisk {
  name: string;
  total: number;
  atRisk: number;
  stale: number;
}

export interface LevelsOverview {
  levels: Record<LevelKey, LevelHealth>;
  /** Open issues with a problem or stale, worst first. */
  worst: { operacional: WorstItem[]; tatico: WorstItem[] };
  /** Initiatives with risk or stale deliveries, worst first. */
  initiatives: InitiativeRisk[];
}

/** Which tracker level the issue belongs to (null when it is in neither list). */
export function levelOf(issue: RedmineIssue, config: RedlevelsConfig): 'operacional' | 'tatico' | null {
  const tracker = issue.tracker?.id;
  if ((config.tacticalTrackerIds || []).includes(tracker)) return 'tatico';
  const operational = config.operationalTrackerIds || [];
  return operational.length === 0 || operational.includes(tracker) ? 'operacional' : null;
}

/** Problems of one open issue and a score to rank it (blocked > overdue > stale). */
export function problemsOf(issue: RedmineIssue, config: RedlevelsConfig, now: number = Date.now()): WorstItem {
  const tags: ProblemTag[] = [];
  let score = 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const meta = cardMeta(issue, now);

  if (issue.is_blocked) {
    tags.push({ tone: 'danger', icon: '▲', label: 'Bloqueada' });
    score += 1000;
  }
  if (isOverdue(issue, config, today) && meta.due) {
    tags.push({ tone: 'danger', icon: '▲', label: meta.due.label });
    score += 500 + -meta.due.days;
  }
  if (meta.staleDays !== null) {
    tags.push({ tone: 'warn', icon: '●', label: `Parada ${meta.staleDays} d` });
    score += meta.staleDays;
  }
  return { issue, tags, score };
}

const isDanger = (item: WorstItem) => item.tags.some((t) => t.tone === 'danger');

export function computeLevelHealth(issues: RedmineIssue[], config: RedlevelsConfig, now: number = Date.now()): LevelsOverview {
  const limit = config.wipLimits?.in_progress ?? 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const open: Record<'operacional' | 'tatico', RedmineIssue[]> = { operacional: [], tatico: [] };
  issues.forEach((issue) => {
    const level = levelOf(issue, config);
    if (level && stageKeyOf(issue, config) !== 'done') open[level].push(issue);
  });

  const worst = {} as LevelsOverview['worst'];
  const levels = {} as LevelsOverview['levels'];
  (['operacional', 'tatico'] as const).forEach((level) => {
    const items = open[level].map((i) => problemsOf(i, config, now)).filter((p) => p.tags.length > 0);
    const blocked = open[level].filter((i) => i.is_blocked).length;
    const problems = items.filter(isDanger);
    const stale = items.filter((p) => p.tags.some((t) => t.tone === 'warn')).length;
    const inProgress = open[level].filter((i) => stageKeyOf(i, config) === 'in_progress').length;
    const overLimit = limit > 0 && inProgress > limit;
    worst[level] = items.sort((a, b) => b.score - a.score);
    levels[level] = {
      state: problems.length > 0 || overLimit ? 'problema' : stale > 0 ? 'atencao' : 'ok',
      count: problems.length || stale,
      blocked,
      overdue: open[level].filter((i) => isOverdue(i, config, today)).length,
      stale,
      inProgress,
      limit,
      overLimit,
    };
  });

  const byName = new Map<string, InitiativeRisk>();
  open.tatico.forEach((issue) => {
    const name = String(issue.strategic_initiative ?? '').trim();
    if (!name) return;
    const entry = byName.get(name) ?? { name, total: 0, atRisk: 0, stale: 0 };
    entry.total++;
    const p = problemsOf(issue, config, now);
    if (isDanger(p)) entry.atRisk++;
    else if (p.tags.length) entry.stale++;
    byName.set(name, entry);
  });
  const initiatives = [...byName.values()]
    .filter((x) => x.atRisk || x.stale)
    .sort((a, b) => b.atRisk - a.atRisk || b.stale - a.stale || a.name.localeCompare(b.name, 'pt-BR'));
  const atRisk = initiatives.filter((x) => x.atRisk).length;
  const staleOnly = initiatives.length - atRisk;
  levels.estrategico = {
    state: atRisk > 0 ? 'problema' : staleOnly > 0 ? 'atencao' : 'ok',
    count: atRisk || staleOnly,
    blocked: 0,
    overdue: 0,
    stale: 0,
    inProgress: 0,
    limit: 0,
    overLimit: false,
  };

  return { levels, worst, initiatives };
}

export interface Verdict {
  state: HealthState;
  icon: '▲' | '●' | '✓';
  label: string;
  detail: string;
}

/** One-line verdict of a level. */
export function verdictOf(level: LevelKey, h: LevelHealth): Verdict {
  if (level === 'estrategico') {
    if (h.state === 'problema')
      return { state: h.state, icon: '▲', label: 'Problemas', detail: `${h.count} iniciativa(s) com entrega bloqueada ou atrasada` };
    if (h.state === 'atencao')
      return { state: h.state, icon: '●', label: 'Atenção', detail: `${h.count} iniciativa(s) com entrega parada` };
    return { state: 'ok', icon: '✓', label: 'Saudável', detail: 'nenhuma iniciativa em risco' };
  }
  if (h.state === 'problema') {
    const parts: string[] = [];
    if (h.overLimit) parts.push(`WIP acima do limite (${h.inProgress} de ${h.limit})`);
    if (h.blocked) parts.push(`${h.blocked} bloqueada(s)`);
    if (h.overdue) parts.push(`${h.overdue} atrasada(s)`);
    if (h.stale) parts.push(`${h.stale} parada(s)`);
    return { state: h.state, icon: '▲', label: 'Problemas', detail: parts.join(' · ') };
  }
  if (h.state === 'atencao')
    return { state: h.state, icon: '●', label: 'Atenção', detail: `${h.stale} item(ns) parado(s) há ${STALE_DAYS} dias ou mais` };
  return { state: 'ok', icon: '✓', label: 'Saudável', detail: 'nenhum bloqueio, atraso ou item parado' };
}
