import React, { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import type { RedlevelsConfig, RedmineIssue, WipLimits } from '../types/redmine';
import { FlowLevel, LimitState, computeFlow, limitState, previousPeriod } from '../services/flowMetrics';
import { teamsOf } from '../services/teams';

interface FluxoViewProps {
  issues: RedmineIssue[];
  config: RedlevelsConfig;
  onSaveWipLimits: (limits: WipLimits) => void;
  onSelectIssue: (issue: RedmineIssue) => void;
  /** Publishes the issues the metrics are computed over (open + finished in the window), used by the CSV export. */
  onVisibleIssuesChange?: (issues: RedmineIssue[]) => void;
}

const STALE_ALERT_DAYS = 14;

const days = (d: number | null) =>
  d === null ? '—' : d < 10 ? `${d.toFixed(1).replace('.', ',')} d` : `${Math.round(d)} d`;

const shortDate = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Next "round" value above `max`, for the chart scale. */
const niceMax = (max: number) => {
  for (const c of [4, 5, 8, 10, 12, 16, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500, 1000, 2000, 5000]) {
    if (c >= max) return c;
  }
  return Math.ceil(max / 1000) * 1000;
};

// An icon always goes with the text, so the state never depends on color alone.
const LIMIT_VIEW: Record<LimitState, { icon: string; text: string; tone: string }> = {
  none: { icon: '–', text: 'Sem limite', tone: 'text-slate-500' },
  over: { icon: '▲', text: 'Acima do limite', tone: 'text-rose-400' },
  at: { icon: '●', text: 'No limite', tone: 'text-amber-300' },
  within: { icon: '✓', text: 'Dentro do limite', tone: 'text-emerald-400' },
};

const CARD = 'rounded-2xl border border-slate-800 bg-slate-900/80 p-4';
const SELECT = 'rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200';

const SectionTitle: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div className="mb-2.5">
    <div className="text-[13px] font-bold text-slate-50">{title}</div>
    {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
  </div>
);

const LimitInput: React.FC<{ value: number | undefined; label: string; onCommit: (n: number) => void }> = ({
  value,
  label,
  onCommit,
}) => {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => setText(value ? String(value) : ''), [value]);
  const commit = () => {
    const n = parseInt(text, 10);
    onCommit(Number.isNaN(n) || n <= 0 ? 0 : n);
  };
  return (
    <input
      type="number"
      min={0}
      placeholder="—"
      value={text}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-16 rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-center text-xs text-slate-200"
    />
  );
};

