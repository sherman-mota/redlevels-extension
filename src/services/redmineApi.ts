import {
  RedmineUser,
  RedmineProject,
  RedmineTracker,
  RedmineStatus,
  RedmineCustomFieldDef,
  RedmineIssue,
  RedlevelsConfig,
  InboxIds,
} from '../types/redmine';
import {
  DEMO_USER,
  DEMO_PROJECTS,
  DEMO_TRACKERS,
  DEMO_STATUSES,
  DEMO_CUSTOM_FIELDS,
} from './demoData';
import { loadDemoIssues, saveDemoIssues } from './storage';
import type { UnitScope } from './unitScope';

export interface RedmineApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  latencyMs?: number;
}

const REQUEST_TIMEOUT_MS = 20000;
const PAGE_SIZE = 100; // Redmine's default max per page
export const DEFAULT_MAX_ISSUES = 5000;
export const DEFAULT_MAX_CLOSED_ISSUES = 2000;
export const DEFAULT_CLOSED_LOOKBACK_DAYS = 30;

export interface WorkspaceIssuesOptions {
  trackerIds?: number[];
  loadAllStatuses?: boolean;
  closedLookbackDays?: number; // 0 ou undefined: padrão, -1: sem limite de tempo
  maxIssuesLimit?: number; // Limite por tracker ou total
}

const isExtensionPage = typeof chrome !== 'undefined' && !!chrome.permissions;

/* ------------------------------------------------------------------ */
/* Host permission helpers                                             */
/* ------------------------------------------------------------------ */

export function normalizeRedmineUrl(url: string): string {
  return (url || '').trim().replace(/\/+$/, '');
}

