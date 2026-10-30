import React, { useState } from 'react';
import { discoverModels } from '../services/api';

const PROVIDER_CONFIGS = {
  gemini: {
    name: 'Google Gemini',
    icon: '✨',
    portalUrl: 'https://aistudio.google.com/app/apikey',
    portalLabel: 'Google AI Studio',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyPlaceholder: 'AIzaSy...',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    description: 'Fetch all models from your Google AI Studio account (Gemini 3.8, 3.5, 2.5 Pro, Flash, etc.)',
  },
  groq: {
    name: 'Groq Cloud',
    icon: '⚡',
    portalUrl: 'https://console.groq.com/keys',
    portalLabel: 'Groq Console',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    keyPlaceholder: 'gsk_...',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Fetch all ultra-fast LPU models from your Groq Cloud account (Llama 3.3 70B, Qwen, etc.)',
  },
  openai_compatible: {
    name: 'OpenAI / Custom API',
    icon: '🌐',
    portalUrl: 'https://platform.openai.com/api-keys',
    portalLabel: 'OpenAI Platform',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-... or Bearer token',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Connect any OpenAI-compatible API (OpenAI, OpenRouter, DeepSeek, Together, or local Ollama)',
    presets: [
      { label: 'OpenAI', url: 'https://api.openai.com/v1' },
      { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
      { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
      { label: 'Ollama (Local)', url: 'http://localhost:11434/v1' },
    ],
  },
};

export function ApiKeyModal({
  isOpen,
  onClose,
  customKeys = {},
  onSaveKeyAndModels,
  onRemoveKey,
  onSelectModel,
}) {
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [discoveredResult, setDiscoveredResult] = useState(null);

  if (!isOpen) return null;

  const currentConfig = PROVIDER_CONFIGS[selectedProvider];
  const existingSaved = customKeys[selectedProvider];

  const handleFetchModels = async (e) => {
    e.preventDefault();
    const keyToUse = apiKey.trim() || (existingSaved ? existingSaved.apiKey : '');
    if (!keyToUse && selectedProvider !== 'openai_compatible') {
      setError('Please enter your API key to discover models.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiscoveredResult(null);

    try {
      const result = await discoverModels({
        provider: selectedProvider,
        api_key: keyToUse,
        base_url: baseUrl.trim() || currentConfig.defaultBaseUrl,
      });

      setDiscoveredResult(result);
      if (onSaveKeyAndModels) {
        onSaveKeyAndModels(selectedProvider, keyToUse, baseUrl.trim() || currentConfig.defaultBaseUrl, result.models);
      }
    } catch (err) {
      console.error('[BYOK Discovery] Failed:', err);
      setError(err instanceof Error ? err.message : 'Model discovery failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (onRemoveKey) {
      onRemoveKey(selectedProvider);
    }
    setApiKey('');
    setDiscoveredResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#282D38] flex items-center justify-between shrink-0 bg-[#151923]/70">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-lg">
              🔑
            </span>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Connect Your API Key
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                  BYOK Auto-Discovery
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Provide your own API key to automatically fetch all your models and chat with them.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E2330] transition-colors cursor-pointer"
            title="Close modal"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Provider Selection Tabs */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Select AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {Object.entries(PROVIDER_CONFIGS).map(([key, config]) => {
                const isSelected = selectedProvider === key;
                const isSaved = Boolean(customKeys[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedProvider(key);
                      setError(null);
                      setDiscoveredResult(null);
                      setBaseUrl(config.defaultBaseUrl || '');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#1E2330] border-purple-500/70 text-white shadow-lg'
                        : 'bg-[#151923] border-[#282D38] text-slate-400 hover:text-slate-200 hover:bg-[#1A1F2C]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg">{config.icon}</span>
                      {isSaved && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                          Connected
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold">{config.name}</div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {currentConfig.description}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleFetchModels} className="space-y-4">
            {/* API Key Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300">
                  {currentConfig.name} API Key
                </label>
                <a
                  href={currentConfig.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 underline font-medium text-[11px] flex items-center gap-1"
                >
                  Get key at {currentConfig.portalLabel}
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>

              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={existingSaved ? '•••••••••••••••••••• (Connected key active)' : currentConfig.keyPlaceholder}
                  className="w-full bg-[#151923] text-white text-xs font-mono rounded-xl p-3 pr-10 border border-[#282D38] focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 transition-all placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Base URL (Optional / Customizable for OpenAI Compatible) */}
            {selectedProvider === 'openai_compatible' && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Custom Base URL Endpoint
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-[#151923] text-white text-xs font-mono rounded-xl p-2.5 border border-[#282D38] focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 placeholder-slate-600"
                />

                {/* Quick Presets */}
                {currentConfig.presets && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-500">Presets:</span>
                    {currentConfig.presets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setBaseUrl(preset.url)}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#151923] hover:bg-[#1E2330] text-slate-300 border border-[#282D38] hover:border-purple-500/40 transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
                <span className="text-red-400 text-sm">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {existingSaved && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
                  >
                    Disconnect & Clear Key
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-[#151923] transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white transition-all shadow-md shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Discovering Models...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Fetch All Models</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Discovery Results */}
          {discoveredResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#151923] border border-emerald-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-base">✅</span>
                  <span className="text-xs font-semibold text-emerald-300">
                    {discoveredResult.message}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {discoveredResult.count} Models Ready
                </span>
              </div>

              {/* Models List Scroll area */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {discoveredResult.models.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg bg-[#10131A] border border-[#282D38] hover:border-purple-500/40 flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 truncate">{m.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
                          {m.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {m.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectModel) {
                          onSelectModel(m.id);
                        }
                        onClose();
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#1E2330] hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 transition-all shrink-0 cursor-pointer"
                    >
                      Use Model
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

