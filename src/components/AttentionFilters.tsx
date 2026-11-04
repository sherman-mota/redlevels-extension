import React from 'react';
import { ATTENTION_FILTERS, AttentionKey, attentionCounts, toggleAttention } from '../services/attentionFilters';
import type { RedmineIssue } from '../types/redmine';

interface AttentionFiltersProps {
  /** The issues of the panel BEFORE the shortcuts apply, so the counts do not change as you click. */
  issues: RedmineIssue[];
  doneStatusIds: number[];
  selected: AttentionKey[];
  onChange: (selected: AttentionKey[]) => void;
}

const TONE = {
  danger: 'text-rose-300',
  warn: 'text-amber-300',
};
const COUNT_TONE = {
  danger: 'bg-rose-500/20 text-rose-300',
  warn: 'bg-amber-500/20 text-amber-300',
};

/** "Precisa de atenção": chips with the live count of each problem; click to show only those. */
export const AttentionFilters: React.FC<AttentionFiltersProps> = ({ issues, doneStatusIds, selected, onChange }) => {
  const counts = attentionCounts(issues, doneStatusIds);
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtros rápidos de problemas">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Precisa de atenção</span>
      {ATTENTION_FILTERS.map((f) => {
        const n = counts[f.key];
        const on = selected.includes(f.key);
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(toggleAttention(selected, f.key))}
            title={on ? `${f.title} — filtro ligado, clique para desligar` : `${f.title}: ${n} no recorte atual. Clique para mostrar só essas.`}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border pl-2.5 pr-1.5 text-xs font-semibold transition-colors ${
              on
                ? 'border-slate-100 bg-slate-100 text-slate-900'
                : `border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 ${n === 0 ? 'opacity-55' : ''}`
            }`}
          >
            <span aria-hidden="true" className={`text-[10px] ${on ? 'text-slate-900' : TONE[f.tone]}`}>
              {f.icon}
            </span>
            {f.label}
            <span
              className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center font-mono text-[11px] leading-none ${
                on ? 'bg-slate-900/20 text-slate-900' : n > 0 ? COUNT_TONE[f.tone] : 'bg-slate-800 text-slate-400'
              }`}
            >
              {n}
            </span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="px-1 text-xs font-semibold text-slate-400 underline hover:text-slate-200"
        >
          Limpar atalhos
        </button>
      )}
    </div>
  );
};
