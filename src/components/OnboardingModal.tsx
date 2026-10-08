import React, { useState } from 'react';
import {
  KeyRound,
  Globe,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  Database
} from 'lucide-react';
import { RedmineClient, requestHostPermission, normalizeRedmineUrl } from '../services/redmineApi';
import { RedlevelsConfig, RedmineUser } from '../types/redmine';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (configUpdates: Partial<RedlevelsConfig>, user?: RedmineUser) => void;
  onExploreDemo: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  onExploreDemo,
}) => {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successUser, setSuccessUser] = useState<RedmineUser | null>(null);

  if (!isOpen) return null;

  const cleanUrl = normalizeRedmineUrl(url);
  const myAccountLink = cleanUrl ? `${cleanUrl}/my/account` : 'https://[IP_ADDRESS]/my/account';

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanUrl) {
      setErrorMessage('Por favor, informe a URL da sua aplicação Redmine.');
      return;
    }
    if (!apiKey.trim()) {
      setErrorMessage('Por favor, informe sua API Key do Redmine.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    // Request host permission within the user gesture before async gap
    await requestHostPermission(cleanUrl);

    try {
      const client = new RedmineClient(cleanUrl, apiKey.trim(), false);
      const res = await client.testConnection();

      if (res.success && res.data) {
        setSuccessUser(res.data);
        setTimeout(() => {
          onComplete(
            {
              redmineUrl: cleanUrl,
              apiKey: apiKey.trim(),
              isConfigured: true,
              isDemoMode: false,
            },
            res.data
          );
        }, 1200);
      } else {
        setErrorMessage(
          res.error ||
          'Não foi possível conectar ao Redmine. Verifique se a URL está acessível e se a API Key tem permissões habilitadas nas preferências de sua conta.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro inesperado na conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden shadow-rose-950/20">
        {/* Header Banner */}
        <div className="p-6 bg-gradient-to-r from-rose-900/50 via-slate-900 to-slate-900 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-rose-900/40">
              <img src="./icons/icon-32.png" alt="RL" className="w-8 h-8 rounded-lg" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Bem-vindo ao Redlevels

              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Conecte no seu Redmine para utilizar o Redlevels
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {successUser ? (
            <div className="p-5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
              <div>
                <h3 className="text-base font-bold text-emerald-200">
                  Conexão estabelecida com sucesso!
                </h3>
                <p className="text-sm text-emerald-300/80 mt-1">
                  Olá, <strong className="text-emerald-100">{successUser.firstname} {successUser.lastname}</strong> ({successUser.login}). Carregando sua área de trabalho...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTestAndConnect} className="space-y-4">
              {/* Redmine URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-rose-400" />
                    URL da aplicação Redmine
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">ex: https://redmine.suaempresa.com</span>
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://meu-redmine.com ou http://192.168.1.100:3000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                    required
                  />
                </div>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-rose-400" />
                    Chave de API
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">Token de 40 dígitos</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Ex: 8a4b6c891df092b67f130..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                  required
                />
              </div>

              {/* Requirement Note: "A api key poderá ser gerada utilizando o link https://[IP_ADDRESS]/my/account" */}
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 text-xs text-rose-200/90 leading-relaxed space-y-1">
                <div className="font-semibold text-rose-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  Como obter sua chave de API:
                </div>
                <p className="text-slate-300">
                  A api key poderá ser gerada utilizando o link{' '}
                  <span className="font-mono text-rose-300 bg-rose-950/80 px-1 py-0.5 rounded border border-rose-800/60 select-all">
                    {myAccountLink}
                  </span>
                  .
                </p>
                <p className="text-[11px] text-slate-400">
                  Na barra lateral direita da página "Minha conta", clique em <em>"Exibir"</em> na seção <strong>Chave de acesso à API</strong> (ou <em>"Redefinir"</em> se for a primeira vez).
                </p>
              </div>

              {/* Error message alert */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/80 text-xs text-rose-200 flex items-start gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Falha na conexão:</p>
                    <p className="text-slate-300 mt-0.5">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm shadow-lg shadow-rose-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Conectando ao Redmine...</span>
                  </>
                ) : (
                  <>
                    <span>Conectar e Iniciar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Fallback to explore demo */}
          {!successUser && (
            <div className="pt-2 border-t border-slate-800/80 text-center">
              <button
                type="button"
                onClick={onExploreDemo}
                className="text-xs text-slate-400 hover:text-rose-300 transition-colors inline-flex items-center gap-1.5 font-medium"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>Não tem um Redmine agora? <strong>Testar com Dados de Demonstração</strong></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
