import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Users } from 'lucide-react';
import type { RedlevelsConfig, RedmineIssue, Team } from '../types/redmine';
import { stageKeyOf } from '../services/issueStage';
import { NO_OWNER, PersonRow, PersonStats, buildPeople, sumStats } from '../services/teamStats';
import { NO_TEAM_LABEL, movePerson, newTeamId, teamIdByPerson, teamsOf } from '../services/teams';

interface EquipesViewProps {
  issues: RedmineIssue[];
  config: RedlevelsConfig;
  onSaveTeams: (teams: Team[]) => void;
  onSelectIssue: (issue: RedmineIssue) => void;
  /** Publishes the issues of the people shown (after the search), used by the CSV export. */
  onVisibleIssuesChange?: (issues: RedmineIssue[]) => void;
}

const COLUMNS: { key: keyof PersonStats; label: string; title: string }[] = [
  { key: 'open', label: 'Abertas', title: 'Tudo que não está em Concluído' },
  { key: 'backlog', label: 'Backlog', title: 'Abertas em Backlog' },
  { key: 'analysis', label: 'Análise', title: 'Abertas em Análise' },
  { key: 'in_progress', label: 'Andamento', title: 'Abertas em Em andamento' },
  { key: 'blocked', label: 'Bloq.', title: 'Abertas com impedimento' },
  { key: 'overdue', label: 'Atras.', title: 'Abertas com prazo vencido' },
  { key: 'done', label: 'Concl.', title: 'Concluídas dentro da janela carregada (Configuração › dias de histórico)' },
];

const GRID = 'grid grid-cols-[minmax(170px,1.6fr)_150px_repeat(7,66px)] items-center gap-2 px-3.5 py-1.5 text-xs min-w-[760px]';
const COLLAPSED_KEY = 'redlevels_ui_equipes_col';

const readCollapsed = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const formatDate = (s: string) => s.slice(0, 10).split('-').reverse().join('/');

const byLoad = (a: PersonRow, b: PersonRow) => b.stats.open - a.stats.open || a.name.localeCompare(b.name, 'pt-BR');

