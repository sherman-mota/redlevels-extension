import React, { useState, useMemo } from 'react';
import {
  Inbox,
  UserCheck,
  Eye,
  AlertTriangle,
  FolderGit2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Search,
} from 'lucide-react';
import { RedmineIssue, RedmineUser, RedmineStatus, InboxIds } from '../types/redmine';

interface InboxViewProps {
  issues: RedmineIssue[];
  inboxIds?: InboxIds;
  currentUser?: RedmineUser;
  statuses: RedmineStatus[];
  onSelectIssue: (issue: RedmineIssue) => void;
  onUpdateStatus: (issueId: number, statusId: number) => Promise<void>;
}

export const InboxView: React.FC<InboxViewProps> = ({
  issues,
  inboxIds,
  currentUser,
  statuses,
  onSelectIssue,
  onUpdateStatus,
}) => {
  const [inboxTab, setInboxTab] = useState<'assigned' | 'watched'>('assigned');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  const currentUserName = currentUser ? `${currentUser.firstname} ${currentUser.lastname}`.trim() : '';

  // Filter assigned vs watched
  const assignedIssues = useMemo(() => {
    if (inboxIds?.assigned && inboxIds.assigned.length > 0) {
      const set = new Set(inboxIds.assigned);
      return issues.filter((i) => set.has(i.id));
    }
    return issues.filter((issue) => {
      if (!currentUserName && !currentUser?.login) return true;
      const assigned = issue.assigned_to?.name || '';
      return (
        assigned.toLowerCase().includes(currentUserName.toLowerCase()) ||
        assigned.toLowerCase().includes((currentUser?.login || '').toLowerCase()) ||
        issue.assigned_to?.id === currentUser?.id
      );
    });
  }, [issues, inboxIds, currentUserName, currentUser]);

  const watchedIssues = useMemo(() => {
    if (inboxIds?.watched && inboxIds.watched.length > 0) {
      const set = new Set(inboxIds.watched);
      return issues.filter((i) => set.has(i.id));
    }
    return issues.filter((issue) => {
      const isAuthor =
        issue.author?.name.toLowerCase().includes(currentUserName.toLowerCase()) ||
        issue.author?.id === currentUser?.id;
      const isWatcher = (issue.watchers || []).some((w) => w.id === currentUser?.id);
      return isAuthor || isWatcher || (issue.journals && issue.journals.length > 0);
    });
  }, [issues, inboxIds, currentUserName, currentUser]);

  const currentList = inboxTab === 'assigned' ? assignedIssues : watchedIssues;

  // Apply filters
  const filteredIssues = useMemo(() => {
    return currentList.filter((issue) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = issue.subject.toLowerCase().includes(q);
        const matchesId = String(issue.id).includes(q);
        const matchesProject = issue.project.name.toLowerCase().includes(q);
        if (!matchesSubject && !matchesId && !matchesProject) return false;
      }

      if (statusFilter !== 'all' && issue.status.id !== statusFilter) {
        return false;
      }

      if (onlyBlocked && !issue.is_blocked) {
        return false;
      }

      return true;
    });
  }, [currentList, searchQuery, statusFilter, onlyBlocked]);

  // Quick metrics
  const blockedCount = currentList.filter((i) => i.is_blocked).length;
  const inProgressCount = currentList.filter((i) =>
    i.status.name.toLowerCase().includes('andamento') || i.status.name.toLowerCase().includes('progresso')
  ).length;

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-rose-500" />
              <span>Inbox de Tarefas</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {currentList.length} itens
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Suas tarefas atribuídas e itens que você está acompanhando no Redmine.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2 text-xs">
            <div className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{inProgressCount} em andamento</span>
            </div>
            {blockedCount > 0 && (
              <div className="px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center gap-1.5 text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>{blockedCount} bloqueadas</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab & Filter Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setInboxTab('assigned')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                inboxTab === 'assigned'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Atribuídas a Mim ({assignedIssues.length})</span>
            </button>

            <button
              onClick={() => setInboxTab('watched')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                inboxTab === 'watched'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Observadas / Acompanhadas ({watchedIssues.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no inbox..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">Todos os Status</option>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Blocked */}
            <button
              onClick={() => setOnlyBlocked(!onlyBlocked)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                onlyBlocked
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bloqueadas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {filteredIssues.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">Tudo limpo por aqui!</h3>
            <p className="text-xs text-slate-500">
              Nenhuma tarefa correspondente aos filtros atuais no seu Inbox.
            </p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:-translate-y-0.5 ${
                issue.is_blocked
                  ? 'bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border-rose-800/80 hover:border-rose-600'
                  : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="font-mono text-xs font-bold text-rose-300 bg-rose-950/50 px-2 py-0.5 rounded-lg border border-rose-900/50 shrink-0 mt-0.5">
                  #{issue.id}
                </span>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-1.5 py-0.2 rounded">
                      {issue.tracker.name}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                      <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{issue.project.name}</span>
                    </span>
                    {issue.parent && (
                      <span className="font-mono text-[10px] text-blue-300 bg-blue-950/60 px-1.5 py-0.2 rounded">
                        Pai: #{issue.parent.id}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-white truncate hover:text-rose-300 transition-colors">
                    {issue.subject}
                  </h3>

                  {issue.is_blocked && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span className="font-medium">
                        Impedimento: {issue.block_reason || 'Item bloqueado'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                {issue.due_date && (
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="w-3 h-3 text-rose-400" />
                    <span>{issue.due_date}</span>
                  </div>
                )}

                {/* Quick Status Changer */}
                <select
                  value={issue.status.id}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateStatus(issue.id, Number(e.target.value));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:border-rose-500 cursor-pointer"
                >
                  {statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
