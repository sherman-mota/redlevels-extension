import React, { useMemo, useState } from 'react';
import type { RedlevelsConfig, RedmineIssue } from '../types/redmine';
import { diagnoseInitiative } from '../services/initiativeDiagnostic';

interface InitiativeDiagnosticProps {
  issues: RedmineIssue[];
  config: RedlevelsConfig;
  /** Uses another custom field as the strategic initiative. */
  onUseField: (fieldId: number) => void;
}

const TABLE_ROWS = 10;

/**
 * Explains why tactical issues fall in "Sem Iniciativa Vinculada": one line with the state and, expanded,
 * the likely causes, similar fields found in the issues and every field Redmine returned.
 */
export const InitiativeDiagnostic: React.FC<InitiativeDiagnosticProps> = ({ issues, config, onUseField }) => {
  const [open, setOpen] = useState(false);
  const d = useMemo(() => diagnoseInitiative(issues, config), [issues, config]);
  if (d.total === 0) return null;

  const without = d.total - d.withValue;
  const configured = d.fieldId !== undefined && d.fieldId !== null;
  const state = !configured || d.withValue === 0 ? { icon: '▲', tone: 'text-rose-400' } : without === 0 ? { icon: '✓', tone: 'text-emerald-400' } : { icon: '●', tone: 'text-amber-300' };
  const summary = configured ? `Campo #${d.fieldId} preenchido em ${d.withValue} de ${d.total} entregas táticas` : 'Nenhum campo de iniciativa configurado';

  const causes: string[] = [];
  if (!configured) causes.push('Selecione o campo em Configuração › Campo de Iniciativa Estratégica.');
  if (d.absent > 0)
    causes.push(
      `O Redmine não devolveu o campo #${d.fieldId} em ${d.absent} entrega(s). Isso acontece quando o campo não está habilitado para o tipo ou projeto da tarefa, ou quando o seu usuário não tem permissão para vê-lo. Se a tarefa mostra o valor no Redmine web com outro usuário, é permissão.`
    );
  if (d.empty > 0) causes.push(`O campo #${d.fieldId} existe, mas está vazio em ${d.empty} entrega(s) (falta preencher no Redmine).`);

  return (
    <section aria-label="Diagnóstico da iniciativa estratégica" className="rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span aria-hidden="true" className={`font-bold ${state.tone}`}>
          {state.icon}
        </span>
        <span className="text-xs text-slate-100">Iniciativa estratégica: {summary}</span>
        {configured && without > 0 && <span className="text-[11px] text-slate-400">· {without} em "Sem Iniciativa Vinculada"</span>}
        {configured && d.candidates.length > 0 && <span className="text-[11px] text-amber-300">· há outro campo parecido</span>}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="ml-auto rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
        >
          Diagnóstico {open ? '▴' : '▾'}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-slate-400">
          {causes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4">
              {causes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : (
            <div>Todas as entregas táticas carregadas têm o campo preenchido.</div>
          )}

          {d.candidates.length > 0 && (
            <div>
              <div className="text-amber-300">Campo parecido encontrado nas entregas:</div>
              {d.candidates.map((f) => (
                <div key={f.id} className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-slate-100">
                    #{f.id} "{f.name}" preenchido em {f.filled} de {d.total}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUseField(f.id)}
                    className="rounded-lg bg-rose-600 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-rose-500"
                  >
                    Usar este campo
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="text-slate-500">Campos personalizados que o Redmine devolveu nas entregas (preenchidos/total):</div>
          <div>
            {d.fields.slice(0, TABLE_ROWS).map((f) => (
              <div
                key={f.id}
                className={`grid grid-cols-[60px_1fr_90px] gap-2 border-b border-slate-800 py-0.5 ${f.id === d.fieldId ? 'font-bold text-slate-100' : ''}`}
              >
                <span>#{f.id}</span>
                <span>{f.name || '(sem nome)'}</span>
                <span className="text-right">
                  {f.filled}/{d.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
