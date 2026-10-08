import React, { useState } from 'react';
import {
  Inbox,
  Kanban,
  Layers,
  GitBranch,
  Settings,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  X,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

interface FirstTimeTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: 'inbox' | 'operacional' | 'tatico' | 'estrategico' | 'configuracao') => void;
}

export const FirstTimeTour: React.FC<FirstTimeTourProps> = ({ isOpen, onClose, onNavigateToTab }) => {
  const [activeStep, setActiveStep] = useState(0);

  if (!isOpen) return null;

  const tourSections = [
    {
      id: 'inbox',
      tab: 'inbox' as const,
      icon: Inbox,
      badge: 'Foco Diário',
      title: 'Inbox',
      headline: 'Suas tarefas e itens observados em um único lugar',
      description:
        'Ficam reunidas todas as tarefas atribuídas diretamente ao seu usuário ou que você marcou para observar. Permite ação rápida, atualização de status e visualização de prazos imediatos.',
      highlights: [
        'Tarefas atribuídas ao seu usuário ',
        'Tarefas que você está observando',
        'Filtro rápido por pendentes, em andamento e bloqueadas',
      ],
      color: 'from-blue-500 to-indigo-600',
    },
    {
      id: 'operacional',
      tab: 'operacional' as const,
      icon: Kanban,
      badge: 'Tarefas de Nível Operacional',
      title: 'Operacional',
      headline: 'Para execução do dia a dia das equipes',
      description:
        'Aqui ficam as tarefas do nível operacional. As tarefas são exibidas como cards organizados em um Kanban, onde cada coluna representa a situação da tarefa.',
      highlights: [
        'Cards exibem ID, projeto, assunto, responsável e ID da tarefa pai',
        'Sinalização destacada de cartões com impedimento (bloqueio)',
        'Mova o card para uma coluna para atualizar o status no Redmine via Redmine API',
        'Agrupamento flexível por projeto e filtros por responsável, tipo e bloqueios',
      ],
      color: 'from-emerald-500 to-teal-600',
    },
    {
      id: 'tatico',
      tab: 'tatico' as const,
      icon: Layers,
      badge: 'Tarefas de Nível Tático',
      title: 'Tático',
      headline: 'Entregas Táticas conectando estratégia e operação',
      description:
        'Reúne as entregas do nível tático, focado na coordenação do trabalho entre as equipes. Cada card no Kanban exibe o responsável, projeto, e a lista de IDs das tarefas filhas sob sua responsabilidade.',
      highlights: [
        'Cards exibem IDs das tarefas filhas vinculadas para rastreabilidade imediata',
        'Possibilidade de agrupar o Kanban por Iniciativa Estratégica',
        'Sinalização de impedimentos táticos',
        'Arrastar e soltar atualiza o status diretamente na API do Redmine',
      ],
      color: 'from-purple-500 to-indigo-600',
    },
    {
      id: 'estrategico',
      tab: 'estrategico' as const,
      icon: GitBranch,
      badge: 'Projetos Estratégicos',
      title: 'Estratégico',
      headline: 'Tarefas hierarquizados por projetos estratégicos',
      description:
        'Visão hierárquica das tarefas por projeto estratégico, tarefas táticas e operacionais. ',
      highlights: [
        'Tarefas organizadas hierarquicamente por projetos estratégicos',
        'Barras de progresso e métricas agregadas por iniciativa estratégica',
        'Filtros por projeto, responsável, status e itens bloqueados',
        'Acesso a todos os detalhes técnicos clicando em qualquer nó da árvore',
      ],
      color: 'from-rose-500 to-red-600',
    },
    {
      id: 'configuracao',
      tab: 'configuracao' as const,
      icon: Settings,
      badge: 'Integraçao com Redmine',
      title: 'Configuração',
      headline: 'Configure todos os mapeamentos necessários entre Redmine e Redlevels',
      description:
        'Área central para integrar o Redlevels ao seu Redmine',
      highlights: [
        'URL da aplicação e API Key com teste instantâneo de conexão',
        'Seleção de quais tipos de tarefa estão no nível operacional e tático',
        'Mapeamento de campos customizados do Redmine para Iniciativa Estratégica e Bloqueio (item pausado)',
        'Mapeador flexível dos status do Redmine para os tipos de colunas do Kanban (Backlog, Em Análise, Em Progresso, Concluído) separado por tipo',
        'Seleção de temas visuais',
      ],
      color: 'from-amber-500 to-orange-600',
    },
  ];

  const current = tourSections[activeStep];
  const IconComponent = current.icon;

  const handleFinish = () => {
    onClose();
    if (onNavigateToTab) {
      onNavigateToTab(current.tab);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-black text-sm">
              <img src="./icons/icon-32.png" alt="RL" className="w-6 h-6 rounded-md" />
            </div>
            <div>
              <h3 className="text-base font-bold text-black flex items-center gap-2">
                Conheça o Redlevels
                <span className="text-[11px] font-normal text-slate-400">
                  (Passo {activeStep + 1} de {tourSections.length})
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Navigation Bar */}
        <div className="px-6 py-2.5 bg-slate-950/30 border-b border-slate-800/40 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {tourSections.map((sec, idx) => {
            const SecIcon = sec.icon;
            const isCurrent = activeStep === idx;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${isCurrent
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
              >
                <SecIcon className="w-3.5 h-3.5" />
                <span>{sec.title}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
          {/* Card Presentation */}
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${current.color} flex items-center justify-center text-white shadow-lg shrink-0`}>
              <IconComponent className="w-8 h-8" />
            </div>

            <div className="space-y-2 flex-1">
              <span className="text-xs uppercase tracking-wider font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                {current.badge}
              </span>
              <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">
                {current.headline}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed pt-1">
                {current.description}
              </p>
            </div>
          </div>

          {/* Highlights checklist */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Recursos e Comportamentos Chave:
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {current.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="leading-normal">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-950/70 flex items-center justify-between">
          <button
            onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
            disabled={activeStep === 0}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Anterior
          </button>

          <div className="flex items-center gap-1.5">
            {tourSections.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${activeStep === i ? 'w-6 bg-rose-500' : 'w-1.5 bg-slate-700'
                  }`}
              />
            ))}
          </div>

          {activeStep < tourSections.length - 1 ? (
            <button
              onClick={() => setActiveStep((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md transition-all"
            >
              <span>Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
            >
              <span>Entendido, Começar!</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
