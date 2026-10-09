import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Calendar,
  Clock,
  User,
  FolderGit2,
  AlertTriangle,
  CheckCircle,
  GitPullRequest,
  MessageSquare,
  FileText,
  Tag,
  Send,
  Loader2,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { RedmineIssue, RedmineStatus } from '../types/redmine';

interface IssueDetailModalProps {
  issue: RedmineIssue | null;
  isOpen: boolean;
  onClose: () => void;
  redmineUrl: string;
  statuses: RedmineStatus[];
  onUpdateStatus: (issueId: number, statusId: number, notes?: string) => Promise<void>;
  onToggleBlocked?: (issueId: number, currentlyBlocked: boolean) => Promise<void>;
  onSelectIssueById?: (issueId: number) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  isOpen,
  onClose,
  redmineUrl,
  statuses,
  onUpdateStatus,
  onToggleBlocked,
  onSelectIssueById,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'journals' | 'custom_fields'>('details');
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  if (!isOpen || !issue) return null;

  const redmineIssueUrl = redmineUrl
    ? `${redmineUrl.replace(/\/+$/, '')}/issues/${issue.id}`
    : '#';

  // Redmine provides allowed_statuses based on tracker & role workflow rules.
  // Ensure current status is included so it displays accurately and guard against unexpected types.
  const availableStatuses = React.useMemo(() => {
    const list: RedmineStatus[] = [];
    if (Array.isArray(issue.allowed_statuses) && issue.allowed_statuses.length > 0) {
      issue.allowed_statuses.forEach((s) => {
        if (s && typeof s === 'object' && typeof s.id === 'number') {
          list.push({ id: s.id, name: s.name || `Status #${s.id}`, is_closed: s.is_closed });
        }
      });
      if (issue.status && typeof issue.status.id === 'number' && !list.some((s) => s.id === issue.status.id)) {
        list.unshift({
          id: issue.status.id,
          name: issue.status.name || `Status #${issue.status.id}`,
          is_closed: issue.status.is_closed,
        });
      }
    }
    if (list.length > 0) return list;
    return Array.isArray(statuses) ? statuses : [];
  }, [issue.allowed_statuses, issue.status, statuses]);

