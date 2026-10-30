import React, { useCallback, useEffect, useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { RedlevelsConfig } from '../types/redmine';
import { CacheStats, clearSnapshot, loadCacheStats } from '../services/issueCache';

interface LocalCachePanelProps {
  config: RedlevelsConfig;
  onSaveConfig: (updated: Partial<RedlevelsConfig>) => Promise<void>;
  /** Set by the app when the last write to the cache failed (e.g. no space left). */
  cacheError?: string | null;
}

const ESTIMATE_TARGET_ISSUES = 5000;
const FALLBACK_BYTES_PER_ISSUE = 1200;

const formatBytes = (bytes: number) => {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
  const kb = bytes / 1024;
  return kb >= 10 ? `${Math.round(kb)} KB` : `${kb.toFixed(1).replace('.', ',')} KB`;
};

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** True when the extension has the `unlimitedStorage` permission (no ~10 MB quota). */
const hasUnlimitedStorage = () => {
  try {
    return (chrome.runtime.getManifest().permissions || []).includes('unlimitedStorage');
  } catch {
    return false;
  }
};

export const LocalCachePanel: React.FC<LocalCachePanelProps> = ({ config, onSaveConfig, cacheError }) => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const enabled = config.cacheEnabled === true;

  const refresh = useCallback(() => {
    loadCacheStats().then(setStats);
  }, []);

  // The app writes the cache a couple of seconds after each load, so keep the numbers fresh.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (config.isDemoMode) return null;

  const bytesPerIssue = stats && stats.count > 0 ? stats.bytes / stats.count : FALLBACK_BYTES_PER_ISSUE;
  const target = Math.min(config.maxIssuesLimit || ESTIMATE_TARGET_ISSUES, ESTIMATE_TARGET_ISSUES);

  const toggle = async (on: boolean) => {
    if (!on) {
      await clearSnapshot();
      setStats(null);
    }
    await onSaveConfig({ cacheEnabled: on });
  };

  const clear = async () => {
    await clearSnapshot();
    setStats(null);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
      <div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 text-rose-400">
          <Database className="w-4 h-4" />
          <span>Armazenamento local</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Guarda as tarefas neste computador para o app abrir na hora e pedir só o que mudou ao Redmine.
        </p>
      </div>

      <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong>Guardar tarefas neste computador</strong>
          <span className="block text-[11px] text-slate-400">
            Os dados ficam no perfil do navegador. A chave de API nunca é guardada. Desligar apaga o cache.
          </span>
        </span>
      </label>

      <div className="text-[11px] text-slate-400 space-y-0.5">
        {!enabled ? (
          <p>Cache desligado: toda abertura carrega tudo do Redmine.</p>
        ) : stats ? (
          <p>
            Cache: {formatBytes(stats.bytes)} · {stats.count} tarefas · gravado às {formatTime(stats.savedAt)}
          </p>
        ) : (
          <p>Cache ainda vazio (grava poucos segundos depois da próxima carga).</p>
        )}
        <p>
          Média ≈ {formatBytes(bytesPerIssue)} por tarefa{stats && stats.count > 0 ? '' : ' (estimativa)'} ·{' '}
          {target.toLocaleString('pt-BR')} tarefas ≈ {formatBytes(bytesPerIssue * target)}
        </p>
        <p>
          {hasUnlimitedStorage()
            ? 'Limite: sem limite (permissão unlimitedStorage).'
            : 'Limite do navegador: cerca de 10 MB.'}
        </p>
        <p>Com o cache, tarefas excluídas ou movidas de escopo só somem em uma carga completa (automática após 24 h).</p>
      </div>

      {cacheError && (
        <p className="text-[11px] text-amber-300">
          Cache desativado nesta sessão: não foi possível gravar ({cacheError}). O app continua funcionando.
        </p>
      )}

      <button
        type="button"
        onClick={clear}
        disabled={!stats}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800/80 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Limpar cache
      </button>
    </div>
  );
};
