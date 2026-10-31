import type {
  InboxIds,
  RedlevelsConfig,
  RedmineCustomFieldDef,
  RedmineIssue,
  RedmineProject,
  RedmineStatus,
  RedmineTracker,
  RedmineUser,
} from '../types/redmine';
import { getItem, removeItem, setItem } from './storage';
import { dataScopeKey } from './incrementalSync';

/**
 * Local cache of the loaded issues (chrome.storage.local, or localStorage outside the extension).
 *
 * On open, the app shows the cached snapshot right away and then asks Redmine only for what changed
 * (incremental sync), instead of repeating the full load.
 *
 * Privacy: the API key is NEVER stored; only a hash of it takes part in the scope signature, so the
 * cache is discarded when the key changes. Description, journals, watchers, relations and
 * allowed_statuses are not stored either (the detail modal fetches them on demand).
 */

const CACHE_KEY = 'redlevels_cache_v1';
const STATS_KEY = 'redlevels_cache_stats_v1';
const CACHE_VERSION = 1;

/** A snapshot older than this (since the last FULL load) is ignored, to drop deleted/moved issues. */
export const CACHE_FULL_MAX_AGE_MS = 24 * 3600 * 1000;

export interface CacheSnapshot {
  v: number;
  /** Scope signature the data was loaded with; the snapshot is only valid for the same signature. */
  scope: string;
  /** When the last load (full or incremental) finished. */
  savedAt: number;
  /** When the last FULL load finished. */
  fullAt: number;
  /** Incremental sync watermark (newest `updated_on` sent by the server). */
  watermark: string;
  user: RedmineUser | null;
  issues: RedmineIssue[];
  inbox: InboxIds;
  meta: {
    projects: RedmineProject[];
    trackers: RedmineTracker[];
    statuses: RedmineStatus[];
    fields: RedmineCustomFieldDef[];
    statusIds: Record<number, number[]>;
  };
}

export interface CacheStats {
  bytes: number;
  count: number;
  savedAt: number;
}

/** Non-cryptographic 32-bit hash (djb2). Only used to notice a changed API key; not reversible in practice. */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

/** Everything that makes a snapshot reusable: server, credentials (hash), and the data scope. */
export function scopeSignature(
  config: Pick<RedlevelsConfig, 'redmineUrl' | 'apiKey'> & Parameters<typeof dataScopeKey>[0]
): string {
  return JSON.stringify([
    (config.redmineUrl || '').replace(/\/+$/, ''),
    hashText(config.apiKey || ''),
    dataScopeKey(config),
  ]);
}

const ON_DEMAND_FIELDS = ['description', 'journals', 'watchers', 'relations', 'allowed_statuses'];

/** Issue without the heavy / on-demand fields. */
export function slimIssue(issue: RedmineIssue): RedmineIssue {
  const slim: Record<string, unknown> = { ...issue };
  for (const key of ON_DEMAND_FIELDS) delete slim[key];
  return slim as unknown as RedmineIssue;
}

/** True when `snapshot` can be used with `config` at time `now`. */
export function isSnapshotValid(
  snapshot: CacheSnapshot | undefined,
  config: Parameters<typeof scopeSignature>[0],
  now: number = Date.now()
): snapshot is CacheSnapshot {
  return (
    !!snapshot &&
    snapshot.v === CACHE_VERSION &&
    snapshot.scope === scopeSignature(config) &&
    Array.isArray(snapshot.issues) &&
    !!snapshot.watermark &&
    !!snapshot.fullAt &&
    now - snapshot.fullAt < CACHE_FULL_MAX_AGE_MS
  );
}

/** Reads the snapshot; an invalid one (other scope, too old, corrupt) is deleted and null is returned. */
export async function loadSnapshot(config: Parameters<typeof scopeSignature>[0]): Promise<CacheSnapshot | null> {
  try {
    const stored = await getItem<CacheSnapshot>(CACHE_KEY);
    if (!stored) return null;
    if (isSnapshotValid(stored, config)) return stored;
    await clearSnapshot();
  } catch (e) {
    console.warn('Cache local ignorado', e);
  }
  return null;
}

/** Writes the snapshot and returns its stats. Throws if the browser refuses (e.g. no space). */
export async function saveSnapshot(
  config: Parameters<typeof scopeSignature>[0],
  data: Omit<CacheSnapshot, 'v' | 'scope' | 'issues'> & { issues: RedmineIssue[] }
): Promise<CacheStats> {
  const snapshot: CacheSnapshot = {
    ...data,
    v: CACHE_VERSION,
    scope: scopeSignature(config),
    issues: data.issues.map(slimIssue),
  };
  const stats: CacheStats = {
    bytes: new TextEncoder().encode(JSON.stringify(snapshot)).length,
    count: snapshot.issues.length,
    savedAt: snapshot.savedAt,
  };
  await setItem(CACHE_KEY, snapshot);
  await setItem(STATS_KEY, stats);
  return stats;
}

export async function clearSnapshot(): Promise<void> {
  await removeItem(CACHE_KEY).catch(() => undefined);
  await removeItem(STATS_KEY).catch(() => undefined);
}

export async function loadCacheStats(): Promise<CacheStats | null> {
  try {
    return (await getItem<CacheStats>(STATS_KEY)) || null;
  } catch {
    return null;
  }
}
