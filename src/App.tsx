import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { OnboardingModal } from './components/OnboardingModal';
import { FirstTimeTour } from './components/FirstTimeTour';
import { IssueDetailModal } from './components/IssueDetailModal';
import { KanbanOperacional } from './components/KanbanOperacional';
import { KanbanTatico } from './components/KanbanTatico';
import { IniciativasEstrategicas } from './components/IniciativasEstrategicas';
import { InboxView } from './components/InboxView';
import { ConfiguracaoView } from './components/ConfiguracaoView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastHost, useToasts } from './components/ToastHost';
import { downloadCsv } from './services/csvExport';

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

import {
  SyncInfo,
  closedCutoffDate,
  maxUpdatedOn,
  mergeIncremental,
  watermarkToSince,
} from './services/incrementalSync';

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
  // Status IDs actually used by each tracker in Redmine (tracker id -> status ids)
  const [trackerStatusIds, setTrackerStatusIds] = useState<Record<number, number[]>>({});

  // Navigation state
  const [currentTab, setCurrentTab] = useState<'inbox' | 'operacional' | 'tatico' | 'estrategico' | 'configuracao'>('operacional');
  // Issues the active tab is displaying (filters applied); published by the tab, used by the CSV export
  const [visibleIssues, setVisibleIssues] = useState<RedmineIssue[]>([]);

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
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null);

  // Non-blocking notices (replace alert() in the Kanban move flow)
  const { toasts, pushToast, dismissToast } = useToasts();

  // Incremental sync bookkeeping (refs: changing them must not re-create loadData or re-render).
  // Newest `updated_on` the server has sent us; null means "no baseline, next sync must be full".
  const watermarkRef = useRef<string | null>(null);
  const currentUserRef = useRef<RedmineUser | undefined>(undefined);
  // Always the latest config, so loadData doesn't need the whole config object as a dependency.
  const configRef = useRef<RedlevelsConfig>(config);
  configRef.current = config;
  // Identifies the most recent load; results of superseded loads are discarded.
  const loadSeqRef = useRef(0);

  // Initialize Redmine Client
  const client = useMemo(() => {
    return new RedmineClient(config.redmineUrl, config.apiKey, config.isDemoMode);
  }, [config.redmineUrl, config.apiKey, config.isDemoMode]);

  // Only settings that change WHICH issues are downloaded force a full reload. Saving anything else
  // (teams, column order, theme...) used to re-create loadData and refetch everything from Redmine.
  const dataScopeKey = JSON.stringify([
    config.operationalTrackerIds,
    config.tacticalTrackerIds,
    config.loadAllIssueStatuses,
    config.closedLookbackDays,
    config.maxIssuesLimit,
  ]);

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

  /**
   * Loads data from Redmine.
   * - 'full' (default): everything, every time (first load, scope change, "Carga completa").
   * - 'incremental': only issues changed since the last load, merged by id. Falls back to a full
   *   load on any problem (no baseline, request error, too many changes).
   */
  const loadData = useCallback(async (mode: 'full' | 'incremental' = 'full') => {
    if (!configLoaded) return;
    const cfg = configRef.current;
    const seq = ++loadSeqRef.current;
    const isCurrent = () => seq === loadSeqRef.current;
    setIsRefreshing(true);
    setLoadError(null);

    try {
      const baseline = watermarkRef.current;
      const knownUser = currentUserRef.current;
      if (mode === 'incremental' && baseline && knownUser && !cfg.isDemoMode) {
        try {
          const since = watermarkToSince(baseline);
          const trackerIds = Array.from(
            new Set([...(cfg.operationalTrackerIds || []), ...(cfg.tacticalTrackerIds || [])])
          );
          const [changedRes, inboxRes] = await Promise.all([
            client.getIssuesSince(trackerIds, since, cfg.maxIssuesLimit),
            client.getInbox(knownUser),
          ]);
          if (!changedRes.success || !changedRes.data) {
            throw new Error(changedRes.error || 'Falha na sincronização incremental');
          }
          if (changedRes.truncated) throw new Error('Alterações demais para sincronização incremental');
          if (!inboxRes.success || !inboxRes.data) {
            throw new Error(inboxRes.error || 'Falha ao atualizar o Inbox');
          }
          if (!isCurrent()) return;

          const changed = changedRes.data;
          const inbox = inboxRes.data;
          const cutoff = closedCutoffDate(cfg);
          setInboxIds(inbox.ids);
          setIssues((prev) =>
            linkChildren(mergeIncremental(prev, changed, inbox.issues, { since, cutoff })).map((i) =>
              processIssueWithConfig(i, cfg)
            )
          );
          watermarkRef.current = maxUpdatedOn(changed, baseline);
          setSyncInfo({ at: new Date().toISOString(), mode: 'incremental', count: changed.length });
          setConnectionHealth((prev) => ({
            ...prev,
            status: 'connected',
            lastChecked: new Date().toISOString(),
          }));
          return;
        } catch (e) {
          console.warn('Sincronização incremental falhou; fazendo carga completa', e);
          if (!isCurrent()) return;
        }
      }

      // Full load: the old baseline is void until this load completes.
      watermarkRef.current = null;
      setConnectionHealth((prev) => ({ ...prev, status: 'connecting' }));

      // 1. Test Connection & get user
      const userRes = await client.testConnection();
      if (!isCurrent()) return;
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
      currentUserRef.current = activeUser;
      setCurrentUser(activeUser);
      setConnectionHealth({
        status: 'connected',
        user: activeUser,
        latencyMs: userRes.latencyMs,
        lastChecked: new Date().toISOString(),
      });
      setMissingHostPermission(false);

      const relevantTrackerIds = Array.from(
        new Set([
          ...(cfg.operationalTrackerIds || []),
          ...(cfg.tacticalTrackerIds || []),
        ])
      );

      // 2. Fetch Projects, Trackers, Statuses, Custom Fields, Issues, Inbox in parallel
      const [projRes, trackRes, statRes, cfRes, issRes, inboxRes] = await Promise.all([
        client.getProjects(),
        client.getTrackers(),
        client.getStatuses(),
        client.getCustomFields(),
        client.getWorkspaceIssues({
          trackerIds: relevantTrackerIds,
          loadAllStatuses: cfg.loadAllIssueStatuses,
          closedLookbackDays: cfg.closedLookbackDays,
          maxIssuesLimit: cfg.maxIssuesLimit,
        }),
        client.getInbox(activeUser),
      ]);
      if (!isCurrent()) return;

      if (projRes.success && projRes.data) {
        const sorted = [...projRes.data].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
        );
        setProjects(sorted);
      }
      if (trackRes.success && trackRes.data) setTrackers(trackRes.data);
      if (statRes.success && statRes.data) setStatuses(statRes.data);

      // Status mapping auto-suggest if user hasn't configured any
      let currentMapping = cfg.statusMapping;
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
      const processed = linked.map((i) => processIssueWithConfig(i, cfg));
      setIssues(processed);

      // Baseline for the next incremental sync. Only trusted if the workspace query itself succeeded.
      watermarkRef.current = issRes.success ? maxUpdatedOn(allIssues) : null;
      setSyncInfo({ at: new Date().toISOString(), mode: 'full', count: processed.length });
    } catch (e: any) {
      console.error('Erro ao carregar dados do Redmine', e);
      setConnectionHealth({
        status: 'error',
        errorMessage: e.message || 'Erro inesperado na sincronização',
      });
      setLoadError(e.message || 'Erro inesperado na sincronização');
    } finally {
      // A superseded load must not clear the spinner of the load that replaced it.
      if (isCurrent()) {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    }
  // dataScopeKey (not `config`): see the comment where it is defined.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, dataScopeKey, configLoaded]);

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

  // Discover each operational tracker's status set (so Kanbans never mix statuses across trackers)
  const operationalTrackerKey = (config.operationalTrackerIds || []).join(',');
  useEffect(() => {
    if (trackers.length === 0) return;
    const ids = config.operationalTrackerIds?.length
      ? config.operationalTrackerIds
      : trackers.map((t) => t.id);
    let cancelled = false;
    client
      .getTrackerStatusIds(ids)
      .then((map) => {
        if (!cancelled) setTrackerStatusIds(map);
      })
      .catch((e) => console.warn('Erro ao descobrir status por tracker:', e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, trackers, operationalTrackerKey]);

  // Handle configuration updates
  const handleUpdateConfig = async (updates: Partial<RedlevelsConfig>) => {
    const updated = { ...config, ...updates };
    setConfig(updated);
    await saveConfig(updated);
    if (updates.theme) {
      applyTheme(updates.theme);
    }

    // The settings form always sends the connection fields, so only reload when one really changed.
    if (
      (updates.redmineUrl !== undefined && updates.redmineUrl !== config.redmineUrl) ||
      (updates.apiKey !== undefined && updates.apiKey !== config.apiKey) ||
      (updates.isDemoMode !== undefined && updates.isDemoMode !== config.isDemoMode)
    ) {
      setTimeout(() => loadData(), 50);
    } else if (
      updates.operationalTrackerIds ||
      updates.tacticalTrackerIds ||
      updates.blockedCustomFieldId !== undefined ||
      updates.blockedCustomFieldIds !== undefined ||
      updates.strategicCustomFieldId !== undefined ||
      updates.blockedCustomFieldValueTrigger !== undefined
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

  // Background non-intrusive refresh to sync related issues, parents, and server hooks
  const refreshIssuesSilently = async () => {
    try {
      const relevantTrackerIds = Array.from(
        new Set([
          ...(config.operationalTrackerIds || []),
          ...(config.tacticalTrackerIds || []),
        ])
      );
      const issRes = await client.getWorkspaceIssues({
        trackerIds: relevantTrackerIds,
        loadAllStatuses: config.loadAllIssueStatuses,
        closedLookbackDays: config.closedLookbackDays,
        maxIssuesLimit: config.maxIssuesLimit,
      });
      if (issRes.success && issRes.data) {
        const linked = linkChildren(issRes.data);
        const processed = linked.map((i) => processIssueWithConfig(i, config));
        setIssues(processed);
      }
    } catch (e) {
      console.warn('Erro ao atualizar tarefas em segundo plano:', e);
    }
  };

  // Move issue (Kanban Drag & Drop) -> Requisito: PUT /issues/[id].json
  const handleMoveIssue = async (issueId: number, targetStatusId: number) => {
    const previousIssues = [...issues];
    const knownIssue = issues.find((iss) => iss.id === issueId);
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
      // Read the issue as it is on the server before writing: someone else may have changed it since
      // it was loaded, and the workflow may not allow the transition (allowed_statuses). If this read
      // fails we still try the write; Redmine remains the final judge.
      const check = await client.getIssueDetail(issueId);
      if (check.success && check.data) {
        const server = check.data;
        const changedByOthers = !!knownIssue && server.updated_on !== knownIssue.updated_on;
        const allowed = server.allowed_statuses;
        const forbidden =
          !!allowed &&
          allowed.length > 0 &&
          server.status?.id !== targetStatusId &&
          !allowed.some((s) => s.id === targetStatusId);

        if (changedByOthers || forbidden) {
          const fresh = processIssueWithConfig(server, config);
          setIssues((prev) => prev.map((iss) => (iss.id === issueId ? fresh : iss)));
          if (selectedIssue && selectedIssue.id === issueId) {
            setSelectedIssue(fresh);
          }
          pushToast({
            kind: 'warning',
            text: changedByOthers
              ? `A tarefa #${issueId} foi alterada no Redmine desde o último carregamento (agora em "${server.status?.name}"). Nada foi gravado; o quadro foi atualizado. Confira e mova novamente se ainda fizer sentido.`
              : `O fluxo de trabalho do Redmine não permite mover a tarefa #${issueId} de "${server.status?.name}" para "${statusObj?.name || targetStatusId}". Nada foi gravado.`,
          });
          return;
        }
      }

      const res = await client.updateIssue(issueId, { status_id: targetStatusId });

      if (res.data) {
        // Authoritative issue from Redmine
        const fresh = processIssueWithConfig(res.data, config);
        setIssues((prev) => prev.map((iss) => (iss.id === issueId ? fresh : iss)));
        if (selectedIssue && selectedIssue.id === issueId) {
          setSelectedIssue(fresh);
        }

        if (res.data.status?.id !== targetStatusId) {
          const target = statusObj?.name || targetStatusId;
          // PUT failed (e.g. HTTP 422, permission): show what Redmine said. PUT succeeded but the
          // status did not change: Redmine silently ignored it, which is what the workflow rules do.
          pushToast({
            kind: !res.success && res.error ? 'error' : 'warning',
            text:
              !res.success && res.error
                ? `Não foi possível mover para "${target}": ${res.error}. O status atual da tarefa permanece como "${res.data.status?.name}".`
                : `A transição para "${target}" não foi permitida pelas regras de fluxo de trabalho do Redmine. O status atual da tarefa permanece como "${res.data.status?.name}".`,
          });
        } else if (res.success) {
          refreshIssuesSilently();
        }
      } else if (!res.success) {
        // Rollback
        setIssues(previousIssues);
        pushToast({ kind: 'error', text: `Falha ao atualizar status no Redmine: ${res.error}` });
      }
    } catch (e: any) {
      setIssues(previousIssues);
      pushToast({ kind: 'error', text: `Erro na requisição PUT ao Redmine: ${e.message}` });
    } finally {
      setPendingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
    }
  };

  // Update status with notes -> Requisito: O Kanban e modal sempre devem refletir o status real do Redmine
  const handleUpdateStatus = async (issueId: number, statusId: number, notes?: string) => {
    const previousIssues = [...issues];
    const previousSelected = selectedIssue;
    const statusObj = statuses.find((s) => s.id === statusId);

    // Optimistic UI update
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
      setSelectedIssue((prev) =>
        prev
          ? {
              ...prev,
              status: statusObj || prev.status,
              journals:
                notes && currentUser
                  ? [
                      ...(prev.journals || []),
                      {
                        id: Date.now(),
                        user: { id: currentUser.id, name: `${currentUser.firstname} ${currentUser.lastname}` },
                        created_on: new Date().toISOString(),
                        notes,
                      },
                    ]
                  : prev.journals,
            }
          : null
      );
    }

    setPendingIssueIds((prev) => new Set(prev).add(issueId));

    try {
      const res = await client.updateIssue(issueId, { status_id: statusId, notes });

      if (res.data) {
        // Authoritative issue from Redmine
        const fresh = processIssueWithConfig(res.data, config);
        setIssues((prev) => prev.map((iss) => (iss.id === issueId ? fresh : iss)));
        if (selectedIssue && selectedIssue.id === issueId) {
          setSelectedIssue(fresh);
        }

        if (res.data.status?.id !== statusId) {
          const detailMsg = res.error ? ` (${res.error})` : '';
          alert(
            `A transição para "${statusObj?.name || statusId}" não foi permitida pelas regras de fluxo de trabalho do Redmine${detailMsg}. O status atual da tarefa permanece como "${res.data.status?.name}".`
          );
        } else if (res.success) {
          refreshIssuesSilently();
        }
      } else if (!res.success) {
        // Rollback
        setIssues(previousIssues);
        if (previousSelected && previousSelected.id === issueId) {
          setSelectedIssue(previousSelected);
        }
        alert(`Não foi possível salvar alteração no Redmine: ${res.error}`);
      } else {
        refreshIssuesSilently();
      }
    } catch (e: any) {
      setIssues(previousIssues);
      if (previousSelected && previousSelected.id === issueId) {
        setSelectedIssue(previousSelected);
      }
      alert(`Erro na requisição ao Redmine: ${e.message}`);
    } finally {
      setPendingIssueIds((prev) => {
        const next = new Set(prev);
        next.delete(issueId);
        return next;
      });
    }
  };

  // Select issue and fetch fresh details in background (so allowed_statuses, latest status & journals are always up to date)
  const handleSelectIssue = async (issue: RedmineIssue) => {
    setSelectedIssue(issue);
    try {
      const res = await client.getIssueDetail(issue.id);
      if (res.success && res.data) {
        const fresh = processIssueWithConfig(res.data, config);
        setSelectedIssue(fresh);
        setIssues((prev) => prev.map((i) => (i.id === issue.id ? fresh : i)));
      }
    } catch (e) {
      console.warn('Erro ao atualizar detalhes da tarefa:', e);
    }
  };

  const handleSelectIssueById = async (id: number) => {
    const found = issues.find((i) => i.id === id);
    if (found) {
      handleSelectIssue(found);
    } else {
      try {
        const res = await client.getIssueDetail(id);
        if (res.success && res.data) {
          const fresh = processIssueWithConfig(res.data, config);
          setSelectedIssue(fresh);
        }
      } catch (e) {
        console.warn('Erro ao buscar tarefa pai:', e);
      }
    }
  };

  // Toggle blocked
  const handleToggleBlocked = async (issueId: number, currentlyBlocked: boolean) => {
    const blockedIds = config.blockedCustomFieldIds && config.blockedCustomFieldIds.length > 0
      ? config.blockedCustomFieldIds
      : config.blockedCustomFieldId
        ? [config.blockedCustomFieldId]
        : [];

    if (blockedIds.length === 0) {
      alert('Configure primeiro qual campo personalizado representa o Bloqueio na aba Configurações.');
      return;
    }

    const currentIssue = issues.find((i) => i.id === issueId);
    const targetFieldId = currentIssue?.custom_fields?.find((cf) => blockedIds.includes(cf.id))?.id || blockedIds[0];

    const nextValue = currentlyBlocked ? 'Não' : (config.blockedCustomFieldValueTrigger || 'Sim');
    const res = await client.updateIssue(issueId, {
      custom_fields: [{ id: targetFieldId, value: nextValue }],
    });
    if (res.success) {
      setIssues((prev) =>
        prev.map((iss) => {
          if (iss.id === issueId) {
            const updatedFields = (iss.custom_fields || []).map((cf) =>
              cf.id === targetFieldId ? { ...cf, value: nextValue } : cf
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
        syncInfo={syncInfo}
        onOpenTour={() => setShowTour(true)}
        exportableCount={visibleIssues.length}
        onExportCsv={() => downloadCsv(visibleIssues, config, currentTab)}
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
          currentTab === 'operacional' || currentTab === 'tatico' || currentTab === 'configuracao'
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
                onSelectIssue={handleSelectIssue}
                onUpdateStatus={handleUpdateStatus}
                onVisibleIssuesChange={setVisibleIssues}
              />
            )}
            {currentTab === 'operacional' && (
              <KanbanOperacional
                issues={issues}
                statuses={statuses}
                projects={projects}
                trackers={trackers}
                operationalTrackerIds={config.operationalTrackerIds}
                trackerStatusIds={trackerStatusIds}
                statusMapping={config.operationalStatusMapping || config.statusMapping}
                pendingIssueIds={pendingIssueIds}
                columnOrder={config.operationalColumnOrder}
                onUpdateColumnOrder={(newOrder) =>
                  handleUpdateConfig({ operationalColumnOrder: newOrder })
                }
                onSelectIssue={handleSelectIssue}
                onMoveIssue={handleMoveIssue}
                isLoading={isRefreshing}
                onVisibleIssuesChange={setVisibleIssues}
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
                onSelectIssue={handleSelectIssue}
                onMoveIssue={handleMoveIssue}
                isLoading={isRefreshing}
                onVisibleIssuesChange={setVisibleIssues}
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
                onSelectIssue={handleSelectIssue}
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
      <ErrorBoundary
        fallbackTitle="Não foi possível exibir o detalhamento desta tarefa"
        onReset={() => setSelectedIssue(null)}
      >
        <IssueDetailModal
          issue={selectedIssue}
          isOpen={!!selectedIssue}
          onClose={() => setSelectedIssue(null)}
          redmineUrl={config.redmineUrl}
          statuses={statuses}
          onUpdateStatus={handleUpdateStatus}
          onToggleBlocked={handleToggleBlocked}
          onSelectIssueById={handleSelectIssueById}
        />
      </ErrorBoundary>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
