import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { LEVEL_LABEL, LEVEL_QUESTION, LevelHealth, verdictOf } from '../services/levelHealth';

type PanelLevel = 'operacional' | 'tatico';

const LEGEND: Record<PanelLevel, string[]> = {
  operacional: [
    'Cada coluna é uma etapa do fluxo de trabalho. Mover um card grava no Redmine.',
    '▲ = problema (bloqueio, atraso, WIP acima do limite). ● = atenção (item parado).',
    'O número ao lado do nome da coluna compara o WIP da etapa com o limite definido na aba Fluxo.',
    'A linha ↑ no card mostra a iniciativa e o item pai (nível Tático); clique para abri-lo.',
  ],
  tatico: [
    'Cada faixa agrupa as entregas; os cards são as entregas que reúnem várias tarefas.',
    'A barra "Tarefas filhas" mostra o andamento das tarefas operacionais ligadas à entrega.',
    '▲ Em risco = alguma filha bloqueada ou atrasada. ● Atenção = filha parada. ✓ Pronta para fechar = todas concluídas.',
  ],
};

const STORAGE_KEY = 'redlevels_ui_legend_open';

const TONE = {
  problema: 'border-rose-800/80 bg-rose-950/40 text-rose-300',
  atencao: 'border-amber-800/80 bg-amber-950/30 text-amber-300',
  ok: 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300',
};

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** One line at the top of a level panel: the question of the level, its verdict and a "how to read" legend. */
export const LevelStatusBar: React.FC<{ level: PanelLevel; health: LevelHealth }> = ({ level, health }) => {
  const [open, setOpen] = useState(readOpen);
  const verdict = verdictOf(level, health);
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? '0' : '1');
      } catch {
        /* storage unavailable: the state just is not remembered */
      }
      return !v;
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-slate-400">
          <strong className="font-bold text-slate-200">{LEVEL_LABEL[level]}:</strong> {LEVEL_QUESTION[level]}
        </span>
        <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${TONE[verdict.state]}`}>
          <span aria-hidden="true">{verdict.icon}</span>
          {verdict.label}
          <span className="font-medium text-slate-300">· {verdict.detail}</span>
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Como ler
        </button>
      </div>
      {open && (
        <ul className="list-disc space-y-0.5 rounded-xl border border-slate-800 bg-slate-900/80 py-2.5 pl-8 pr-3.5 text-xs leading-snug text-slate-300">
          {LEGEND[level].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