/** Match pattern for the Redmine origin, e.g. "https://redmine.acme.com/*" (any port). */
export function originPattern(url: string): string | null {
  try {
    const u = new URL(normalizeRedmineUrl(url));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

export async function hasHostPermission(url: string): Promise<boolean> {
  if (!isExtensionPage) return true;
  const pattern = originPattern(url);
  if (!pattern) return false;
  return chrome.permissions.contains({ origins: [pattern] });
}

/**
 * Asks the user to grant access to the Redmine origin.
 * MUST be called synchronously inside a user gesture (click/submit handler),
 * before any `await`, otherwise Chrome rejects the request.
 */
export function requestHostPermission(url: string): Promise<boolean> {
  if (!isExtensionPage) return Promise.resolve(true);
  const pattern = originPattern(url);
  if (!pattern) return Promise.resolve(false);
  return chrome.permissions.request({ origins: [pattern] }).catch(() => false);
}

/* ------------------------------------------------------------------ */
/* Error helpers                                                       */
/* ------------------------------------------------------------------ */

function describeHttpError(status: number, body: any): string {
  if (body?.errors && Array.isArray(body.errors) && body.errors.length) {
    return body.errors.join(' • ');
  }
  switch (status) {
    case 401:
      return 'API Key inválida, ou a API REST está desabilitada no Redmine (Administração › Configurações › API).';
    case 403:
      return 'Seu usuário não tem permissão para esta operação no Redmine.';
    case 404:
      return 'Recurso não encontrado. Verifique a URL (inclua o subcaminho, ex.: https://host/redmine).';
    case 422:
      return 'O Redmine rejeitou a alteração (verifique o fluxo de trabalho e campos obrigatórios).';
    default:
      return `Erro HTTP ${status}`;
  }
}

function describeNetworkError(err: any, url: string): string {
  if (err?.name === 'AbortError') {
    return 'Tempo limite esgotado ao contatar o Redmine.';
  }
  const insecure = url.startsWith('https:')
    ? ' Se o servidor usa certificado autoassinado, abra a URL em uma aba e aceite o certificado.'
    : '';
  return `Não foi possível alcançar o Redmine em ${url}. Verifique a URL, sua rede/VPN e a permissão de acesso da extensão.${insecure}`;
}

/** Removes duplicates by `id`, keeping the first occurrence (an issue can match several units). */
function uniqueById<T>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((item) => {
    const id = (item as { id: number }).id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export class RedmineClient {
  private url: string;
  private apiKey: string;
  private isDemo: boolean;
  private unit: UnitScope | null;

  /** `unit`: when set, every /issues.json collection query is restricted to those projects. */
  constructor(url: string, apiKey: string, isDemo: boolean = false, unit: UnitScope | null = null) {
    this.url = normalizeRedmineUrl(url);
    this.apiKey = (apiKey || '').trim();
    this.isDemo = isDemo;
    this.unit = unit;
  }

  /**
   * One query per unit (Redmine does not accept several projects in one query), or null when the
   * query is not an issue collection or has no unit scope. This is the single place that applies the
   * unit scope: requestAll and requestAllStrict both go through it, so the full load, the Inbox, the
   * per-tracker status discovery and the incremental sync are all restricted the same way.
   */
  private unitQueries(
    endpoint: string,
    params: Record<string, string | number>
  ): Record<string, string | number>[] | null {
    if (!this.unit || endpoint !== '/issues.json' || params.project_id !== undefined) return null;
    const subprojects = this.unit.includeSubprojects ? '*' : '!*';
    return this.unit.projectIds.map((id) => ({ ...params, project_id: id, subproject_id: subprojects }));
  }

  private async request<T>(
    endpoint: string,
    options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown } = {}
  ): Promise<RedmineApiResult<T>> {
    const startTime = performance.now();
    const method = options.method || 'GET';

    if (!this.url) {
      return { success: false, error: 'URL do Redmine não informada.' };
    }

    const fullUrl = `${this.url}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(fullUrl, {
        method,
        headers: {
          Accept: 'application/json',
          'X-Redmine-API-Key': this.apiKey,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });
      const latencyMs = Math.round(performance.now() - startTime);

      if (!response.ok) {
        let body: any = null;
        try {
          body = await response.json();
        } catch {
          /* non-JSON error page */
        }
        return { success: false, status: response.status, error: describeHttpError(response.status, body), latencyMs };
      }

      const text = await response.text();
      if (!text) return { success: true, status: response.status, latencyMs };

      try {
        return { success: true, status: response.status, data: JSON.parse(text) as T, latencyMs };
      } catch {
        return {
          success: false,
          status: response.status,
          error: 'O servidor respondeu, mas não com JSON. A URL aponta mesmo para o Redmine?',
          latencyMs,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: describeNetworkError(err, this.url),
        latencyMs: Math.round(performance.now() - startTime),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Fetches every page of a collection endpoint (up to `max` items). */
  private async requestAll<T>(
    endpoint: string,
    key: string,
    params: Record<string, string | number> = {},
    max = DEFAULT_MAX_ISSUES
  ): Promise<RedmineApiResult<T[]>> {
    const perUnit = this.unitQueries(endpoint, params);
    if (perUnit) {
      const parts = await Promise.all(perUnit.map((q) => this.requestAll<T>(endpoint, key, q, max)));
      const failed = parts.find((p) => !p.success);
      if (failed) return failed;
      return { success: true, data: uniqueById(parts.flatMap((p) => p.data || [])).slice(0, max) };
    }

    const items: T[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total && items.length < max) {
      const qs = new URLSearchParams({
        ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await this.request<Record<string, any>>(`${endpoint}?${qs.toString()}`);
      if (!res.success || !res.data) {
        if (items.length) break; // keep what we have
        return { success: false, error: res.error, status: res.status };
      }
      const page: T[] = res.data[key] || [];
      items.push(...page);
      total = typeof res.data.total_count === 'number' ? res.data.total_count : items.length;
      if (page.length === 0) break;
      offset += page.length;
    }
    return { success: true, data: items.slice(0, max) };
  }

  /**
   * Like `requestAll`, but never returns partial data silently: any failing page fails the whole call,
   * and `truncated` tells the caller that more items exist than `max`. Incremental sync relies on this,
   * because a missing page would make a stale issue look up to date.
   */
  private async requestAllStrict<T>(
    endpoint: string,
    key: string,
    params: Record<string, string | number>,
    max: number
  ): Promise<RedmineApiResult<T[]> & { truncated?: boolean }> {
    const perUnit = this.unitQueries(endpoint, params);
    if (perUnit) {
      const parts = await Promise.all(perUnit.map((q) => this.requestAllStrict<T>(endpoint, key, q, max)));
      const failed = parts.find((p) => !p.success);
      if (failed) return failed;
      const merged = uniqueById(parts.flatMap((p) => p.data || []));
      return {
        success: true,
        data: merged.slice(0, max),
        truncated: parts.some((p) => p.truncated) || merged.length > max,
      };
    }

    const items: T[] = [];
    let offset = 0;
    let total = Infinity;

    while (offset < total && items.length < max) {
      const qs = new URLSearchParams({
        ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await this.request<Record<string, any>>(`${endpoint}?${qs.toString()}`);
      if (!res.success || !res.data) return { success: false, error: res.error, status: res.status };
      const page: T[] = res.data[key] || [];
      items.push(...page);
      total = typeof res.data.total_count === 'number' ? res.data.total_count : items.length;
      if (page.length === 0) break;
      offset += page.length;
    }
    return { success: true, data: items.slice(0, max), truncated: offset < total && items.length >= max };
  }

  async testConnection(): Promise<RedmineApiResult<RedmineUser>> {
    if (this.isDemo) {
      return { success: true, data: DEMO_USER, latencyMs: 12 };
    }
    if (!(await hasHostPermission(this.url))) {
      return {
        success: false,
        error: 'A extensão ainda não tem permissão para acessar este servidor. Use "Conectar" (ou "Testar conexão") para conceder o acesso.',
      };
    }
    const res = await this.request<{ user: RedmineUser }>('/users/current.json');
    if (res.success && res.data?.user) {
      return { success: true, data: res.data.user, latencyMs: res.latencyMs };
    }
    return {
      success: false,
      error: res.error || 'Credenciais inválidas ou Redmine inacessível.',
      status: res.status,
      latencyMs: res.latencyMs,
    };
  }

  async getProjects(): Promise<RedmineApiResult<RedmineProject[]>> {
    if (this.isDemo) return { success: true, data: DEMO_PROJECTS };
    return this.requestAll<RedmineProject>('/projects.json', 'projects', {}, 2000);
  }

  async getTrackers(): Promise<RedmineApiResult<RedmineTracker[]>> {
    if (this.isDemo) return { success: true, data: DEMO_TRACKERS };
    const res = await this.request<{ trackers: RedmineTracker[] }>('/trackers.json');
    return { success: res.success, data: res.data?.trackers || [], error: res.error };
  }

  async getStatuses(): Promise<RedmineApiResult<RedmineStatus[]>> {
    if (this.isDemo) return { success: true, data: DEMO_STATUSES };
    const res = await this.request<{ issue_statuses: RedmineStatus[] }>('/issue_statuses.json');
    return { success: res.success, data: res.data?.issue_statuses || [], error: res.error };
  }

  /** Requires admin rights in Redmine; callers should fall back to fields seen on issues. */
  async getCustomFields(): Promise<RedmineApiResult<RedmineCustomFieldDef[]>> {
    if (this.isDemo) return { success: true, data: DEMO_CUSTOM_FIELDS };
    const res = await this.request<{ custom_fields: RedmineCustomFieldDef[] }>('/custom_fields.json');
    return {
      success: res.success,
      data: (res.data?.custom_fields || []).filter((cf) => cf.customized_type === 'issue'),
      error: res.error,
    };
  }

  /**
   * Fetches issues for the workspace.
   * When trackerIds are provided, queries Redmine specifically for those trackers,
   * avoiding arbitrary global truncation and ensuring 100% parity with Redmine.
   */
  async getWorkspaceIssues(options?: WorkspaceIssuesOptions): Promise<RedmineApiResult<RedmineIssue[]>> {
    if (this.isDemo) return { success: true, data: await loadDemoIssues() };

    const trackerIds = (options?.trackerIds || []).filter((id) => typeof id === 'number' && !isNaN(id));
    const loadAllStatuses = Boolean(options?.loadAllStatuses);
    const lookbackDays =
      options?.closedLookbackDays !== undefined && options.closedLookbackDays !== 0
        ? options.closedLookbackDays
        : DEFAULT_CLOSED_LOOKBACK_DAYS;
    const maxLimit = options?.maxIssuesLimit && options.maxIssuesLimit > 0
      ? options.maxIssuesLimit
      : DEFAULT_MAX_ISSUES;

    const since =
      lookbackDays > 0
        ? new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10)
        : null;

    // Strategy 1: Targeted fetch by tracker (when configured trackers exist)
    if (trackerIds.length > 0) {
      const perTrackerResults = await Promise.all(
        trackerIds.map(async (tid) => {
          if (loadAllStatuses) {
            // Fetch all issues (status_id: '*') for this specific tracker
            const res = await this.requestAll<RedmineIssue>(
              '/issues.json',
              'issues',
              { tracker_id: tid, status_id: '*', sort: 'updated_on:desc' },
              maxLimit
            );
            return res.success && res.data ? res.data : [];
          } else {
            // Fetch open issues + recent closed issues for this specific tracker
            const closedParams: Record<string, string | number> = {
              tracker_id: tid,
              status_id: 'closed',
              sort: 'updated_on:desc',
            };
            if (since) {
              closedParams.updated_on = `>=${since}`;
            }

            const [openRes, closedRes] = await Promise.all([
              this.requestAll<RedmineIssue>(
                '/issues.json',
                'issues',
                { tracker_id: tid, status_id: 'open', sort: 'updated_on:desc' },
                maxLimit
              ),
              this.requestAll<RedmineIssue>(
                '/issues.json',
                'issues',
                closedParams,
                Math.min(maxLimit, DEFAULT_MAX_CLOSED_ISSUES)
              ),
            ]);

            const openList = openRes.success && openRes.data ? openRes.data : [];
            const closedList = closedRes.success && closedRes.data ? closedRes.data : [];
            return mergeIssues(openList, closedList);
          }
        })
      );

      const merged = mergeIssues(...perTrackerResults);
      return { success: true, data: merged };
    }

    // Strategy 2: Global fetch across all trackers (fallback when no trackers are configured yet)
    if (loadAllStatuses) {
      const res = await this.requestAll<RedmineIssue>(
        '/issues.json',
        'issues',
        { status_id: '*', sort: 'updated_on:desc' },
        maxLimit
      );
      if (!res.success) return res;
      return { success: true, data: res.data || [] };
    }

    const closedParams: Record<string, string | number> = {
      status_id: 'closed',
      sort: 'updated_on:desc',
    };
    if (since) {
      closedParams.updated_on = `>=${since}`;
    }

    const [open, closed] = await Promise.all([
      this.requestAll<RedmineIssue>(
        '/issues.json',
        'issues',
        { status_id: 'open', sort: 'updated_on:desc' },
        maxLimit
      ),
      this.requestAll<RedmineIssue>(
        '/issues.json',
        'issues',
        closedParams,
        Math.min(maxLimit, DEFAULT_MAX_CLOSED_ISSUES)
      ),
    ]);

    if (!open.success) return open;
    return { success: true, data: mergeIssues(open.data || [], closed.data || []) };
  }

  /**
   * Incremental counterpart of `getWorkspaceIssues`: only issues changed since `since`
   * (`updated_on >= since`, any status, open or closed), one query per tracker, paginated strictly.
   * Fails as a whole if any page fails, and reports `truncated` when the changes exceed the limit,
   * so the caller can fall back to a full load instead of merging incomplete data.
   */
  async getIssuesSince(
    trackerIds: number[],
    since: string,
    maxIssuesLimit?: number
  ): Promise<RedmineApiResult<RedmineIssue[]> & { truncated?: boolean }> {
    if (this.isDemo) return { success: true, data: [] };

    const max = maxIssuesLimit && maxIssuesLimit > 0 ? maxIssuesLimit : DEFAULT_MAX_ISSUES;
    const base = { status_id: '*', sort: 'updated_on:desc', updated_on: `>=${since}` };
    const queries = trackerIds.length > 0 ? trackerIds.map((id) => ({ ...base, tracker_id: id })) : [base];

    const results = await Promise.all(
      queries.map((q) => this.requestAllStrict<RedmineIssue>('/issues.json', 'issues', q, max))
    );
    const failed = results.find((r) => !r.success);
    if (failed) return { success: false, error: failed.error, status: failed.status };
    return {
      success: true,
      truncated: results.some((r) => r.truncated),
      data: mergeIssues(...results.map((r) => r.data || [])),
    };
  }

  /**
   * Discovers the statuses actually used by each tracker (any status, including closed),
   * based on the most recently updated issues of that tracker. Redmine has no public
   * workflow API, so this is the most reliable way to know a tracker's status set.
   */
  async getTrackerStatusIds(trackerIds: number[]): Promise<Record<number, number[]>> {
    const result: Record<number, number[]> = {};
    if (trackerIds.length === 0) return result;

    if (this.isDemo) {
      const demo = await loadDemoIssues();
      trackerIds.forEach((tid) => {
        result[tid] = Array.from(new Set(demo.filter((i) => i.tracker.id === tid).map((i) => i.status.id)));
      });
      return result;
    }

    await Promise.all(
      trackerIds.map(async (tid) => {
        const res = await this.requestAll<RedmineIssue>(
          '/issues.json',
          'issues',
          { tracker_id: tid, status_id: '*', sort: 'updated_on:desc' },
          300
        );
        if (res.success && res.data) {
          result[tid] = Array.from(new Set(res.data.map((i) => i.status.id)));
        }
      })
    );
    return result;
  }

  /** Open issues assigned to / watched by the current user. */
  async getInbox(user: RedmineUser): Promise<RedmineApiResult<{ ids: InboxIds; issues: RedmineIssue[] }>> {
    if (this.isDemo) {
      const issues = (await loadDemoIssues()).filter((i) => !i.status.is_closed);
      const assigned = issues.filter((i) => i.assigned_to?.id === user.id).map((i) => i.id);
      const watched = issues
        .filter((i) => i.assigned_to?.id !== user.id && (i.author?.id === user.id || (i.journals || []).some((j) => j.user?.id === user.id)))
        .map((i) => i.id);
      return { success: true, data: { ids: { assigned, watched }, issues: [] } };
    }

    const [assigned, watched] = await Promise.all([
      this.requestAll<RedmineIssue>('/issues.json', 'issues', { assigned_to_id: 'me', status_id: 'open' }, 500),
      this.requestAll<RedmineIssue>('/issues.json', 'issues', { watcher_id: 'me', status_id: 'open' }, 500),
    ]);
    if (!assigned.success) return { success: false, error: assigned.error };
    const assignedList = assigned.data || [];
    const watchedList = watched.success ? watched.data || [] : [];
    return {
      success: true,
      data: {
        ids: { assigned: assignedList.map((i) => i.id), watched: watchedList.map((i) => i.id) },
        issues: mergeIssues(assignedList, watchedList),
      },
    };
  }

  async getIssueDetail(issueId: number): Promise<RedmineApiResult<RedmineIssue>> {
    if (this.isDemo) {
      const found = (await loadDemoIssues()).find((i) => i.id === issueId);
      return found ? { success: true, data: found } : { success: false, error: 'Tarefa não encontrada.' };
    }
    let res = await this.request<{ issue: RedmineIssue }>(
      `/issues/${issueId}.json?include=children,relations,journals,watchers,allowed_statuses`
    );
    if (!res.success) {
      res = await this.request<{ issue: RedmineIssue }>(
        `/issues/${issueId}.json?include=children,relations,journals,watchers`
      );
    }
    return { success: res.success, data: res.data?.issue, error: res.error };
  }

  /**
   * PUT /issues/:id.json. Redmine silently ignores status changes not allowed by the workflow,
   * so the issue is re-read afterwards and returned for the caller to verify.
   */
  async updateIssue(
    issueId: number,
    fields: { status_id?: number; notes?: string; custom_fields?: { id: number; value: unknown }[] }
  ): Promise<RedmineApiResult<RedmineIssue>> {
    if (this.isDemo) return this.updateDemoIssue(issueId, fields);

    const res = await this.request(`/issues/${issueId}.json`, { method: 'PUT', body: { issue: fields } });
    const fresh = await this.getIssueDetail(issueId);
    if (!res.success) {
      return { success: false, error: res.error, status: res.status, data: fresh.data };
    }
    return fresh.success && fresh.data ? { success: true, data: fresh.data } : { success: true };
  }

  private async updateDemoIssue(
    issueId: number,
    fields: { status_id?: number; notes?: string; custom_fields?: { id: number; value: unknown }[] }
  ): Promise<RedmineApiResult<RedmineIssue>> {
    await new Promise((r) => setTimeout(r, 150)); // realistic latency
    const issues = await loadDemoIssues();
    const idx = issues.findIndex((i) => i.id === issueId);
    if (idx === -1) return { success: false, error: 'Tarefa não encontrada no modo demonstração.' };

    const updated: RedmineIssue = { ...issues[idx], updated_on: new Date().toISOString() };
    if (fields.status_id) {
      updated.status = DEMO_STATUSES.find((s) => s.id === fields.status_id) || updated.status;
    }
    if (fields.custom_fields) {
      const current = [...(updated.custom_fields || [])];
      fields.custom_fields.forEach(({ id, value }) => {
        const f = current.findIndex((cf) => cf.id === id);
        if (f !== -1) current[f] = { ...current[f], value };
        else current.push({ id, name: DEMO_CUSTOM_FIELDS.find((d) => d.id === id)?.name || `Campo #${id}`, value });
      });
      updated.custom_fields = current;
    }
    if (fields.notes) {
      updated.journals = [
        ...(updated.journals || []),
        {
          id: Date.now(),
          user: { id: DEMO_USER.id, name: `${DEMO_USER.firstname} ${DEMO_USER.lastname}` },
          created_on: new Date().toISOString(),
          notes: fields.notes,
        },
      ];
    }
    issues[idx] = updated;
    await saveDemoIssues(issues);
    return { success: true, data: updated };
  }
}

