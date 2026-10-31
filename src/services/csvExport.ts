import type { KanbanColumnKey, RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { stageKeyOf } from './issueStage';
import { teamNameOf, teamsOf } from './teams';

/**
 * CSV export of the issues shown on the active tab.
 *
 * Format: `;` separator and UTF-8 with BOM, so Excel (pt-BR) opens it directly with accents.
 * Pure functions (`buildCsv`) are separated from the browser download (`downloadCsv`).
 */

const STAGE_LABELS: Record<KanbanColumnKey, string> = {
  backlog: 'Backlog',
  analysis: 'Análise',
  in_progress: 'Em andamento',
  done: 'Concluída',
};
const NO_MAPPING = 'Sem mapeamento';

export const CSV_HEADER = [
  'ID',
  'Assunto',
  'Tracker',
  'Projeto',
  'Status',
  'Etapa',
  'Responsável',
  'Equipe',
  'Autor',
  'Prioridade',
  'Início',
  'Prazo',
  'Atrasada',
  'Criada em',
  'Atualizada em',
  'Fechada em',
  'Bloqueada',
  'Motivo do bloqueio',
  'Iniciativa estratégica',
  'Tarefa pai',
  'URL',
];

/** Escapes one cell. Cells starting with `= + - @` (or TAB/CR) get a leading `'` to avoid formula injection. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const formatDate = (s?: string | null) => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');

const formatDateTime = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? String(s) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

/** Kanban stage of an issue according to the status mapping of its level (tactical or operational). */
export function stageOf(issue: RedmineIssue, config: RedlevelsConfig): string {
  const key = stageKeyOf(issue, config);
  return key === 'other' ? NO_MAPPING : STAGE_LABELS[key];
}

/** Builds the CSV text (without BOM). Duplicated ids are written once; rows are sorted by id. */
export function buildCsv(issues: RedmineIssue[], config: RedlevelsConfig, now: Date = new Date()): string {
  const seen = new Set<number>();
  const unique = issues.filter((i) => i && !seen.has(i.id) && seen.add(i.id));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const baseUrl = (config.redmineUrl || '').replace(/\/+$/, '');
  const teams = teamsOf(config);

  const rows = unique
    .sort((a, b) => a.id - b.id)
    .map((i) => {
      const stage = stageOf(i, config);
      const overdue =
        stage !== STAGE_LABELS.done && !!i.due_date && new Date(`${i.due_date}T00:00:00`) < today;
      return [
        i.id,
        i.subject,
        i.tracker?.name,
        i.project?.name,
        i.status?.name,
        stage,
        i.assigned_to?.name ?? 'Sem responsável',
        teamNameOf(i, teams),
        i.author?.name,
        i.priority?.name,
        formatDate(i.start_date),
        formatDate(i.due_date),
        overdue ? 'Sim' : 'Não',
        formatDateTime(i.created_on),
        formatDateTime(i.updated_on),
        formatDateTime(i.closed_on),
        i.is_blocked ? 'Sim' : 'Não',
        i.block_reason ?? '',
        i.strategic_initiative ?? '',
        i.parent?.id ?? '',
        baseUrl ? `${baseUrl}/issues/${i.id}` : '',
      ]
        .map(csvCell)
        .join(';');
    });

  return [CSV_HEADER.map(csvCell).join(';'), ...rows].join('\r\n') + '\r\n';
}

/** File name: `redlevels-tarefas-<tab>-YYYY-MM-DD.csv`. */
export function csvFileName(tab: string, now: Date = new Date()): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `redlevels-tarefas-${tab}-${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}.csv`;
}

/** Triggers the browser download of the issues as CSV. Does nothing for an empty list. */
export function downloadCsv(issues: RedmineIssue[], config: RedlevelsConfig, tab: string): void {
  if (issues.length === 0) return;
  const blob = new Blob(['﻿' + buildCsv(issues, config)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = csvFileName(tab);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
