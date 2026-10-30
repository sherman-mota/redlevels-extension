import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { DEFAULT_CLOSED_LOOKBACK_DAYS } from './redmineApi';

/**
 * Incremental sync helpers (pure functions, no I/O).
 *
 * Idea: after a full load we remember the newest `updated_on` the *server* sent us (the watermark).
 * The next sync asks Redmine only for issues with `updated_on >= watermark` and merges them by id
 * into the issues already in memory. See `RedmineClient.getIssuesSince` for the query and
 * `App.loadData` for the orchestration and the fallback to a full load.
 */

/** Safety margin subtracted from the watermark, to absorb commit/clock skew between requests. */
export const WATERMARK_SAFETY_MS = 60_000;

/**
 * Settings that change WHICH issues are downloaded. Anything that differs here invalidates the data
 * already in memory (and the local cache), so it forces a full reload. Saving other settings
 * (theme, column order...) must not.
 */
export function dataScopeKey(
  config: Pick<
    RedlevelsConfig,
    'operationalTrackerIds' | 'tacticalTrackerIds' | 'loadAllIssueStatuses' | 'closedLookbackDays' | 'maxIssuesLimit'
  >
): string {
  const sorted = (ids?: number[]) => [...(ids || [])].sort((a, b) => a - b);
  return JSON.stringify([
    sorted(config.operationalTrackerIds),
    sorted(config.tacticalTrackerIds),
    !!config.loadAllIssueStatuses,
    config.closedLookbackDays ?? null,
    config.maxIssuesLimit ?? null,
  ]);
}

/** What the last synchronization did; shown in the header. */
export interface SyncInfo {
  /** Local time the sync finished (ISO). Display only, never used for queries. */
  at: string;
  /** `cache`: showing the local snapshot; the sync that follows replaces it. */
  mode: 'full' | 'incremental' | 'cache';
  /** Full / cache: issues held. Incremental: issues returned as changed. */
  count: number;
}

/** Newest `updated_on` among the given issues (Redmine ISO strings compare lexicographically). */
export function maxUpdatedOn(issues: RedmineIssue[], previous: string | null = null): string | null {
  let max = previous || '';
  for (const i of issues) {
    if (i.updated_on && i.updated_on > max) max = i.updated_on;
  }
  return max || null;
}

/**
 * Value for the `updated_on=>=` filter: the watermark minus the safety margin,
 * as `YYYY-MM-DDTHH:MM:SSZ` (the format Redmine accepts for datetime filters).
 */
export function watermarkToSince(watermark: string): string {
  const t = new Date(watermark).getTime() - WATERMARK_SAFETY_MS;
  return new Date(t).toISOString().slice(0, 19) + 'Z';
}

/**
 * Oldest day (`YYYY-MM-DD`) a closed issue may have and still be kept, or null when closed issues
 * are never discarded. Same rule as the full load: Redmine filters by date (`updated_on=>=YYYY-MM-DD`),
 * so the whole cutoff day is included.
 */
export function closedCutoffDate(
  config: Pick<RedlevelsConfig, 'loadAllIssueStatuses' | 'closedLookbackDays'>,
  now: number = Date.now()
): string | null {
  if (config.loadAllIssueStatuses) return null;
  const days =
    config.closedLookbackDays !== undefined && config.closedLookbackDays !== 0
      ? config.closedLookbackDays
      : DEFAULT_CLOSED_LOOKBACK_DAYS;
  if (days <= 0) return null;
  return new Date(now - days * 86400000).toISOString().slice(0, 10);
}

/**
 * Merges the issues returned by an incremental query into the ones already loaded.
 *
 * - Changed issues replace the old copy entirely (the list endpoint returns the full issue).
 * - Inbox issues (assigned/watched, possibly outside the configured trackers) are added when new,
 *   and replace the old copy only if they changed since `since`.
 * - Closed issues older than `cutoff` are dropped, mirroring the full load's window.
 * - `children` is cleared on every issue: it is derived data. The caller runs `linkChildren` on the
 *   result, so a child that was re-parented or moved out of scope doesn't linger on its old parent.
 */
export function mergeIncremental(
  previous: RedmineIssue[],
  changed: RedmineIssue[],
  inbox: RedmineIssue[] | null,
  options: { since: string; cutoff: string | null }
): RedmineIssue[] {
  const byId = new Map<number, RedmineIssue>(previous.map((i) => [i.id, i]));
  changed.forEach((i) => byId.set(i.id, i));
  inbox?.forEach((i) => {
    if (!byId.has(i.id) || (i.updated_on && i.updated_on >= options.since)) byId.set(i.id, i);
  });

  const { cutoff } = options;
  return Array.from(byId.values())
    .filter(
      (i) => !(cutoff && i.status?.is_closed && i.updated_on && i.updated_on.slice(0, 10) < cutoff)
    )
    .map((i) => (i.children ? { ...i, children: undefined } : i));
}
