import React from 'react';
import {
  Layers,
  Inbox,
  Kanban,
  GitBranch,
  Settings,
  HelpCircle,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { ConnectionHealth, RedlevelsConfig } from '../types/redmine';
import type { SyncInfo } from '../services/incrementalSync';

interface HeaderProps {
  currentTab: 'inbox' | 'operacional' | 'tatico' | 'estrategico' | 'configuracao';
  onSelectTab: (tab: 'inbox' | 'operacional' | 'tatico' | 'estrategico' | 'configuracao') => void;
  connectionHealth: ConnectionHealth;
  config: RedlevelsConfig;
  onRefresh: (mode: 'full' | 'incremental') => void;
  syncInfo?: SyncInfo | null;
  onOpenTour: () => void;
  inboxCount: number;
  blockedCount: number;
  isRefreshing: boolean;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  connectionHealth,
  config,
  onRefresh,
  syncInfo,
  onOpenTour,
  inboxCount,
  blockedCount,
  isRefreshing,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      <div className={`mx-auto transition-all ${currentTab === 'operacional' || currentTab === 'tatico'
          ? 'w-full px-4 sm:px-6 lg:px-8'
          : 'max-w-7xl px-4 sm:px-6'
        }`}>
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onSelectTab('operacional')}>
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-rose-600 via-rose-700 to-red-900 shadow-md shadow-rose-900/40 text-white font-extrabold text-sm tracking-tighter">
                <img src="./icons/icon-32.png" alt="RL" className="w-6 h-6 rounded-md" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold tracking-tight text-white flex items-center gap-1">
                    Redlevels
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      ext
                    </span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                  Redmine with Flight Levels flavour
                </span>
              </div>
            </div>

            {/* Connection Health Pill */}
            <div className="hidden md:flex items-center ml-2">
              {connectionHealth.status === 'connected' ? (
                <div
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shadow-sm"
                  title={`Conectado com sucesso${connectionHealth.latencyMs ? ` (${connectionHealth.latencyMs}ms)` : ''}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-medium truncate max-w-[130px]">
                    {connectionHealth.user?.firstname || 'Conectado'}
                  </span>
                  {config.isDemoMode && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-1.5 py-0.2 rounded font-mono">
                      demo
                    </span>
                  )}
                </div>
              ) : connectionHealth.status === 'connecting' || isRefreshing ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Sincronizando...</span>
                </div>
              ) : (
                <button
                  onClick={() => onSelectTab('configuracao')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 transition-colors"
                  title={connectionHealth.errorMessage || 'Clique para configurar Redmine'}
                >
                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                  <span className="truncate max-w-[120px]">Desconectado</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
            <button
              onClick={() => onSelectTab('inbox')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${currentTab === 'inbox'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Inbox</span>
              {inboxCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${currentTab === 'inbox' ? 'bg-white/20 text-white' : 'bg-rose-500/30 text-rose-300'
                  }`}>
                  {inboxCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('operacional')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${currentTab === 'operacional'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Operacional</span>
              {blockedCount > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-amber-400" title={`${blockedCount} itens com impedimento`} />
              )}
            </button>

            <button
              onClick={() => onSelectTab('tatico')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${currentTab === 'tatico'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Tático</span>
            </button>

            <button
              onClick={() => onSelectTab('estrategico')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${currentTab === 'estrategico'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Estratégico</span>
            </button>

            <button
              onClick={() => onSelectTab('configuracao')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${currentTab === 'configuracao'
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              title="Configurações e Mapeamentos"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configuração</span>
            </button>
          </nav>

          {/* Action Tools */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Open Redmine link if configured */}
            {config.redmineUrl && (
              <a
                href={config.redmineUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden lg:flex items-center gap-1 p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="Abrir Redmine no navegador"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                <span>Redmine Web</span>
              </a>
            )}

            {/* Last synchronization */}
            {syncInfo && (
              <span
                className="hidden lg:block text-[10px] font-mono text-slate-400 whitespace-nowrap"
                title={
                  syncInfo.mode === 'incremental'
                    ? 'Sincronização incremental: só o que mudou desde a última carga'
                    : syncInfo.mode === 'cache'
                      ? 'Tarefas guardadas neste computador; buscando o que mudou no Redmine'
                      : 'Carga completa de todas as tarefas'
                }
              >
                {syncInfo.mode === 'incremental'
                  ? `Atualizado ${formatTime(syncInfo.at)} · ${syncInfo.count} alterada(s)`
                  : syncInfo.mode === 'cache'
                    ? `Dados guardados ${formatTime(syncInfo.at)} · ${syncInfo.count} tarefas`
                    : `Carga completa ${formatTime(syncInfo.at)} · ${syncInfo.count} tarefas`}
              </span>
            )}

            {/* Incremental sync (default) */}
            <button
              onClick={() => onRefresh('incremental')}
              disabled={isRefreshing}
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center gap-1 disabled:opacity-50"
              title="Sincronizar: busca só o que mudou desde a última carga"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>

            {/* Full reload */}
            <button
              onClick={() => onRefresh('full')}
              disabled={isRefreshing}
              className="p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-50"
              title="Carga completa: recarrega tudo do Redmine (use se algo parecer desatualizado)"
            >
              Completa
            </button>

            {/* Tour */}
            <button
              onClick={onOpenTour}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
              title="Guia da Interface & Estrutura de Níveis"
            >
              <HelpCircle className="w-4 h-4 text-slate-400 hover:text-rose-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