/* ------------------------------------------------------------------ */
/* Data helpers                                                        */
/* ------------------------------------------------------------------ */

export function mergeIssues(...lists: RedmineIssue[][]): RedmineIssue[] {
  const map = new Map<number, RedmineIssue>();
  lists.flat().forEach((i) => {
    if (!map.has(i.id)) map.set(i.id, i);
  });
  return Array.from(map.values());
}

/** The issues list endpoint does not return children; rebuild them from `parent`. */
export function linkChildren(issues: RedmineIssue[]): RedmineIssue[] {
  const childrenByParent = new Map<number, { id: number; tracker?: { id: number; name: string }; subject?: string }[]>();
  issues.forEach((i) => {
    if (!i.parent) return;
    const list = childrenByParent.get(i.parent.id) || [];
    list.push({ id: i.id, tracker: i.tracker, subject: i.subject });
    childrenByParent.set(i.parent.id, list);
  });
  return issues.map((i) => {
    const derived = childrenByParent.get(i.id) || [];
    const existing = i.children || [];
    const ids = new Set(existing.map((c) => c.id));
    const merged = [...existing, ...derived.filter((c) => !ids.has(c.id))];
    return merged.length ? { ...i, children: merged } : i;
  });
}

/** Custom field definitions inferred from issues (used when /custom_fields.json needs admin rights). */
export function inferCustomFields(issues: RedmineIssue[]): RedmineCustomFieldDef[] {
  const map = new Map<number, RedmineCustomFieldDef>();
  issues.forEach((i) =>
    (i.custom_fields || []).forEach((cf) => {
      if (!map.has(cf.id)) {
        map.set(cf.id, { id: cf.id, name: cf.name, customized_type: 'issue', field_format: cf.multiple ? 'list' : 'string' });
      }
    })
  );
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function customFieldText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
}