  const handleStatusChange = async (newStatusId: number) => {
    if (!newStatusId || newStatusId === issue.status?.id) return;
    setIsUpdatingStatus(true);
    try {
      await onUpdateStatus(issue.id, newStatusId);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmittingNote(true);
    try {
      await onUpdateStatus(issue.id, issue.status?.id ?? 0, newNote.trim());
      setNewNote('');
      setActiveTab('journals');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const parentId = issue.parent
    ? (typeof issue.parent === 'object' ? issue.parent.id : Number(issue.parent))
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs px-2 py-0.5 rounded-md font-bold bg-slate-800 text-rose-300 border border-slate-700">
                #{issue.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                {issue.tracker?.name || 'Tarefa'}
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                <FolderGit2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate">{issue.project?.name || ''}</span>
              </span>
              {parentId && (
                <button
                  onClick={() => onSelectIssueById?.(parentId)}
                  className="text-xs font-mono px-2 py-0.5 rounded-md bg-blue-950/60 text-blue-300 border border-blue-800/60 hover:bg-blue-900/60 transition-colors flex items-center gap-1"
                  title="Abrir tarefa pai"
                >
                  <span>Pai: #{parentId}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight leading-snug">
              {issue.subject || '(Sem assunto)'}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {redmineUrl && (
              <a
                href={redmineIssueUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-slate-100 border border-slate-700 transition-colors flex items-center gap-1.5"
                title="Abrir no Redmine Web Oficial"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Redmine</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Impediment Alert Banner */}
        {issue.is_blocked && (
          <div className="px-6 py-3 bg-rose-950/80 border-b border-rose-800/80 flex items-start justify-between gap-3 animate-pulse-glow">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                  Item com Impedimento / Bloqueado
                </p>
                <p className="text-xs text-rose-100 mt-0.5">
                  {issue.block_reason || 'Esta tarefa está marcada como bloqueada aguardando resolução.'}
                </p>
              </div>
            </div>
            {onToggleBlocked && (
              <button
                onClick={() => onToggleBlocked(issue.id, true)}
                className="px-2.5 py-1 text-xs rounded-lg font-semibold bg-rose-800 hover:bg-rose-700 text-white shrink-0 shadow-sm"
              >
                Desbloquear
              </button>
            )}
          </div>
        )}

        {/* Status bar & Meta controls */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Status:</span>
              <select
                value={issue.status?.id ?? (availableStatuses[0]?.id ?? '')}
                onChange={(e) => handleStatusChange(Number(e.target.value))}
                disabled={isUpdatingStatus || availableStatuses.length === 0}
                className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 font-semibold focus:outline-none focus:border-rose-500 cursor-pointer disabled:opacity-50"
              >
                {availableStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {isUpdatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />}
            </div>

            {/* Priority */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-medium">Prioridade:</span>
              <span className={`px-2 py-0.5 rounded font-medium ${issue.priority?.name?.toLowerCase().includes('alta') || issue.priority?.name?.toLowerCase().includes('urgente')
                ? 'bg-red-950/70 text-red-300 border border-red-800/60'
                : 'bg-slate-800 text-slate-300'
                }`}>
                {issue.priority?.name || 'Normal'}
              </span>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 font-medium">Responsável:</span>
              <span className="text-slate-200 font-semibold">
                {issue.assigned_to?.name || 'Não atribuído'}
              </span>
            </div>
          </div>

          {/* Strategic Initiative Tag */}
          {issue.strategic_initiative && issue.strategic_initiative !== 'Sem Iniciativa Vinculada' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/50 text-purple-200 border border-purple-800/50 text-xs">
              <Tag className="w-3 h-3 text-purple-400" />
              <span className="font-semibold truncate max-w-[200px]">{issue.strategic_initiative}</span>
            </div>
          )}
        </div>

        {/* Tab Navigator */}
        <div className="px-6 border-b border-slate-800 flex items-center gap-4 bg-slate-900/90 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'details'
              ? 'border-rose-500 text-rose-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('journals')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'journals'
              ? 'border-rose-500 text-rose-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Histórico & Notas</span>
            {Array.isArray(issue.journals) && issue.journals.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {issue.journals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('custom_fields')}
            className={`py-3 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'custom_fields'
              ? 'border-rose-500 text-rose-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Campos Personalizados</span>
            {Array.isArray(issue.custom_fields) && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {issue.custom_fields.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Description Box */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Descrição da Tarefa
                </h4>
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {issue.description || <span className="text-slate-500 italic">Nenhuma descrição informada.</span>}
                </div>
              </div>

              {/* Subtasks / Children list */}
              {Array.isArray(issue.children) && issue.children.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Subtarefas / Tarefas Filhas ({issue.children.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {issue.children.map((child, idx) => {
                      const cId = typeof child === 'object' && child !== null ? child.id : Number(child);
                      const cSubj = typeof child === 'object' && child !== null ? child.subject : '';
                      return (
                        <div
                          key={cId ?? idx}
                          onClick={() => cId && onSelectIssueById?.(cId)}
                          className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 cursor-pointer transition-all flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-xs font-bold text-rose-300 bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-900/60">
                              #{cId}
                            </span>
                            <span className="text-xs text-slate-200 truncate font-medium">
                              {cSubj || `Subtarefa #${cId}`}
                            </span>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block font-medium">Data de Início</span>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{issue.start_date || 'Não definida'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block font-medium">Data de Prevista</span>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-rose-400" />
                    <span>{issue.due_date || 'Não definida'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block font-medium">Horas Estimadas</span>
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{issue.estimated_hours ? `${issue.estimated_hours}h` : '0h'}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block font-medium">Progresso (% Concluído)</span>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all"
                        style={{ width: `${issue.done_ratio || 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-200 font-mono">
                      {issue.done_ratio || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'journals' && (
            <div className="space-y-5">
              {/* Add comment box */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Adicionar Nota / Comentário à Tarefa
                </label>
                <div className="relative">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={3}
                    placeholder="Escreva sua atualização ou anotação para o Redmine..."
                    className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-all resize-none"
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!newNote.trim() || isSubmittingNote}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {isSubmittingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Salvar Nota</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* History list */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Histórico de Anotações
                </h4>
                {Array.isArray(issue.journals) && issue.journals.length > 0 ? (
                  issue.journals.map((journal, idx) => (
                    <div
                      key={journal.id ?? idx}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-rose-300">
                          {journal.user?.name || 'Usuário'}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {journal.created_on ? new Date(journal.created_on).toLocaleString() : ''}
                        </span>
                      </div>
                      {journal.notes && (
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {String(journal.notes)}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic py-3">
                    Nenhuma anotação registrada ainda nesta tarefa.
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'custom_fields' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Campos Personalizados
              </h4>
              {Array.isArray(issue.custom_fields) && issue.custom_fields.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {issue.custom_fields.map((cf, idx) => (
                    <div
                      key={cf.id ?? idx}
                      className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1"
                    >
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        {cf.name || `Campo #${cf.id}`}
                      </span>
                      <p className="text-xs text-rose-300 font-medium break-words">
                        {cf.value !== undefined && cf.value !== null && cf.value !== '' ? (
                          Array.isArray(cf.value)
                            ? cf.value.map((v) => (typeof v === 'object' && v !== null ? ((v as any)?.name || JSON.stringify(v)) : String(v))).join(', ')
                            : typeof cf.value === 'object' && cf.value !== null
                              ? ((cf.value as any)?.name || JSON.stringify(cf.value))
                              : String(cf.value)
                        ) : (
                          <span className="text-slate-600 italic">Vazio</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Nenhum campo personalizado associado a esta tarefa.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div>
            Criada por <strong className="text-slate-300">{issue.author?.name}</strong> em{' '}
            {issue.created_on ? new Date(issue.created_on).toLocaleDateString() : ''}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