export const EquipesView: React.FC<EquipesViewProps> = ({
  issues,
  config,
  onSaveTeams,
  onSelectIssue,
  onVisibleIssuesChange,
}) => {
  const teams = teamsOf(config);
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const people = useMemo(() => buildPeople(issues, config, teams), [issues, config, teams]);
  const teamOf = useMemo(() => teamIdByPerson(teams), [teams]);

  const q = query.trim().toLowerCase();
  const matches = (p: PersonRow) => !q || p.name.toLowerCase().includes(q);

  const groups = teams.map((team) => ({
    team,
    rows: team.members.map((m) => people.get(m.id)).filter((p): p is PersonRow => !!p).sort(byLoad),
  }));
  const loose = [...people.values()].filter((p) => p.id !== NO_OWNER && !teamOf.has(p.id)).sort(byLoad);
  const noOwner = people.get(NO_OWNER);

  // The CSV exports the issues of the people that are on screen.
  const shownIssues = useMemo(() => {
    const rows = [...groups.flatMap((g) => g.rows), ...loose, ...(noOwner ? [noOwner] : [])].filter(matches);
    return rows.flatMap((r) => r.issues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, teams, q]);
  useEffect(() => {
    onVisibleIssuesChange?.(shownIssues);
    return () => onVisibleIssuesChange?.([]);
  }, [shownIssues, onVisibleIssuesChange]);

  const collapseKeys = [...teams.map((t) => t.id), 'loose', 'none'];
  const allCollapsed = collapseKeys.every((k) => collapsed[k]);

  const saveCollapsed = (next: Record<string, boolean>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // ignore (private mode, quota)
    }
  };

  const addTeam = () => {
    const name = newName.trim();
    if (!name) return;
    onSaveTeams([...teams, { id: newTeamId(), name, members: [] }]);
    setNewName('');
  };

  const commitRename = () => {
    if (renaming && renaming.name.trim()) {
      onSaveTeams(teams.map((t) => (t.id === renaming.id ? { ...t, name: renaming.name.trim() } : t)));
    }
    setRenaming(null);
  };

  const deleteTeam = (team: Team) => {
    if (window.confirm(`Excluir a equipe "${team.name}"? As pessoas voltam para "${NO_TEAM_LABEL}".`)) {
      onSaveTeams(teams.filter((t) => t.id !== team.id));
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renderIssues = (person: PersonRow) => {
    const open = person.issues
      .filter((i) => stageKeyOf(i, config) !== 'done')
      .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    if (open.length === 0) return <div className="px-8 py-2 text-[11px] text-slate-500">Nenhuma tarefa aberta.</div>;
    return (
      <ul className="px-8 pb-2.5 pt-1 bg-slate-950/60">
        {open.map((issue) => {
          const late = !!issue.due_date && new Date(`${issue.due_date.slice(0, 10)}T00:00:00`) < today;
          return (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => onSelectIssue(issue)}
                className="flex w-full items-baseline gap-2.5 py-1.5 text-left text-xs text-slate-300 border-b border-slate-800 hover:text-white"
              >
                <span className="min-w-14 text-slate-500">#{issue.id}</span>
                <span className="flex-1">{issue.subject}</span>
                {issue.is_blocked && <span className="text-[10px] font-bold text-rose-400">▲ BLOQUEADA</span>}
                <span className="text-[11px] text-slate-400">{issue.status?.name}</span>
                <span className={`min-w-20 text-right text-[11px] ${late ? 'text-amber-300' : 'text-slate-500'}`}>
                  {late && <span aria-hidden="true">▲ </span>}
                  {issue.due_date ? formatDate(issue.due_date) : 'sem prazo'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  };

  const cell = (key: keyof PersonStats, value: number) => {
    const tone =
      value === 0
        ? 'text-slate-600'
        : key === 'blocked'
          ? 'text-rose-300'
          : key === 'overdue'
            ? 'text-amber-300'
            : key === 'open'
              ? 'text-slate-100 font-bold'
              : 'text-slate-300';
    return (
      <div key={key} className={`text-center tabular-nums ${tone}`}>
        {(key === 'blocked' || key === 'overdue') && value > 0 && <span aria-hidden="true">▲ </span>}
        {value}
      </div>
    );
  };

  const renderPerson = (person: PersonRow) => {
    const key = String(person.id);
    const isOpen = !!expanded[key];
    return (
      <div key={key}>
        <div className={`${GRID} border-b border-slate-800/70`}>
          <button
            type="button"
            onClick={() => setExpanded({ ...expanded, [key]: !isOpen })}
            aria-expanded={isOpen}
            title="Ver tarefas abertas"
            className="flex items-center gap-1 text-left font-semibold text-slate-100 hover:text-white"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{person.name}</span>
          </button>
          {person.id === NO_OWNER ? (
            <div className="text-slate-500">—</div>
          ) : (
            <select
              value={teamOf.get(person.id) || ''}
              onChange={(e) => onSaveTeams(movePerson(teams, person as { id: number; name: string }, e.target.value || null))}
              aria-label={`Equipe de ${person.name}`}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-200"
            >
              <option value="">— {NO_TEAM_LABEL} —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {COLUMNS.map((c) => cell(c.key, person.stats[c.key]))}
        </div>
        {isOpen && renderIssues(person)}
      </div>
    );
  };

  const renderSection = (key: string, title: string, sub: string, rows: PersonRow[], actions?: React.ReactNode, titleNode?: React.ReactNode) => {
    const shown = rows.filter(matches);
    const isCollapsed = !!collapsed[key];
    const total = sumStats(rows);
    return (
      <section key={key} className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-slate-900 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {titleNode ?? (
              <button
                type="button"
                onClick={() => saveCollapsed({ ...collapsed, [key]: !isCollapsed })}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? `Expandir ${title}` : `Recolher ${title}`}
                className="flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 -mx-1.5 hover:bg-slate-800"
              >
                {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-bold text-slate-50">{title}</span>
              </button>
            )}
            <span className="text-[11px] text-slate-500">{sub}</span>
            {isCollapsed && rows.length > 0 && (
              <span className="flex flex-wrap gap-1.5 font-mono text-[11px] font-bold">
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">{total.open} abertas</span>
                {total.in_progress > 0 && (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-200">{total.in_progress} em andamento</span>
                )}
                {total.blocked > 0 && (
                  <span className="rounded-full bg-rose-950 px-2 py-0.5 text-rose-300">▲ {total.blocked} bloq.</span>
                )}
                {total.overdue > 0 && (
                  <span className="rounded-full bg-rose-950 px-2 py-0.5 text-rose-300">▲ {total.overdue} atras.</span>
                )}
              </span>
            )}
          </div>
          {actions}
        </div>
        {!isCollapsed && (
          <div className="overflow-x-auto">
            <div className={`${GRID} text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800`}>
              <div>Pessoa</div>
              <div>Equipe</div>
              {COLUMNS.map((c) => (
                <div key={c.key} className="text-center" title={c.title}>
                  {c.label}
                </div>
              ))}
            </div>
            {shown.length > 0 ? (
              shown.map(renderPerson)
            ) : (
              <div className="px-3.5 py-3 text-xs text-slate-500">
                {rows.length
                  ? 'Ninguém corresponde à busca.'
                  : `Sem pessoas nesta equipe ainda. Use o seletor "Equipe" na linha de uma pessoa (seção "${NO_TEAM_LABEL}") para adicioná-la.`}
              </div>
            )}
            {rows.length > 0 && (
              <div className={`${GRID} bg-slate-950/70 font-bold text-slate-50`}>
                <div>Total</div>
                <div />
                {COLUMNS.map((c) => cell(c.key, total[c.key]))}
              </div>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-3.5 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-50">
            <Users className="w-4 h-4 text-rose-400" /> Equipes &amp; Pessoas
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Carga de trabalho por responsável, agrupada em equipes. As equipes são só um agrupamento e ficam salvas neste
            navegador.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pessoa..."
            aria-label="Buscar pessoa"
            className="w-44 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-rose-500"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
            placeholder="Nome da nova equipe"
            aria-label="Nome da nova equipe"
            className="w-44 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-rose-500"
          />
          <button
            type="button"
            onClick={addTeam}
            className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
          >
            <Plus className="w-3.5 h-3.5" /> Criar equipe
          </button>
          <button
            type="button"
            onClick={() => {
              const next: Record<string, boolean> = {};
              collapseKeys.forEach((k) => (next[k] = !allCollapsed));
              saveCollapsed(next);
            }}
            title={allCollapsed ? 'Mostrar as pessoas de todas as equipes' : 'Esconder as pessoas e deixar só o cabeçalho de cada equipe'}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            {allCollapsed ? 'Expandir todas' : 'Recolher todas'}
          </button>
        </div>
      </div>

      {teams.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-3.5 py-3 text-xs text-slate-300">
          Nenhuma equipe criada ainda. Crie uma acima e depois escolha a equipe de cada pessoa no seletor da linha. Enquanto
          isso, todas aparecem em "{NO_TEAM_LABEL}".
        </div>
      )}

      {groups.map((g) =>
        renderSection(
          g.team.id,
          g.team.name,
          `${g.rows.length} pessoa(s)`,
          g.rows,
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setRenaming({ id: g.team.id, name: g.team.name })}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800"
            >
              Renomear
            </button>
            <button
              type="button"
              onClick={() => deleteTeam(g.team)}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-slate-800"
            >
              Excluir
            </button>
          </div>,
          renaming?.id === g.team.id ? (
            <input
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming({ id: g.team.id, name: e.target.value })}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenaming(null);
              }}
              aria-label="Novo nome da equipe"
              className="w-48 rounded-lg border border-rose-500 bg-slate-950 px-2 py-0.5 text-sm font-bold text-slate-50 outline-none"
            />
          ) : undefined
        )
      )}
      {loose.length > 0 && renderSection('loose', NO_TEAM_LABEL, `${loose.length} pessoa(s)`, loose)}
      {noOwner && renderSection('none', 'Sem responsável', 'tarefas sem pessoa atribuída', [noOwner])}
    </div>
  );
};