const TRUTHY = ['1', 'true', 'sim', 'yes', 's', 'y'];

/** Annotates issues with blocked status and strategic initiative name. */
export function processIssueWithConfig(issue: RedmineIssue, config: RedlevelsConfig): RedmineIssue {
  let is_blocked = false;
  let block_reason = '';
  let strategic_initiative = '';
  const fields = Array.isArray(issue.custom_fields) ? issue.custom_fields : [];

  const blockedIds = config.blockedCustomFieldIds && config.blockedCustomFieldIds.length > 0
    ? config.blockedCustomFieldIds
    : config.blockedCustomFieldId
      ? [config.blockedCustomFieldId]
      : [];

  if (blockedIds.length > 0) {
    const trigger = (config.blockedCustomFieldValueTrigger || '').trim().toLowerCase();
    for (const bid of blockedIds) {
      const blockedField = fields.find((f) => f.id === bid);
      if (blockedField) {
        const raw = customFieldText(blockedField.value).trim().toLowerCase();
        const matches = raw !== '' && (raw === trigger || TRUTHY.includes(raw) || (!!trigger && raw.split(', ').includes(trigger)));
        if (matches) {
          is_blocked = true;
          break;
        }
      }
    }
  }

  if (is_blocked) {
    const reasonField = fields.find(
      (f) =>
        !blockedIds.includes(f.id) &&
        /motivo|impedimento|bloqueio|reason/i.test(f.name) &&
        customFieldText(f.value).trim() !== ''
    );
    if (reasonField) block_reason = customFieldText(reasonField.value);
  }

  if (config.strategicCustomFieldId) {
    const stratField = fields.find((f) => f.id === config.strategicCustomFieldId);
    strategic_initiative = customFieldText(stratField?.value).trim();
  }

  return { ...issue, is_blocked, block_reason, strategic_initiative };
}
