export interface RedmineUser {
  id: number;
  login: string;
  firstname: string;
  lastname: string;
  mail?: string;
  avatar_url?: string;
  api_key?: string;
  created_on?: string;
  last_login_on?: string;
}

export interface RedmineTracker {
  id: number;
  name: string;
}

export interface RedmineStatus {
  id: number;
  name: string;
  is_closed?: boolean;
}

export interface RedmineProject {
  id: number;
  name: string;
  identifier: string;
  description?: string;
  parent?: { id: number; name?: string };
}

export interface RedmineCustomFieldDef {
  id: number;
  name: string;
  customized_type: string;
  field_format: string;
  possible_values?: { value: string; label?: string }[];
}

export interface CustomFieldValue {
  id: number;
  name: string;
  value: any;
  multiple?: boolean;
}

export interface RedmineJournal {
  id: number;
  user: { id: number; name?: string };
  notes?: string;
  created_on: string;
  private_notes?: boolean;
  details?: { property: string; name: string; old_value?: string | null; new_value?: string | null }[];
}

export interface RedmineIssue {
  id: number;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string; is_closed?: boolean };
  priority: { id: number; name: string };
  author: { id: number; name: string };
  assigned_to?: { id: number; name: string };
  parent?: { id: number };
  subject: string;
  description?: string;
  start_date?: string | null;
  due_date?: string | null;
  done_ratio?: number;
  is_private?: boolean;
  estimated_hours?: number | null;
  spent_hours?: number | null;
  custom_fields?: CustomFieldValue[];
  created_on: string;
  updated_on: string;
  closed_on?: string | null;
  children?: { id: number; tracker?: { id: number; name: string }; subject?: string }[];
  journals?: RedmineJournal[];
  watchers?: { id: number; name: string }[];
  allowed_statuses?: { id: number; name: string; is_closed?: boolean }[];
  // Helper calculated fields
  is_blocked?: boolean;
  block_reason?: string;
  strategic_initiative?: string;
}

export type KanbanColumnKey = 'backlog' | 'analysis' | 'in_progress' | 'done';

export interface StatusMapping {
  backlog: number[];
  analysis: number[];
  in_progress: number[];
  done: number[];
  /** Retrocompatibilidade com chave legada 'todo' */
  todo?: number[];
}

export type ThemeId = 'redmine' | 'redlevels' | 'midnight' | 'light' | 'emerald' | 'amber';

/** Tabs of the app. */
export type TabKey =
  | 'inbox'
  | 'operacional'
  | 'tatico'
  | 'estrategico'
  | 'equipes'
  | 'fluxo'
  | 'configuracao';

/** A grouping of people. A person belongs to at most one team. */
export interface Team {
  id: string;
  name: string;
  members: { id: number; name: string }[];
}

/** WIP limits (0 or missing = no limit). Per stage and per person (in progress). */
export interface WipLimits {
  backlog?: number;
  analysis?: number;
  in_progress?: number;
  perPerson?: number;
}

export interface RedlevelsConfig {
  redmineUrl: string;
  apiKey: string;
  isConfigured: boolean;
  isDemoMode: boolean;
  operationalTrackerIds: number[];
  tacticalTrackerIds: number[];
  strategicCustomFieldId?: number;
  blockedCustomFieldId?: number;
  blockedCustomFieldIds?: number[];
  blockedCustomFieldValueTrigger?: string; // value that triggers blocked, e.g. "Sim", "1", "true"
  statusMapping: StatusMapping;
  operationalStatusMapping?: StatusMapping;
  tacticalStatusMapping?: StatusMapping;
  theme: ThemeId;
  hasSeenTour: boolean;
  operationalColumnOrder?: number[];
  tacticalColumnOrder?: number[];
  loadAllIssueStatuses?: boolean;
  closedLookbackDays?: number; // 0 ou undefined para padrão, -1 para sem limite de data
  maxIssuesLimit?: number; // Limite máximo de tarefas por tracker / busca (padrão 5000)
  /** Guarda as tarefas no armazenamento local do navegador para abrir rápido (padrão: desligado). */
  cacheEnabled?: boolean;
  /** Projetos (unidades) cujas tarefas são baixadas; vazio/ausente = todos os que o usuário enxerga. */
  unitProjectIds?: number[];
  /** Inclui os subprojetos de cada unidade escolhida (padrão: sim). */
  unitIncludeSubprojects?: boolean;
  /** Equipes (agrupamento de pessoas, usado nas abas Equipes e Fluxo e na coluna "Equipe" do CSV). */
  teams?: Team[];
  /** Limites de WIP da aba Fluxo. */
  wipLimits?: WipLimits;
}

export interface ConnectionHealth {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  user?: RedmineUser;
  latencyMs?: number;
  errorMessage?: string;
  lastChecked?: string;
}

export interface StrategicInitiative {
  id: string;
  title: string;
  code?: string;
  description?: string;
  status: 'Planejado' | 'Em Andamento' | 'Em Risco' | 'Concluído';
  progress: number;
  tacticalIssueIds: number[];
}

/** Ids of issues that belong to the current user's inbox. */
export interface InboxIds {
  assigned: number[];
  watched: number[];
}
