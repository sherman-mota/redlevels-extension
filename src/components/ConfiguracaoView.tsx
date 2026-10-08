import React, { useState, useMemo } from 'react';
import {
  Settings,
  Globe,
  KeyRound,
  Layers,
  Kanban,
  GitBranch,
  ShieldAlert,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  Download,
  Upload,
  Search,
  X,
  Filter,
} from 'lucide-react';
import {
  RedlevelsConfig,
  RedmineTracker,
  RedmineCustomFieldDef,
  RedmineStatus,
  RedmineUser,
  KanbanColumnKey,
  ThemeId,
  StatusMapping,
} from '../types/redmine';
import { THEMES, applyTheme } from '../styles/themes';
import { RedmineClient, requestHostPermission, normalizeRedmineUrl } from '../services/redmineApi';
import { normalizeStatusMapping } from '../services/storage';
import { buildColumns, COLUMN_META } from './KanbanBoard';

interface ConfiguracaoViewProps {
  config: RedlevelsConfig;
  trackers: RedmineTracker[];
  customFields: RedmineCustomFieldDef[];
  statuses: RedmineStatus[];
  currentUser?: RedmineUser;
  onSaveConfig: (updated: Partial<RedlevelsConfig>) => Promise<void>;
  onResetDemoData: () => void;
}

