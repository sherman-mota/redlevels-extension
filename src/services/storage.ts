import { RedlevelsConfig, RedmineIssue, RedmineStatus, StatusMapping } from '../types/redmine';
import { INITIAL_DEMO_ISSUES } from './demoData';

const CONFIG_STORAGE_KEY = 'redlevels_extension_config_v1';
const DEMO_ISSUES_STORAGE_KEY = 'redlevels_demo_issues_v1';

/** True when running as an installed extension page (chrome.storage available). */
const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;

async function getItem<T>(key: string): Promise<T | undefined> {
  if (hasChromeStorage) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  // Fallback for `npm run dev` outside the extension.
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : undefined;
}

async function setItem(key: string, value: unknown): Promise<void> {
  if (hasChromeStorage) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

async function removeItem(key: string): Promise<void> {
  if (hasChromeStorage) {
    await chrome.storage.local.remove(key);
    return;
  }
  localStorage.removeItem(key);
}

export function normalizeStatusMapping(m?: any): StatusMapping {
  if (!m || typeof m !== 'object') {
    return { backlog: [], analysis: [], in_progress: [], done: [] };
  }
  return {
    backlog: Array.isArray(m.backlog) ? m.backlog : [],
    analysis: Array.isArray(m.analysis) ? m.analysis : (Array.isArray(m.todo) ? m.todo : []),
    in_progress: Array.isArray(m.in_progress) ? m.in_progress : [],
    done: Array.isArray(m.done) ? m.done : [],
  };
}

export const EMPTY_STATUS_MAPPING: StatusMapping = { backlog: [], analysis: [], in_progress: [], done: [] };

export const DEFAULT_CONFIG: RedlevelsConfig = {
  redmineUrl: '',
  apiKey: '',
  isConfigured: false,
  isDemoMode: false,
  operationalTrackerIds: [],
  tacticalTrackerIds: [],
  strategicCustomFieldId: undefined,
  blockedCustomFieldId: undefined,
  blockedCustomFieldValueTrigger: 'Sim',
  statusMapping: EMPTY_STATUS_MAPPING,
  operationalStatusMapping: EMPTY_STATUS_MAPPING,
  tacticalStatusMapping: EMPTY_STATUS_MAPPING,
  theme: 'redlevels',
  hasSeenTour: false,
  operationalColumnOrder: [],
  tacticalColumnOrder: [],
};

/** Preset matching the ids used by the demo dataset. */
export const DEMO_CONFIG_PRESET: Partial<RedlevelsConfig> = {
  redmineUrl: '',
  apiKey: '',
  isConfigured: true,
  isDemoMode: true,
  operationalTrackerIds: [1, 2, 3, 6],
  tacticalTrackerIds: [4, 5],
  strategicCustomFieldId: 10,
  blockedCustomFieldId: 20,
  blockedCustomFieldValueTrigger: 'Sim',
  statusMapping: { backlog: [1], analysis: [2], in_progress: [3, 4], done: [5] },
  operationalStatusMapping: { backlog: [1], analysis: [2], in_progress: [3, 4], done: [5] },
  tacticalStatusMapping: { backlog: [], analysis: [2], in_progress: [3], done: [5] },
  operationalColumnOrder: [1, 2, 3, 4, 5],
  tacticalColumnOrder: [2, 3, 5],
};

export async function loadConfig(): Promise<RedlevelsConfig> {
  try {
    const parsed = await getItem<Partial<RedlevelsConfig>>(CONFIG_STORAGE_KEY);
    if (parsed) {
      const baseMapping = normalizeStatusMapping(parsed.statusMapping);
      const opMapping = parsed.operationalStatusMapping
        ? normalizeStatusMapping(parsed.operationalStatusMapping)
        : { ...baseMapping };
      const tacMapping = parsed.tacticalStatusMapping
        ? normalizeStatusMapping(parsed.tacticalStatusMapping)
        : { ...baseMapping };

      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        statusMapping: baseMapping,
        operationalStatusMapping: opMapping,
        tacticalStatusMapping: tacMapping,
      };
    }
  } catch (e) {
    console.error('Falha ao ler configuração', e);
  }
  return DEFAULT_CONFIG;
}

export async function saveConfig(config: RedlevelsConfig): Promise<void> {
  try {
    await setItem(CONFIG_STORAGE_KEY, config);
  } catch (e) {
    console.error('Falha ao salvar configuração', e);
  }
}

export async function loadDemoIssues(): Promise<RedmineIssue[]> {
  try {
    const stored = await getItem<RedmineIssue[]>(DEMO_ISSUES_STORAGE_KEY);
    if (stored && Array.isArray(stored)) return stored;
  } catch (e) {
    console.error('Falha ao ler tarefas de demonstração', e);
  }
  return structuredClone(INITIAL_DEMO_ISSUES);
}

export async function saveDemoIssues(issues: RedmineIssue[]): Promise<void> {
  try {
    await setItem(DEMO_ISSUES_STORAGE_KEY, issues);
  } catch (e) {
    console.error('Falha ao salvar tarefas de demonstração', e);
  }
}

export async function resetDemoIssues(): Promise<RedmineIssue[]> {
  await removeItem(DEMO_ISSUES_STORAGE_KEY).catch(() => undefined);
  return structuredClone(INITIAL_DEMO_ISSUES);
}

/**
 * Builds a sensible default status → column mapping from Redmine statuses:
 * first status = Backlog, second = Em Análise, closed = Concluído, others = Em Progresso.
 */
export function suggestStatusMapping(statuses: RedmineStatus[]): StatusMapping {
  const mapping: StatusMapping = { backlog: [], analysis: [], in_progress: [], done: [] };
  const open = statuses.filter((s) => !s.is_closed);
  statuses.forEach((s) => {
    if (s.is_closed) mapping.done.push(s.id);
    else if (s.id === open[0]?.id) mapping.backlog.push(s.id);
    else if (s.id === open[1]?.id) mapping.analysis.push(s.id);
    else mapping.in_progress.push(s.id);
  });
  return mapping;
}