export const FluxoView: React.FC<FluxoViewProps> = ({
  issues,
  config,
  onSaveWipLimits,
  onSelectIssue,
  onVisibleIssuesChange,
}) => {
  const teams = teamsOf(config);
  const limits = config.wipLimits || {};
  const [level, setLevel] = useState<FlowLevel>('operacional');
  const [teamId, setTeamId] = useState('');
  const [weeksBack, setWeeksBack] = useState(4);
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState(-1);

  const m = useMemo(
    () => computeFlow(issues, config, { level, teamId, weeks: weeksBack }),
    [issues, config, level, teamId, weeksBack]
  );
  const prev = useMemo(
    () => previousPeriod(issues, config, { level, teamId, weeks: weeksBack }),
    [issues, config, level, teamId, weeksBack]
  );

  const shown = useMemo(() => [...m.open, ...m.finished], [m]);
  useEffect(() => {
    onVisibleIssuesChange?.(shown);
    return () => onVisibleIssuesChange?.([]);
  }, [shown, onVisibleIssuesChange]);

  const saveLimit = (key: keyof WipLimits, n: number) => onSaveWipLimits({ ...limits, [key]: n });

  const coveredDays = config.closedLookbackDays !== undefined ? config.closedLookbackDays : 30;
  const windowWarning = !config.loadAllIssueStatuses && coveredDays > 0 && weeksBack * 7 > coveredDays;

  const wip = limitState(m.inProgress.length, limits.in_progress);
  const perPersonLimit = limits.perPerson ?? 0;

  /** "vs. N weeks before": better = ✓, worse = ▲, same = –. Only when the loaded data covers the previous period. */
  const delta = (current: number | null, before: number | null, lowerIsBetter: boolean, fmt: (n: number) => string) => {
    if (!prev.covered) return <span title="O histórico carregado não chega ao período anterior (Configuração › dias de histórico).">– sem período anterior carregado</span>;
    if (current === null || before === null) return null;
    const d = current - before;
    if (Math.abs(d) < 0.05) return <span>– igual ao período anterior</span>;
    const good = lowerIsBetter ? d < 0 : d > 0;
    return (
      <span>
        <span className={good ? 'text-emerald-400' : 'text-rose-400'}>
          <span aria-hidden="true">{good ? '✓' : '▲'}</span> {d > 0 ? '+' : '−'}
          {fmt(Math.abs(d))}
        </span>{' '}
        vs. {weeksBack} sem. anteriores
      </span>
    );
  };
  const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

  const tile = (label: string, value: string, sub: string, state?: LimitState, extra?: React.ReactNode) => (
    <div key={label} className={`${CARD} !p-3`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-2xl font-bold leading-tight text-slate-50">{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>
      {state && (
        <div className="mt-1 text-[11px] text-slate-400">
          <span className={`mr-1.5 ${LIMIT_VIEW[state].tone}`} aria-hidden="true">
            {LIMIT_VIEW[state].icon}
          </span>
          {LIMIT_VIEW[state].text}
        </div>
      )}
      {extra && <div className="mt-1 text-[11px] text-slate-400">{extra}</div>}
    </div>
  );

  const last = m.weeks.length - 1;
  const weekLabel = (start: number, j: number) => `Semana de ${shortDate(start)}${j === last ? ' (em andamento)' : ''}`;
  const top = niceMax(Math.max(1, ...m.weeks.map((w) => w.count)));
  const peak = m.weeks.reduce((best, w, j) => (w.count > m.weeks[best].count ? j : best), 0);
  const maxBucket = Math.max(1, ...m.leadBuckets.map((b) => b.count));

  return (
    <div className="flex flex-col gap-3.5">
      <div className={`${CARD} flex flex-wrap items-center gap-4 !px-3.5 !py-2.5`}>
        <div className="mr-1.5">
          <div className="flex items-center gap-2 text-base font-bold text-slate-50">
            <Activity className="w-4 h-4 text-rose-400" /> Fluxo
          </div>
          <div className="text-[11px] text-slate-500">WIP, vazão, lead time e idade das tarefas carregadas</div>
        </div>
        <label className="text-[11px] text-slate-500">
          <span className="mr-1.5">Nível</span>
          <select value={level} onChange={(e) => setLevel(e.target.value as FlowLevel)} className={SELECT}>
            <option value="operacional">Operacional</option>
            <option value="tatico">Tático</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          <span className="mr-1.5">Equipe</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={SELECT}>
            <option value="">Todas</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-500">
          <span className="mr-1.5">Período</span>
          <select value={weeksBack} onChange={(e) => setWeeksBack(+e.target.value)} className={SELECT}>
            <option value={4}>Últimas 4 semanas</option>
            <option value={8}>Últimas 8 semanas</option>
            <option value={12}>Últimas 12 semanas</option>
          </select>
        </label>
        {windowWarning && (
          <div className="text-[11px] text-amber-300">
            ▲ Os dados carregados cobrem só {coveredDays} dias de concluídas (Configuração › histórico). Semanas mais
            antigas aparecem incompletas.
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
        {tile('Em andamento', String(m.inProgress.length), 'itens no recorte', wip)}
        {tile(
          'Vazão média',
          m.throughputAvg === null ? '—' : num(m.throughputAvg),
          'concluídas por semana (semanas completas)',
          undefined,
          delta(m.throughputAvg, prev.throughputAvg, false, num)
        )}
        {tile(
          'Lead time (mediana)',
          days(m.leadP50),
          m.leadP85 === null ? 'sem concluídas no período' : `85% concluem em até ${days(m.leadP85)}`,
          undefined,
          delta(m.leadP50, prev.leadP50, true, (n) => days(n))
        )}
        {tile('Idade em andamento', days(m.inProgressMedianAge), 'mediana desde a criação')}
        {tile('Bloqueadas', String(m.blocked), 'entre as abertas')}
        {tile('Atrasadas', String(m.overdue), 'prazo vencido, abertas')}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3.5">
        <div className={CARD}>
          <div className="flex items-start justify-between">
            <SectionTitle title="Vazão semanal" sub="Tarefas concluídas por semana (a semana atual está em andamento)" />
            <button
              type="button"
              onClick={() => setAsTable(!asTable)}
              className="rounded-lg border border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
            >
              {asTable ? 'Ver gráfico' : 'Ver tabela'}
            </button>
          </div>
          {asTable ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500">
                  <th className="py-1 text-left font-normal">Semana</th>
                  <th className="py-1 text-right font-normal">Concluídas</th>
                </tr>
              </thead>
              <tbody>
                {m.weeks.map((w, j) => (
                  <tr key={w.start} className="border-b border-slate-800 text-slate-100">
                    <td className="py-1">{weekLabel(w.start, j)}</td>
                    <td className="py-1 text-right tabular-nums">{w.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="relative h-[200px] pl-8 pt-7">
              <div className="relative h-[150px] border-b border-slate-700">
                {[0, top / 2, top].map((v, j) => (
                  <div
                    key={j}
                    className={`absolute inset-x-0 ${j === 0 ? '' : 'border-t border-slate-800'}`}
                    style={{ bottom: `${(v / top) * 100}%` }}
                  >
                    <span className="absolute -left-8 -top-2 w-6 text-right text-[10px] tabular-nums text-slate-500">
                      {Math.round(v * 10) / 10}
                    </span>
                  </div>
                ))}
                <div className="absolute inset-0 flex items-end">
                  {m.weeks.map((w, j) => (
                    <div
                      key={w.start}
                      tabIndex={0}
                      role="img"
                      aria-label={`${weekLabel(w.start, j)}: ${w.count} concluída(s)`}
                      onPointerEnter={() => setHover(j)}
                      onPointerLeave={() => setHover(-1)}
                      onFocus={() => setHover(j)}
                      onBlur={() => setHover(-1)}
                      className="relative flex h-full flex-1 items-end justify-center outline-none"
                    >
                      <div
                        className={`w-[min(24px,60%)] rounded-t ${hover === j ? 'bg-sky-300' : 'bg-sky-500'} ${j === last ? 'opacity-65' : ''}`}
                        style={{ height: `${(w.count / top) * 100}%` }}
                      />
                      {w.count > 0 && (j === peak || j === last) && (
                        <span
                          className="absolute text-[11px] tabular-nums text-slate-300"
                          style={{ bottom: `calc(${(w.count / top) * 100}% + 3px)` }}
                        >
                          {w.count}
                        </span>
                      )}
                      <span className="absolute top-[156px] text-[10px] text-slate-500">{shortDate(w.start)}</span>
                      {hover === j && (
                        <div
                          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-950 px-2 py-1"
                          style={{ bottom: `calc(${(w.count / top) * 100}% + 22px)` }}
                        >
                          <div className="text-[13px] font-bold text-slate-50">{w.count} concluída(s)</div>
                          <div className="text-[11px] text-slate-400">{weekLabel(w.start, j)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={CARD}>
          <SectionTitle
            title="Distribuição do lead time"
            sub={`Dias entre criação e conclusão das ${m.leadTimes.length} tarefa(s) concluídas no período`}
          />
          {m.leadTimes.length === 0 ? (
            <div className="text-xs text-slate-500">Nenhuma tarefa concluída no período.</div>
          ) : (
            m.leadBuckets.map((b) => (
              <div key={b.label} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 py-1 text-xs">
                <div className="text-slate-400">{b.label}</div>
                <div className="h-3.5">
                  <div className="h-full rounded-r bg-sky-500" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                </div>
                <div className="tabular-nums text-slate-50">{b.count}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] gap-3.5">
        <div className={CARD}>
          <SectionTitle title="WIP por etapa" sub="Defina limites para receber alerta quando houver itens demais ao mesmo tempo" />
          <div className="overflow-x-auto">
            <div className="min-w-[440px] text-xs">
              <div className="grid grid-cols-[minmax(84px,1fr)_44px_72px_minmax(120px,1.3fr)_64px_64px] gap-2 border-b border-slate-800 py-1 text-[10px] uppercase text-slate-500">
                <div>Etapa</div>
                <div className="text-center">Itens</div>
                <div className="text-center">Limite</div>
                <div>Situação</div>
                <div className="text-center" title="Mediana de dias desde a criação">Idade mediana</div>
                <div className="text-center" title="Dias desde a criação do item mais antigo">Mais antigo</div>
              </div>
              {m.stages.map((stage) => {
                const view = LIMIT_VIEW[limitState(stage.count, limits[stage.key])];
                return (
                  <div
                    key={stage.key}
                    className="grid grid-cols-[minmax(84px,1fr)_44px_72px_minmax(120px,1.3fr)_64px_64px] items-center gap-2 border-b border-slate-800 py-1.5 text-slate-100"
                  >
                    <div>{stage.label}</div>
                    <div className="text-center font-bold">{stage.count}</div>
                    <div className="text-center">
                      <LimitInput
                        value={limits[stage.key]}
                        label={`Limite de WIP em ${stage.label}`}
                        onCommit={(n) => saveLimit(stage.key, n)}
                      />
                    </div>
                    <div className="text-slate-400">
                      <span className={`mr-1.5 ${view.tone}`} aria-hidden="true">
                        {view.icon}
                      </span>
                      {view.text}
                    </div>
                    <div className="text-center">{days(stage.medianAge)}</div>
                    <div className="text-center">{days(stage.oldestAge)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={CARD}>
          <SectionTitle title="WIP por pessoa" sub="Itens em andamento por responsável" />
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
            Limite por pessoa (em andamento):
            <LimitInput value={limits.perPerson} label="Limite de WIP por pessoa" onCommit={(n) => saveLimit('perPerson', n)} />
          </div>
          {m.perPerson.length === 0 ? (
            <div className="text-xs text-slate-500">Ninguém com itens em andamento neste recorte.</div>
          ) : (
            m.perPerson.slice(0, 8).map(([name, count]) => {
              const view = LIMIT_VIEW[limitState(count, perPersonLimit)];
              return (
                <div key={name} className="grid grid-cols-[1fr_40px_150px] gap-2 border-b border-slate-800 py-1 text-xs text-slate-100">
                  <div>{name}</div>
                  <div className="text-center font-bold">{count}</div>
                  <div className="text-slate-400">
                    <span className={`mr-1.5 ${view.tone}`} aria-hidden="true">
                      {view.icon}
                    </span>
                    {view.text}
                  </div>
                </div>
              );
            })
          )}
          {m.perPerson.length > 8 && (
            <div className="mt-1 text-[11px] text-slate-500">e mais {m.perPerson.length - 8} pessoa(s)</div>
          )}
        </div>
      </div>

      <div className={CARD}>
        <SectionTitle
          title="Itens mais antigos em andamento"
          sub={`Os 10 mais antigos desde a criação; "parada há" destaca itens sem atualização há ${STALE_ALERT_DAYS} dias ou mais`}
        />
        {m.oldestInProgress.length === 0 ? (
          <div className="text-xs text-slate-500">Nenhum item em andamento neste recorte.</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[560px] text-xs">
              <div className="grid grid-cols-[56px_1fr_130px_70px_80px] gap-2 border-b border-slate-800 py-1 text-[10px] uppercase text-slate-500">
                <div>ID</div>
                <div>Assunto</div>
                <div>Responsável</div>
                <div className="text-center">Idade</div>
                <div className="text-center">Parada há</div>
              </div>
              {m.oldestInProgress.map(({ issue, ageDays, staleDays }) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onSelectIssue(issue)}
                  title="Abrir detalhes"
                  className="grid w-full grid-cols-[56px_1fr_130px_70px_80px] gap-2 border-b border-slate-800 py-1.5 text-left text-slate-100 hover:bg-slate-800/50"
                >
                  <div className="text-slate-500">#{issue.id}</div>
                  <div>
                    {issue.subject}
                    {issue.is_blocked && <span className="ml-2 text-[10px] text-rose-400">▲ BLOQUEADA</span>}
                  </div>
                  <div className="text-slate-400">{issue.assigned_to ? issue.assigned_to.name : 'Sem responsável'}</div>
                  <div className="text-center tabular-nums">{days(ageDays)}</div>
                  <div className={`text-center tabular-nums ${staleDays >= STALE_ALERT_DAYS ? 'text-amber-300' : 'text-slate-400'}`}>
                    {staleDays >= STALE_ALERT_DAYS && <span aria-hidden="true">● </span>}
                    {days(staleDays)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