export const ConfiguracaoView: React.FC<ConfiguracaoViewProps> = ({
  config,
  trackers,
  customFields,
  statuses,
  onSaveConfig,
  onResetDemoData,
}) => {
  // Local form state
  const [url, setUrl] = useState(config.redmineUrl);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [isDemoMode, setIsDemoMode] = useState(config.isDemoMode);
  const [operationalTrackerIds, setOperationalTrackerIds] = useState<number[]>(config.operationalTrackerIds);
  const [tacticalTrackerIds, setTacticalTrackerIds] = useState<number[]>(config.tacticalTrackerIds);
  const [strategicCustomFieldId, setStrategicCustomFieldId] = useState<number | undefined>(config.strategicCustomFieldId);
  const [blockedCustomFieldId, setBlockedCustomFieldId] = useState<number | undefined>(config.blockedCustomFieldId);
  const [blockedCustomFieldValueTrigger, setBlockedCustomFieldValueTrigger] = useState<string>(config.blockedCustomFieldValueTrigger || 'Sim');

  // Status mapping separated by operational and tactical
  const [operationalStatusMapping, setOperationalStatusMapping] = useState(
    config.operationalStatusMapping
      ? normalizeStatusMapping(config.operationalStatusMapping)
      : normalizeStatusMapping(config.statusMapping)
  );
  const [tacticalStatusMapping, setTacticalStatusMapping] = useState(
    config.tacticalStatusMapping
      ? normalizeStatusMapping(config.tacticalStatusMapping)
      : normalizeStatusMapping(config.statusMapping)
  );
  const [activeMappingTab, setActiveMappingTab] = useState<'operacional' | 'tatico'>('operacional');

  const [theme, setTheme] = useState<ThemeId>(config.theme);
  const [operationalColumnOrder, setOperationalColumnOrder] = useState<number[]>(config.operationalColumnOrder || []);
  const [tacticalColumnOrder, setTacticalColumnOrder] = useState<number[]>(config.tacticalColumnOrder || []);
  const [activeOrderTab, setActiveOrderTab] = useState<'operacional' | 'tatico'>('operacional');

  // Status & testing
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Section 6: Column filters state (Search and Filter Mode per column)
  const [columnSearch, setColumnSearch] = useState<Record<KanbanColumnKey, string>>({
    backlog: '',
    analysis: '',
    in_progress: '',
    done: '',
  });

  const [columnFilterMode, setColumnFilterMode] = useState<
    Record<KanbanColumnKey, 'all' | 'selected' | 'unmapped'>
  >({
    backlog: 'all',
    analysis: 'all',
    in_progress: 'all',
    done: 'all',
  });

  // Derived active mapping based on active subtab (operacional or tático)
  const activeMapping = useMemo(
    () => (activeMappingTab === 'operacional' ? operationalStatusMapping : tacticalStatusMapping),
    [activeMappingTab, operationalStatusMapping, tacticalStatusMapping]
  );

  // Set of all status IDs currently mapped in any column of the active level
  const allMappedInActiveLevel = useMemo(() => {
    return new Set<number>([
      ...(activeMapping.backlog || []),
      ...(activeMapping.analysis || []),
      ...(activeMapping.in_progress || []),
      ...(activeMapping.done || []),
    ]);
  }, [activeMapping]);

  // Map of status ID -> column key in the active level
  const statusToColumnMap = useMemo(() => {
    const map = new Map<number, KanbanColumnKey>();
    (['backlog', 'analysis', 'in_progress', 'done'] as KanbanColumnKey[]).forEach((colKey) => {
      (activeMapping[colKey] || []).forEach((id) => map.set(id, colKey));
    });
    return map;
  }, [activeMapping]);

  // Derived columns for Operational Kanban based on operationalStatusMapping & operationalColumnOrder
  const opConfigCols = useMemo(
    () => buildColumns(statuses, operationalStatusMapping, [], operationalColumnOrder),
    [statuses, operationalStatusMapping, operationalColumnOrder]
  );

  // Derived columns for Tactical Kanban based on tacticalStatusMapping & tacticalColumnOrder
  const tacConfigCols = useMemo(
    () => buildColumns(statuses, tacticalStatusMapping, [], tacticalColumnOrder),
    [statuses, tacticalStatusMapping, tacticalColumnOrder]
  );

  const moveOperationalColumn = (statusId: number, direction: 'up' | 'down') => {
    const currentList = opConfigCols.map((c) => c.status.id);
    const idx = currentList.indexOf(statusId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;
    const nextList = [...currentList];
    const temp = nextList[idx];
    nextList[idx] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setOperationalColumnOrder(nextList);
  };

  const moveTacticalColumn = (statusId: number, direction: 'up' | 'down') => {
    const currentList = tacConfigCols.map((c) => c.status.id);
    const idx = currentList.indexOf(statusId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= currentList.length) return;
    const nextList = [...currentList];
    const temp = nextList[idx];
    nextList[idx] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setTacticalColumnOrder(nextList);
  };

  // Section 2 & 3: Tracker filters state
  const [opTrackerSearch, setOpTrackerSearch] = useState('');
  const [opTrackerFilterMode, setOpTrackerFilterMode] = useState<'all' | 'selected' | 'unmapped'>('all');

  const [tacTrackerSearch, setTacTrackerSearch] = useState('');
  const [tacTrackerFilterMode, setTacTrackerFilterMode] = useState<'all' | 'selected' | 'unmapped'>('all');

  // Ordenação alfabética dos trackers (Itens 2 e 3)
  const sortedTrackers = useMemo(() => {
    return [...trackers].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [trackers]);

  // Ordenação alfabética dos campos personalizados (Itens 4 e 5)
  const sortedCustomFields = useMemo(() => {
    return [...customFields].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    );
  }, [customFields]);

  // Handle Tracker Toggle
  const toggleOperationalTracker = (id: number) => {
    setOperationalTrackerIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleTacticalTracker = (id: number) => {
    setTacticalTrackerIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  // Handle Status Mapping Toggle per operational or tactical
  const toggleStatusForColumn = (column: KanbanColumnKey, statusId: number) => {
    const updateMapping = (prev: StatusMapping): StatusMapping => {
      const isCurrentlyInThisCol = (prev[column] || []).includes(statusId);
      if (isCurrentlyInThisCol) {
        // Deselect from this column
        return {
          ...prev,
          [column]: (prev[column] || []).filter((id) => id !== statusId),
        };
      } else {
        // Select in this column and remove from any other column in this level
        const next: StatusMapping = {
          backlog: (prev.backlog || []).filter((id) => id !== statusId),
          analysis: (prev.analysis || []).filter((id) => id !== statusId),
          in_progress: (prev.in_progress || []).filter((id) => id !== statusId),
          done: (prev.done || []).filter((id) => id !== statusId),
        };
        next[column].push(statusId);
        return next;
      }
    };

    if (activeMappingTab === 'operacional') {
      setOperationalStatusMapping(updateMapping);
    } else {
      setTacticalStatusMapping(updateMapping);
    }
  };

  // Clear all statuses from a specific column
  const clearColumnMapping = (column: KanbanColumnKey) => {
    if (activeMappingTab === 'operacional') {
      setOperationalStatusMapping((prev) => ({
        ...prev,
        [column]: [],
      }));
    } else {
      setTacticalStatusMapping((prev) => ({
        ...prev,
        [column]: [],
      }));
    }
  };

  // Export configuration as JSON
  const handleExportConfig = () => {
    const clean = normalizeRedmineUrl(url);
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      config: {
        redmineUrl: clean,
        apiKey: apiKey.trim(),
        isDemoMode,
        isConfigured: true,
        operationalTrackerIds,
        tacticalTrackerIds,
        strategicCustomFieldId,
        blockedCustomFieldId,
        blockedCustomFieldValueTrigger,
        statusMapping: operationalStatusMapping,
        operationalStatusMapping,
        tacticalStatusMapping,
        theme,
        operationalColumnOrder,
        tacticalColumnOrder,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `redlevels-config-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  // Import configuration from JSON
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setImportNotice(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const imported: Partial<RedlevelsConfig> = parsed.config ? parsed.config : parsed;

      if (!imported || typeof imported !== 'object') {
        throw new Error('Formato de arquivo JSON inválido.');
      }

      if (imported.redmineUrl !== undefined) setUrl(imported.redmineUrl);
      if (imported.apiKey !== undefined) setApiKey(imported.apiKey);
      if (imported.isDemoMode !== undefined) setIsDemoMode(imported.isDemoMode);
      if (imported.operationalTrackerIds !== undefined) setOperationalTrackerIds(imported.operationalTrackerIds);
      if (imported.tacticalTrackerIds !== undefined) setTacticalTrackerIds(imported.tacticalTrackerIds);
      if (imported.strategicCustomFieldId !== undefined) setStrategicCustomFieldId(imported.strategicCustomFieldId);
      if (imported.blockedCustomFieldId !== undefined) setBlockedCustomFieldId(imported.blockedCustomFieldId);
      if (imported.blockedCustomFieldValueTrigger !== undefined) {
        setBlockedCustomFieldValueTrigger(imported.blockedCustomFieldValueTrigger);
      }

      const normOp = normalizeStatusMapping(imported.operationalStatusMapping || imported.statusMapping);
      const normTac = normalizeStatusMapping(imported.tacticalStatusMapping || imported.statusMapping);
      setOperationalStatusMapping(normOp);
      setTacticalStatusMapping(normTac);

      if (imported.theme !== undefined) {
        setTheme(imported.theme);
        applyTheme(imported.theme);
      }
      if (imported.operationalColumnOrder !== undefined) setOperationalColumnOrder(imported.operationalColumnOrder);
      if (imported.tacticalColumnOrder !== undefined) setTacticalColumnOrder(imported.tacticalColumnOrder);

      await onSaveConfig({
        ...imported,
        statusMapping: normOp,
        operationalStatusMapping: normOp,
        tacticalStatusMapping: normTac,
      });

      setImportNotice({
        type: 'success',
        message: `Configurações importadas com sucesso do arquivo "${file.name}"!`,
      });
      setTimeout(() => setImportNotice(null), 4000);
    } catch (err: any) {
      setImportNotice({
        type: 'error',
        message: err.message || 'Falha ao processar arquivo de configuração.',
      });
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    const clean = normalizeRedmineUrl(url);
    if (!isDemoMode && clean) {
      // Must be called directly in gesture
      await requestHostPermission(clean);
    }

    try {
      const client = new RedmineClient(clean, apiKey, isDemoMode);
      const res = await client.testConnection();

      if (res.success && res.data) {
        setTestResult({
          success: true,
          message: `Conectado como ${res.data.firstname} ${res.data.lastname} (${res.data.login})`,
          latency: res.latencyMs,
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Falha ao conectar ao servidor Redmine',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erro inesperado',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Submit and save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    const clean = normalizeRedmineUrl(url);
    if (!isDemoMode && clean) {
      await requestHostPermission(clean);
    }

    try {
      await onSaveConfig({
        redmineUrl: clean,
        apiKey: apiKey.trim(),
        isDemoMode,
        isConfigured: true,
        operationalTrackerIds,
        tacticalTrackerIds,
        strategicCustomFieldId,
        blockedCustomFieldId,
        blockedCustomFieldValueTrigger,
        statusMapping: operationalStatusMapping,
        operationalStatusMapping,
        tacticalStatusMapping,
        theme,
        operationalColumnOrder,
        tacticalColumnOrder,
      });

      applyTheme(theme);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const cleanUrl = normalizeRedmineUrl(url);
  const myAccountLink = cleanUrl ? `${cleanUrl}/my/account` : 'https://[IP_ADDRESS]/my/account';

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Hidden file input for config import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-rose-500" />
            <span>Configurações do Redlevels</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Defina as configurações necessárias para o funcionamento do Redlevels.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Export button */}
          <button
            type="button"
            onClick={handleExportConfig}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700/80 transition-all shadow-sm"
            title="Exportar todas as configurações em arquivo JSON"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Exportar</span>
          </button>

          {/* Import button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700/80 transition-all shadow-sm"
            title="Importar configurações de arquivo JSON"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            <span>Importar</span>
          </button>

          {/* Save button */}
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs shadow-md shadow-rose-900/30 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{savedSuccess ? 'Configurações Salvas!' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* Import Notification */}
      {importNotice && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${importNotice.type === 'success'
            ? 'bg-emerald-950/80 border-emerald-700/80 text-emerald-200'
            : 'bg-rose-950/80 border-rose-700/80 text-rose-200'
            }`}
        >
          {importNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{importNotice.message}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configurações salvas e aplicadas com sucesso em toda a interface!</span>
        </div>
      )}

      {/* Requisito 1: URL da aplicação e API Key */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
          <Globe className="w-4 h-4" />
          <span>1. Conexão Redmine & Credenciais de Acesso</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              URL da Aplicação Redmine
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://redmine.suaempresa.com"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-400" />
              Chave de API (api_key)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Token de 40 caracteres..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono"
            />
          </div>
        </div>

        {/* Note requirement */}
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1">
          <p>
            A api key poderá ser gerada utilizando o link{' '}
            <span className="font-mono text-rose-300 bg-rose-950/60 px-1 py-0.5 rounded border border-rose-900/60 select-all">
              {myAccountLink}
            </span>
            .
          </p>
          <p className="text-[11px] text-slate-400">
            Na página "Minha Conta", na barra lateral à direita, clique em <strong>Exibir</strong> na seção <em>Chave de acesso à API</em>.
          </p>
        </div>

        {/* Mode & Connection test bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-800/80">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
            <input
              type="checkbox"
              checked={isDemoMode}
              onChange={(e) => setIsDemoMode(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-700 bg-slate-950 cursor-pointer"
            />
            <span>Operar em <strong>Modo Sandbox Demonstrativo</strong> (dados simulados ricos)</span>
          </label>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-black text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-black" />}
            <span>Testar Conexão</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${testResult.success
              ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
              }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <span className="font-semibold">{testResult.message}</span>
              {testResult.latency && (
                <span className="ml-2 font-mono text-[11px] opacity-80">
                  ({testResult.latency}ms)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Requisito 2 & 3: Tipos de tarefa no nível operacional e tático */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nível Operacional */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
                  <Kanban className="w-4 h-4" />
                  <span>2. Tipos de Tarefas do Nível Operacional</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quais tipos de tarefas alimentam o <strong>Kanban Operacional</strong>
                </p>
              </div>
              {operationalTrackerIds.length > 0 ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-rose-950/60 border-rose-800 text-rose-300">
                  {operationalTrackerIds.length}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
                  0
                </span>
              )}
            </div>

            {/* Tracker Filter 1: Search */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={opTrackerSearch}
                onChange={(e) => setOpTrackerSearch(e.target.value)}
                placeholder="Filtrar trackers operacionais..."
                className="w-full pl-7 pr-6 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
              {opTrackerSearch && (
                <button
                  type="button"
                  onClick={() => setOpTrackerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Limpar busca"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Tracker Filter 2: Mode toggle pills */}
            <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setOpTrackerFilterMode('all')}
                className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${opTrackerFilterMode === 'all'
                  ? 'bg-slate-800 text-blue font-semibold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                  }`}
              >
                Todos ({trackers.length})
              </button>
              <button
                type="button"
                onClick={() => setOpTrackerFilterMode('selected')}
                className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${opTrackerFilterMode === 'selected'
                  ? 'bg-rose-950 border border-rose-700/80 text-rose-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                  }`}
              >
                Selecionados ({operationalTrackerIds.length})
              </button>
              <button
                type="button"
                onClick={() => setOpTrackerFilterMode('unmapped')}
                className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${opTrackerFilterMode === 'unmapped'
                  ? 'bg-amber-950 border border-amber-700/80 text-amber-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                  }`}
              >
                Livres ({trackers.filter((t) => !operationalTrackerIds.includes(t.id) && !tacticalTrackerIds.includes(t.id)).length})
              </button>
            </div>

            {/* Trackers list */}
            <div className="space-y-1.5 pt-1 max-h-56 overflow-y-auto pr-0.5">
              {trackers.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-2">Conecte-se ao Redmine para carregar a lista de trackers.</p>
              ) : (() => {
                const filtered = sortedTrackers.filter((t) => {
                  const isSelected = operationalTrackerIds.includes(t.id);
                  const isUnmapped = !operationalTrackerIds.includes(t.id) && !tacticalTrackerIds.includes(t.id);

                  if (opTrackerFilterMode === 'selected' && !isSelected) return false;
                  if (opTrackerFilterMode === 'unmapped' && !isUnmapped) return false;

                  if (opTrackerSearch.trim()) {
                    const query = opTrackerSearch.trim().toLowerCase();
                    const matchName = t.name.toLowerCase().includes(query);
                    const matchId = String(t.id).includes(query);
                    return matchName || matchId;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-3 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
                      <p className="text-[11px] text-slate-500 italic">Nenhum tracker encontrado para o filtro.</p>
                      {(opTrackerSearch || opTrackerFilterMode !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpTrackerSearch('');
                            setOpTrackerFilterMode('all');
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 underline"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  );
                }

                return filtered.map((t) => {
                  const isChecked = operationalTrackerIds.includes(t.id);
                  const isChosenInTac = tacticalTrackerIds.includes(t.id);

                  return (
                    <label
                      key={t.id}
                      onClick={() => toggleOperationalTracker(t.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-colors ${isChecked
                        ? 'bg-rose-950/40 border-rose-800 text-blue'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => { }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-rose-500 border-slate-700 bg-slate-950 cursor-pointer shrink-0"
                        />
                        <span className="font-medium truncate">{t.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isChecked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-500/20 text-blue-300 border border-rose-500/40">
                            ✓ Operacional
                          </span>
                        )}
                        {isChosenInTac && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-950/80 text-purple-300 border border-purple-800/80">
                            em: Tático
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500">ID #{t.id}</span>
                      </div>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          {/* Footer */}
          {operationalTrackerIds.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">
                {operationalTrackerIds.length} {operationalTrackerIds.length === 1 ? 'tracker selecionado' : 'trackers selecionados'}
              </span>
              <button
                type="button"
                onClick={() => setOperationalTrackerIds([])}
                className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                title="Desmarcar todos os trackers operacionais"
              >
                Desmarcar todos
              </button>
            </div>
          )}
        </div>

        {/* Nível Tático */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-purple-400">
                  <Layers className="w-4 h-4" />
                  <span>3. Tipos de Tarefas do Nível Tático</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quais tipos de tarefas alimentam o <strong>Kanban Tático e Épicos</strong>
                </p>
              </div>
              {tacticalTrackerIds.length > 0 ? (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-purple-950/60 border-purple-800 text-purple-300">
                  {tacticalTrackerIds.length}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
                  0
                </span>
              )}
            </div>

            {/* Tracker Filter 1: Search */}
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={tacTrackerSearch}
                onChange={(e) => setTacTrackerSearch(e.target.value)}
                placeholder="Filtrar trackers táticos..."
                className="w-full pl-7 pr-6 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
              />
              {tacTrackerSearch && (
                <button
                  type="button"
                  onClick={() => setTacTrackerSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Limpar busca"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Tracker Filter 2: Mode toggle pills */}
            <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setTacTrackerFilterMode('all')}
                className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${tacTrackerFilterMode === 'all'
                  ? 'bg-slate-800 text-blue font-semibold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                  }`}
              >
                Todos ({trackers.length})
              </button>
              <button
                type="button"
                onClick={() => setTacTrackerFilterMode('selected')}
                className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${tacTrackerFilterMode === 'selected'
                  ? 'bg-purple-950 border border-purple-700/80 text-purple-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                  }`}
              >
                Selecionados ({tacticalTrackerIds.length})
              </button>
              <button
                type="button"
                onClick={() => setTacTrackerFilterMode('unmapped')}
                className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${tacTrackerFilterMode === 'unmapped'
                  ? 'bg-amber-950 border border-amber-700/80 text-amber-200 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-950/60 border border-slate-800/80'
                  }`}
              >
                Livres ({trackers.filter((t) => !operationalTrackerIds.includes(t.id) && !tacticalTrackerIds.includes(t.id)).length})
              </button>
            </div>

            {/* Trackers list */}
            <div className="space-y-1.5 pt-1 max-h-56 overflow-y-auto pr-0.5">
              {trackers.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-2">Conecte-se ao Redmine para carregar a lista de trackers.</p>
              ) : (() => {
                const filtered = sortedTrackers.filter((t) => {
                  const isSelected = tacticalTrackerIds.includes(t.id);
                  const isUnmapped = !operationalTrackerIds.includes(t.id) && !tacticalTrackerIds.includes(t.id);

                  if (tacTrackerFilterMode === 'selected' && !isSelected) return false;
                  if (tacTrackerFilterMode === 'unmapped' && !isUnmapped) return false;

                  if (tacTrackerSearch.trim()) {
                    const query = tacTrackerSearch.trim().toLowerCase();
                    const matchName = t.name.toLowerCase().includes(query);
                    const matchId = String(t.id).includes(query);
                    return matchName || matchId;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-3 text-center rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
                      <p className="text-[11px] text-slate-500 italic">Nenhum tracker encontrado para o filtro.</p>
                      {(tacTrackerSearch || tacTrackerFilterMode !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setTacTrackerSearch('');
                            setTacTrackerFilterMode('all');
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300 underline"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  );
                }

                return filtered.map((t) => {
                  const isChecked = tacticalTrackerIds.includes(t.id);
                  const isChosenInOp = operationalTrackerIds.includes(t.id);

                  return (
                    <label
                      key={t.id}
                      onClick={() => toggleTacticalTracker(t.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-colors ${isChecked
                        ? 'bg-purple-950/40 border-purple-800 text-blue'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => { }}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-700 bg-slate-950 cursor-pointer shrink-0"
                        />
                        <span className="font-medium truncate">{t.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isChecked && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            ✓ Tático
                          </span>
                        )}
                        {isChosenInOp && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                            em: Operacional
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500">ID #{t.id}</span>
                      </div>
                    </label>
                  );
                });
              })()}
            </div>
          </div>

          {/* Footer */}
          {tacticalTrackerIds.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">
                {tacticalTrackerIds.length} {tacticalTrackerIds.length === 1 ? 'tracker selecionado' : 'trackers selecionados'}
              </span>
              <button
                type="button"
                onClick={() => setTacticalTrackerIds([])}
                className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
                title="Desmarcar todos os trackers táticos"
              >
                Desmarcar todos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Requisito 4 & 5: Custom Fields de Iniciativa Estratégica e Bloqueio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Custom Field Iniciativa Estratégica */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
              <GitBranch className="w-4 h-4" />
              <span>4. Campo de Iniciativa Estratégica</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Qual campo personalizado da tarefa tática representa a iniciativa estratégica
            </p>
          </div>

          <select
            value={strategicCustomFieldId || ''}
            onChange={(e) =>
              setStrategicCustomFieldId(e.target.value ? Number(e.target.value) : undefined)
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-rose-500"
          >
            <option value="">Nenhum campo selecionado</option>
            {sortedCustomFields.map((cf) => (
              <option key={cf.id} value={cf.id}>
                {cf.name} (ID #{cf.id})
              </option>
            ))}
          </select>
        </div>

        {/* Custom Field Bloqueio */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3.5">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
              <span>5. Campo de Bloqueio (Item Pausado)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Qual campo personalizado dos tipos de tarefa representa um impedimento
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={blockedCustomFieldId || ''}
              onChange={(e) =>
                setBlockedCustomFieldId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-rose-500"
            >
              <option value="">Nenhum campo selecionado</option>
              {sortedCustomFields.map((cf) => (
                <option key={cf.id} value={cf.id}>
                  {cf.name} (ID #{cf.id})
                </option>
              ))}
            </select>

            <input
              type="text"
              value={blockedCustomFieldValueTrigger}
              onChange={(e) => setBlockedCustomFieldValueTrigger(e.target.value)}
              placeholder="Valor ativador (ex: Sim, 1, true)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Requisito 6: Mapeador do status no Redmine com colunas do Kanban */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
              <Kanban className="w-4 h-4" />
              <span>6. Mapeador de Status do Redmine para Colunas do Kanban</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mapeie quais status do Redmine correspondem a cada estágio do fluxo Kanban: <strong>Backlog, Em Análise, Em Progresso, Concluído</strong> por tipo de tarefa.
            </p>
          </div>

          {/* Sub-tabs selector: Operacional vs Tático */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveMappingTab('operacional')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeMappingTab === 'operacional'
                ? 'bg-rose-500 text-blue shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Nível Operacional
            </button>
            <button
              type="button"
              onClick={() => setActiveMappingTab('tatico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeMappingTab === 'tatico'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Nível Tático
            </button>
          </div>
        </div>

        {/* Informative indicator of active mapping level */}
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <span>Configurando fluxo para:</span>
          <span className={`font-semibold px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider ${activeMappingTab === 'operacional'
            ? 'bg-rose-950/50 border-rose-800 text-blue'
            : 'bg-purple-950/50 border-purple-800 text-black'
            }`}>
            {activeMappingTab === 'operacional' ? 'Tarefas Operacionais' : 'Tarefas Táticas'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {(
            [
              { key: 'backlog' as const, label: 'Backlog', desc: 'Demandas novas e não priorizadas', chipColor: 'text-slate-300' },
              { key: 'analysis' as const, label: 'Em Análise', desc: 'Refinamento ou análise técnica', chipColor: 'text-blue-300' },
              { key: 'in_progress' as const, label: 'Em Andamento', desc: 'Em desenvolvimento ou execução', chipColor: 'text-amber-300' },
              { key: 'done' as const, label: 'Concluído', desc: 'Finalizadas ou fechadas', chipColor: 'text-emerald-300' },
            ]
          ).map((col) => {
            const mappedIds = activeMapping[col.key] || [];
            const search = columnSearch[col.key]?.trim() || '';
            const mode = columnFilterMode[col.key] || 'all';
            const unmappedCount = statuses.filter((s) => !allMappedInActiveLevel.has(s.id)).length;

            const filteredStatuses = statuses.filter((s) => {
              const isChecked = mappedIds.includes(s.id);
              const isUnmapped = !allMappedInActiveLevel.has(s.id);

              if (mode === 'selected' && !isChecked) return false;
              if (mode === 'unmapped' && !isUnmapped) return false;

              if (search) {
                const matchName = s.name.toLowerCase().includes(search.toLowerCase());
                const matchId = String(s.id).includes(search);
                return matchName || matchId;
              }

              return true;
            });

            return (
              <div
                key={col.key}
                className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-blue uppercase tracking-wider flex items-center gap-1.5">
                        <span>{col.label}</span>
                      </h4>
                      <p className="text-[10px] text-slate-400">{col.desc}</p>
                    </div>
                    {mappedIds.length > 0 ? (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${activeMappingTab === 'operacional'
                        ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                        : 'bg-purple-950/60 border-purple-800 text-purple-300'
                        }`}>
                        {mappedIds.length}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
                        0
                      </span>
                    )}
                  </div>

                  {/* Filter 1: Search status input */}
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) =>
                        setColumnSearch((prev) => ({ ...prev, [col.key]: e.target.value }))
                      }
                      placeholder="Filtrar status..."
                      className="w-full pl-7 pr-6 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() =>
                          setColumnSearch((prev) => ({ ...prev, [col.key]: '' }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        title="Limpar busca"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter 2: Mode toggle pills (Todos, Mapeados, Livres) */}
                  <div className="flex items-center gap-1 text-[10px] overflow-x-auto pb-0.5">
                    <button
                      type="button"
                      onClick={() => setColumnFilterMode((prev) => ({ ...prev, [col.key]: 'all' }))}
                      className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${mode === 'all'
                        ? 'bg-slate-800 text-blue font-semibold'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800/80'
                        }`}
                    >
                      Todos ({statuses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnFilterMode((prev) => ({ ...prev, [col.key]: 'selected' }))}
                      className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${mode === 'selected'
                        ? activeMappingTab === 'operacional'
                          ? 'bg-rose-950 border border-rose-700/80 text-rose-200 font-semibold'
                          : 'bg-purple-950 border border-purple-700/80 text-purple-200 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800/80'
                        }`}
                    >
                      Mapeados ({mappedIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setColumnFilterMode((prev) => ({ ...prev, [col.key]: 'unmapped' }))}
                      className={`px-2 py-0.5 rounded-md transition-all shrink-0 ${mode === 'unmapped'
                        ? 'bg-amber-950 border border-amber-700/80 text-amber-200 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-900/60 border border-slate-800/80'
                        }`}
                    >
                      Livres ({unmappedCount})
                    </button>
                  </div>

                  {/* Statuses Checklist */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5 pt-0.5">
                    {filteredStatuses.length === 0 ? (
                      <div className="p-3 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-1">
                        <p className="text-[11px] text-slate-500 italic">
                          Nenhum status encontrado para o filtro.
                        </p>
                        {(search || mode !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setColumnSearch((prev) => ({ ...prev, [col.key]: '' }));
                              setColumnFilterMode((prev) => ({ ...prev, [col.key]: 'all' }));
                            }}
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                          >
                            Limpar filtros
                          </button>
                        )}
                      </div>
                    ) : (
                      filteredStatuses.map((s) => {
                        const isChecked = mappedIds.includes(s.id);
                        const otherCol = !isChecked ? statusToColumnMap.get(s.id) : undefined;
                        const otherColMeta = otherCol ? COLUMN_META[otherCol] : undefined;

                        return (
                          <label
                            key={s.id}
                            onClick={() => toggleStatusForColumn(col.key, s.id)}
                            className={`p-2 rounded-lg border cursor-pointer flex items-center justify-between gap-2 text-xs transition-colors ${isChecked
                              ? activeMappingTab === 'operacional'
                                ? 'bg-rose-950/40 border-rose-800 text-blue-200'
                                : 'bg-purple-950/40 border-purple-800 text-purple-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => { }}
                                className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 border-slate-700 bg-slate-950 cursor-pointer shrink-0"
                              />
                              <span className="truncate">{s.name}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {otherColMeta && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60">
                                  em: {otherColMeta.label}
                                </span>
                              )}
                              {s.is_closed && (
                                <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800 text-slate-500">
                                  fechado
                                </span>
                              )}
                              <span className="font-mono text-[9px] text-slate-500">#{s.id}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Card Footer: Quick clear column */}
                {mappedIds.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">
                      {mappedIds.length} {mappedIds.length === 1 ? 'mapeado' : 'mapeados'}
                    </span>
                    <button
                      type="button"
                      onClick={() => clearColumnMapping(col.key)}
                      className="text-rose-400 hover:text-rose-300 font-medium transition-colors"
                      title="Remover todos os status desta coluna"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. Ordenação das Colunas dos Kanbans (Operacional e Tático) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
              <ListOrdered className="w-4 h-4" />
              <span>7. Ordenação das Colunas dos Kanbans</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina a ordem sequencial em que as colunas aparecem no <strong>Kanban Operacional</strong> e no <strong>Kanban Tático</strong>
            </p>
          </div>

          {/* Sub-tabs selector: Operacional vs Tático */}
          <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveOrderTab('operacional')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeOrderTab === 'operacional'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Kanban Operacional ({opConfigCols.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveOrderTab('tatico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeOrderTab === 'tatico'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              Kanban Tático ({tacConfigCols.length})
            </button>
          </div>
        </div>

        {/* Columns list */}
        <div className="space-y-2 pt-1">
          {activeOrderTab === 'operacional' ? (
            opConfigCols.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3">Nenhum status configurado para o Kanban Operacional.</p>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {opConfigCols.map((col, idx) => {
                  const meta = col.category ? COLUMN_META[col.category] : undefined;
                  const canUp = idx > 0;
                  const canDown = idx < opConfigCols.length - 1;

                  return (
                    <div
                      key={col.status.id}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${meta?.dot || 'bg-slate-500'}`} />
                        <span className="font-semibold text-black truncate">{col.status.name}</span>
                        {meta && (
                          <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${meta.chip}`}>
                            {meta.label}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500">ID #{col.status.id}</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={!canUp}
                          onClick={() => moveOperationalColumn(col.status.id, 'up')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-800 disabled:pointer-events-none transition-colors"
                          title="Mover coluna para cima / esquerda"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={!canDown}
                          onClick={() => moveOperationalColumn(col.status.id, 'down')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-800 disabled:pointer-events-none transition-colors"
                          title="Mover coluna para baixo / direita"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : tacConfigCols.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3">Nenhum status configurado para o Kanban Tático.</p>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {tacConfigCols.map((col, idx) => {
                const meta = col.category ? COLUMN_META[col.category] : undefined;
                const canUp = idx > 0;
                const canDown = idx < tacConfigCols.length - 1;

                return (
                  <div
                    key={col.status.id}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-purple-950 text-purple-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-purple-800/60">
                        {idx + 1}
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta?.dot || 'bg-slate-500'}`} />
                      <span className="font-semibold text-white truncate">{col.status.name}</span>
                      {meta && (
                        <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${meta.chip}`}>
                          {meta.label}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-slate-500">ID #{col.status.id}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!canUp}
                        onClick={() => moveTacticalColumn(col.status.id, 'up')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-800 disabled:pointer-events-none transition-colors"
                        title="Mover coluna para cima / esquerda"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={!canDown}
                        onClick={() => moveTacticalColumn(col.status.id, 'down')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:hover:bg-slate-800 disabled:pointer-events-none transition-colors"
                        title="Mover coluna para baixo / direita"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action: restore default order for active tab */}
        <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <p className="text-[11px] text-slate-500">
            Dica: você também pode reordenar colunas diretamente nos Kanbans usando as setas nos cabeçalhos das colunas.
          </p>
          <button
            type="button"
            onClick={activeOrderTab === 'operacional' ? () => setOperationalColumnOrder([]) : () => setTacticalColumnOrder([])}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors shrink-0 text-left sm:text-right"
          >
            Restaurar ordem padrão deste Kanban
          </button>
        </div>
      </div>

      {/* Requisito 8: Opções de tema para a interface (UI) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
            <Palette className="w-4 h-4" />
            <span>8. Opções de Tema para a Interface (UI)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Personalize o esquema cromático e a estética visual da extensão
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-1">
          {(Object.keys(THEMES) as ThemeId[]).map((tId) => {
            const themeDef = THEMES[tId];
            const isSelected = theme === tId;

            return (
              <div
                key={tId}
                onClick={() => {
                  setTheme(tId);
                  applyTheme(tId);
                }}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${isSelected
                  ? 'border-rose-500 bg-rose-950/20 ring-2 ring-rose-500/30'
                  : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
                  }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {themeDef.swatches.map((color, i) => (
                      <span
                        key={i}
                        className="w-3.5 h-3.5 rounded-full border border-white/20 inline-block"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-rose-500" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-white">{themeDef.name}</h4>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  {themeDef.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset sandbox data */}
      <div className="pt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onResetDemoData}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Restaurar dados de demonstração iniciais</span>
        </button>

        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs shadow-md shadow-rose-900/30 transition-all disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Salvar Alterações</span>
        </button>
      </div>
    </form>
  );
};
