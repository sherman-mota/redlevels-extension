import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { OnboardingModal } from './components/OnboardingModal';
import { FirstTimeTour } from './components/FirstTimeTour';
import { IssueDetailModal } from './components/IssueDetailModal';
import { KanbanOperacional } from './components/KanbanOperacional';
import { KanbanTatico } from './components/KanbanTatico';
import { IniciativasEstrategicas } from './components/IniciativasEstrategicas';
import { InboxView } from './components/InboxView';
import { ConfiguracaoView } from './components/ConfiguracaoView';

import {
  RedlevelsConfig,
  RedmineIssue,
  RedmineProject,
  RedmineTracker,
  RedmineStatus,
  RedmineCustomFieldDef,
  RedmineUser,
  ConnectionHealth,
  InboxIds,
} from './types/redmine';

import {
  loadConfig,
  saveConfig,
  resetDemoIssues,
  DEFAULT_CONFIG,
  DEMO_CONFIG_PRESET,
  suggestStatusMapping,
} from './services/storage';

import {
  RedmineClient,
  processIssueWithConfig,
  linkChildren,
  inferCustomFields,
  hasHostPermission,
  requestHostPermission,
  mergeIssues,
} from './services/redmineApi';

import { applyTheme } from './styles/themes';
import { Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

export default function App() {
  // Config state
  const [config, setConfig] = useState<RedlevelsConfig>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Connection state
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    status: 'idle',
  });
  const [missingHostPermission, setMissingHostPermission] = useState(false);

  // Current user
  const [currentUser, setCurrentUser] = useState<RedmineUser | undefined>();

  // Metadata arrays
  const [projects, setProjects] = useState<RedmineProject[]>([]);
  const [trackers, setTrackers] = useState<RedmineTracker[]>([]);
  const [statuses, setStatuses] = useState<RedmineStatus[]>([]);
  const [customFields, setCustomFields] = useState<RedmineCustomFieldDef[]>([]);
  const [issues, setIssues] = useState<RedmineIssue[]>([]);
  const [inboxIds, setInboxIds] = useState<InboxIds>({ assigned: [], watched: [] });

  // Navigation state
  const [currentTab, setCurrentTab] = useState<'inbox' | 'operacional' | 'tatico' | 'estrategico' | 'configuracao'>('operacional');

  // Modals state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<RedmineIssue | null>(null);

  // Pending updates for optimist cards
  const [pendingIssueIds, setPendingIssueIds] = useState<Set<number>>(new Set());

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize Redmine Client
  const client = useMemo(() => {
    return new RedmineClient(config.redmineUrl, config.apiKey, config.isDemoMode);
  }, [config.redmineUrl, config.apiKey, config.isDemoMode]);

  // Load config on mount
  useEffect(() => {
    (async () => {
      const loaded = await loadConfig();
      setConfig(loaded);
      applyTheme(loaded.theme);
      setConfigLoaded(true);
    })();
  }, []);

  // Check host permissions when config URL changes
  useEffect(() => {
    if (!configLoaded || config.isDemoMode || !config.redmineUrl) {
      setMissingHostPermission(false);
      return;
    }
    hasHostPermission(config.redmineUrl).then((granted) => {
      setMissingHostPermission(!granted);
    });
  }, [configLoaded, config.isDemoMode, config.redmineUrl]);

  // Load all data from Redmine
  const loadData = useCallback(async () => {
    if (!configLoaded) return;
    setIsRefreshing(true);
    setLoadError(null);

    try {
      setConnectionHealth((prev) => ({ ...prev, status: 'connecting' }));

      // 1. Test Connection & get user
      const userRes = await client.testConnection();
      if (!userRes.success || !userRes.data) {
        setConnectionHealth({
          status: 'error',
          errorMessage: userRes.error || 'Falha ao conectar com o Redmine',
          latencyMs: userRes.latencyMs,
        });
        setLoadError(userRes.error || 'Não foi possível conectar ao Redmine');
        setIsRefreshing(false);
        setIsLoading(false);
        return;
      }

      const activeUser = userRes.data;
      setCurrentUser(activeUser);
      setConnectionHealth({
        status: 'connected',
        user: activeUser,
        latencyMs: userRes.latencyMs,
        lastChecked: new Date().toISOString(),
      });
      setMissingHostPermission(false);

      // 2. Fetch Projects, Trackers, Statuses, Custom Fields, Issues, Inbox in parallel
      const [projRes, trackRes, statRes, cfRes, issRes, inboxRes] = await Promise.all([
        client.getProjects(),
        client.getTrackers(),
        client.getStatuses(),
        client.getCustomFields(),
        client.getWorkspaceIssues(),
        client.getInbox(activeUser),
      ]);

      if (projRes.success && projRes.data) {
        const sorted = [...projRes.data].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
        );
        setProjects(sorted);
      }
      if (trackRes.success && trackRes.data) setTrackers(trackRes.data);
      if (statRes.success && statRes.data) setStatuses(statRes.data);

      // Status mapping auto-suggest if user hasn't configured any
      let currentMapping = config.statusMapping;
      const hasAnyMapping = Object.values(currentMapping).some((arr) => arr.length > 0);
      if (!hasAnyMapping && statRes.success && statRes.data && statRes.data.length > 0) {
        currentMapping = suggestStatusMapping(statRes.data);
        handleUpdateConfig({ statusMapping: currentMapping });
      }

      // Merge issues from workspace and inbox queries
      let allIssues = issRes.success && issRes.data ? issRes.data : [];
      if (inboxRes.success && inboxRes.data) {
        allIssues = mergeIssues(allIssues, inboxRes.data.issues);
        setInboxIds(inboxRes.data.ids);
      }

      // Link parents to children hierarchy
      const linked = linkChildren(allIssues);

      // Custom fields from API or inferred
      let resolvedCustomFields: RedmineCustomFieldDef[] = [];
      if (cfRes.success && cfRes.data && cfRes.data.length > 0) {
        resolvedCustomFields = cfRes.data;
      } else {
        resolvedCustomFields = inferCustomFields(linked);
      }
      setCustomFields(resolvedCustomFields);

      // Process issues with config (blocked flags, strategic initiative names)
      const processed = linked.map((i) => processIssueWithConfig(i, config));
      setIssues(processed);
    } catch (e: any) {
      console.error('Erro ao carregar dados do Redmine', e);
      setConnectionHealth({
        status: 'error',
        errorMessage: e.message || 'Erro inesperado na sincronização',
      });
      setLoadError(e.message || 'Erro inesperado na sincronização');
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [client, config, configLoaded]);

  // Initial check: if not configured, show onboarding
  useEffect(() => {
    if (!configLoaded) return;
    if (!config.isConfigured && !config.isDemoMode) {
      setShowOnboarding(true);
      setIsLoading(false);
    } else {
      loadData();
    }
  }, [configLoaded, config.isConfigured, config.isDemoMode, loadData]);

  // Handle configuration updates
  const handleUpdateConfig = async (updates: Partial<RedlevelsConfig>) => {
    const updated = { ...config, ...updates };
    setConfig(updated);
    await saveConfig(updated);
    if (updates.theme) {
      applyTheme(updates.theme);
    }

    if (
      updates.redmineUrl !== undefined ||
      updates.apiKey !== undefined ||
      updates.isDemoMode !== undefined
    ) {
      setTimeout(() => loadData(), 50);
    } else if (
      updates.operationalTrackerIds ||
      updates.tacticalTrackerIds ||
      updates.blockedCustomFieldId ||
      updates.strategicCustomFieldId ||
      updates.blockedCustomFieldValueTrigger
    ) {
      setIssues((prev) => prev.map((i) => processIssueWithConfig(i, updated)));
    }
  };

  // Complete onboarding
  const handleOnboardingComplete = async (updates: Partial<RedlevelsConfig>, user?: RedmineUser) => {
    const updated = {
      ...config,
      ...updates,
      isConfigured: true,
      hasSeenTour: false,
    };
    setConfig(updated);
    await saveConfig(updated);
    setShowOnboarding(false);

    if (user) {
      setCurrentUser(user);
      setConnectionHealth({
        status: 'connected',
        user,
        latencyMs: 50,
      });
    }

    setShowTour(true);
    loadData();
  };

  // Explore demo
  const handleExploreDemo = async () => {
    const updated: RedlevelsConfig = {
      ...config,
      ...DEMO_CONFIG_PRESET,
      hasSeenTour: false,
    };
    setConfig(updated);
    await saveConfig(updated);
    setShowOnboarding(false);
    setShowTour(true);
    loadData();
  };

  // Move issue (Kanban Drag & Drop) -> Requisito: PUT /issues/[id].json
  const handleMoveIssue = async (issueId: number, targetStatusId: number) => {
    const previousIssues = [...issues];
    const statusObj = statuses.find((s) => s.id === targetStatusId);

    // Optimistic UI update
    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id === issueId && statusObj) {
          return {
            ...iss,
            status: statusObj,
            updated_on: new Date().toISOString(),
          };
        }
        return iss;
      })
    );

    setPendingIssueIds((prev) => new Set(prev).add(issueId));

    try {
      const res = await client.updateIssue(issueId, { status_id: targetStatusId });
      if (!res.success) {
        // Rollback
        setIssues(previousIssues);
        alert(`Falha ao atualizar status no Redmine: ${res.error}`);
      } else if (res.data && res.data.status?.id !== targetStatusId) {
        // Redmine silently ignored because workflow didn't permit this transition
        setIssues(previousIssues);
        alert(
          `A transição para "${statusObj?.name}" não é permitida pelo fluxo de trabalho do seu perfil no Redmine.`
        );
      }
    } catch (e: any) {
      setIssues(previousIssues);
      alert(`Erro na requisição PUT ao Redmine: ${e.message}`);
    } finally {
      setPendingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
    }
  };

  // Update status with notes
  const handleUpdateStatus = async (issueId: number, statusId: number, notes?: string) => {
    const res = await client.updateIssue(issueId, { status_id: statusId, notes });
    if (res.success) {
      const statusObj = statuses.find((s) => s.id === statusId);
      setIssues((prev) =>
        prev.map((iss) => {
          if (iss.id === issueId) {
            const updated = {
              ...iss,
              status: statusObj || iss.status,
              updated_on: new Date().toISOString(),
            };
            if (notes && currentUser) {
              const newJournal = {
                id: Date.now(),
                user: { id: currentUser.id, name: `${currentUser.firstname} ${currentUser.lastname}` },
                created_on: new Date().toISOString(),
                notes,
              };
              updated.journals = [...(updated.journals || []), newJournal];
            }
            return updated;
          }
          return iss;
        })
      );

      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue((prev) => (prev ? { ...prev, status: statusObj || prev.status } : null));
      }
    } else {
      alert(`Não foi possível salvar alteração: ${res.error}`);
    }
  };

  // Toggle blocked
  const handleToggleBlocked = async (issueId: number, currentlyBlocked: boolean) => {
    if (!config.blockedCustomFieldId) {
      alert('Configure primeiro qual campo personalizado representa o Bloqueio na aba Configurações.');
      return;
    }

    const nextValue = currentlyBlocked ? 'Não' : (config.blockedCustomFieldValueTrigger || 'Sim');
    const res = await client.updateIssue(issueId, {
      custom_fields: [{ id: config.blockedCustomFieldId, value: nextValue }],
    });
    if (res.success) {
      setIssues((prev) =>
        prev.map((iss) => {
          if (iss.id === issueId) {
            const updatedFields = (iss.custom_fields || []).map((cf) =>
              cf.id === config.blockedCustomFieldId ? { ...cf, value: nextValue } : cf
            );
            return processIssueWithConfig({ ...iss, custom_fields: updatedFields }, config);
          }
          return iss;
        })
      );
      if (selectedIssue && selectedIssue.id === issueId) {
        setSelectedIssue((prev) => (prev ? { ...prev, is_blocked: !currentlyBlocked } : null));
      }
    } else {
      alert(`Falha ao alterar impedimento: ${res.error}`);
    }
  };

  // Reset sandbox
  const handleResetDemoData = async () => {
    if (confirm('Deseja restaurar todas as tarefas de demonstração para os dados originais?')) {
      const reset = await resetDemoIssues();
      setIssues(reset.map((i) => processIssueWithConfig(i, config)));
      alert('Dados de demonstração restaurados!');
    }
  };

  // User counters
  const currentUserName = currentUser ? `${currentUser.firstname} ${currentUser.lastname}`.trim() : '';
  const inboxCount = useMemo(() => {
    if (inboxIds.assigned.length > 0) return inboxIds.assigned.length;
    return issues.filter((i) => {
      const assigned = i.assigned_to?.name || '';
      return (
        assigned.toLowerCase().includes(currentUserName.toLowerCase()) ||
        assigned.toLowerCase().includes((currentUser?.login || '').toLowerCase())
      );
    }).length;
  }, [issues, inboxIds, currentUserName, currentUser]);

  const blockedCount = useMemo(() => {
    return issues.filter((i) => i.is_blocked).length;
  }, [issues]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        connectionHealth={connectionHealth}
        config={config}
        onRefresh={loadData}
        onOpenTour={() => setShowTour(true)}
        inboxCount={inboxCount}
        blockedCount={blockedCount}
        isRefreshing={isRefreshing}
      />

      {/* Permission Request Banner if host permission is missing */}
      {missingHostPermission && (
        <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              A extensão precisa de permissão do navegador para conectar ao Redmine em{' '}
              <strong>{config.redmineUrl}</strong>.
            </span>
          </div>
          <button
            onClick={async () => {
              const granted = await requestHostPermission(config.redmineUrl);
              if (granted) {
                setMissingHostPermission(false);
                loadData();
              }
            }}
            className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shrink-0 transition-colors"
          >
            Conceder Acesso
          </button>
        </div>
      )}

      <main
        className={`flex-1 w-full mx-auto py-5 transition-all ${
          currentTab === 'operacional' || currentTab === 'tatico'
            ? 'max-w-none px-3 sm:px-6 lg:px-8'
            : 'max-w-7xl px-3 sm:px-6'
        }`}
      >
        {loadError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-start justify-between gap-3 text-xs text-rose-200 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-300">Não foi possível carregar dados do Redmine</h4>
                <p className="mt-0.5 text-slate-300">{loadError}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Verifique se a URL e a API Key estão corretas na aba Configurações, ou clique em "Ativar Demo".
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCurrentTab('configuracao')}
                className="px-3 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-white font-semibold transition-colors"
              >
                Ajustar Config
              </button>
              <button
                onClick={handleExploreDemo}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
              >
                Ativar Demo
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="min-h-[480px] flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center shadow-lg shadow-rose-900/40">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white">Carregando Redlevels...</h3>
              <p className="text-xs text-slate-400 mt-1">
                Conectando ao Redmine e estruturando tarefas operacionais, táticas e estratégicas.
              </p>
            </div>
          </div>
        ) : (
          <>
            {currentTab === 'inbox' && (
              <InboxView
                issues={issues}
                inboxIds={inboxIds}
                currentUser={currentUser}
                statuses={statuses}
                onSelectIssue={setSelectedIssue}
                onUpdateStatus={handleUpdateStatus}
              />
            )}
            {currentTab === 'operacional' && (
              <KanbanOperacional
                issues={issues}
                statuses={statuses}
                projects={projects}
                trackers={trackers}
                operationalTrackerIds={config.operationalTrackerIds}
                statusMapping={config.operationalStatusMapping || config.statusMapping}
                pendingIssueIds={pendingIssueIds}
                columnOrder={config.operationalColumnOrder}
                onUpdateColumnOrder={(newOrder) =>
                  handleUpdateConfig({ operationalColumnOrder: newOrder })
                }
                onSelectIssue={setSelectedIssue}
                onMoveIssue={handleMoveIssue}
                isLoading={isRefreshing}
              />
            )}
            {currentTab === 'tatico' && (
              <KanbanTatico
                issues={issues}
                statuses={statuses}
                projects={projects}
                trackers={trackers}
                tacticalTrackerIds={config.tacticalTrackerIds}
                customFields={customFields}
                strategicCustomFieldId={config.strategicCustomFieldId}
                statusMapping={config.tacticalStatusMapping || config.statusMapping}
                pendingIssueIds={pendingIssueIds}
                columnOrder={config.tacticalColumnOrder}
                onUpdateColumnOrder={(newOrder) =>
                  handleUpdateConfig({ tacticalColumnOrder: newOrder })
                }
                onSelectIssue={setSelectedIssue}
                onMoveIssue={handleMoveIssue}
                isLoading={isRefreshing}
              />
            )}
            {currentTab === 'estrategico' && (
              <IniciativasEstrategicas
                issues={issues}
                projects={projects}
                statuses={statuses}
                customFields={customFields}
                tacticalTrackerIds={config.tacticalTrackerIds}
                operationalTrackerIds={config.operationalTrackerIds}
                strategicCustomFieldId={config.strategicCustomFieldId}
                onSelectIssue={setSelectedIssue}
                onUpdateStatus={handleUpdateStatus}
              />
            )}
            {currentTab === 'configuracao' && (
              <ConfiguracaoView
                config={config}
                trackers={trackers}
                customFields={customFields}
                statuses={statuses}
                currentUser={currentUser}
                onSaveConfig={handleUpdateConfig}
                onResetDemoData={handleResetDemoData}
              />
            )}
          </>
        )}
      </main>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
        onExploreDemo={handleExploreDemo}
      />

      {/* First-time Tour Modal */}
      <FirstTimeTour
        isOpen={showTour}
        onClose={() => {
          setShowTour(false);
          handleUpdateConfig({ hasSeenTour: true });
        }}
        onNavigateToTab={(tab) => {
          setCurrentTab(tab);
          handleUpdateConfig({ hasSeenTour: true });
        }}
      />

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        redmineUrl={config.redmineUrl}
        statuses={statuses}
        onUpdateStatus={handleUpdateStatus}
        onToggleBlocked={handleToggleBlocked}
        onSelectIssueById={(id) => {
          const found = issues.find((i) => i.id === id);
          if (found) setSelectedIssue(found);
        }}
      />
    </div>
  );
}
