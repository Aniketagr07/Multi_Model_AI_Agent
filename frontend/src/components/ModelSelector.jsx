import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LOCAL_MODELS } from '../core/localModelRegistry';
import { useModelDownloadManager } from '../services/modelDownloadManager';

export const AVAILABLE_MODELS = [
  ...LOCAL_MODELS,
  {
    id: 'auto',
    name: 'Auto (Smart Router)',
    shortName: 'Auto',
    providerGroup: 'auto',
    providerGroupLabel: 'AUTO ROUTING',
    provider: 'auto',
    tag: 'Smart Heuristic',
    isOperational: true,
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    contextWindow: 'Dynamic',
    description: 'Classifies prompt intent (coding, writing, reasoning, general) and selects the optimal model.',
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash (Active)',
    shortName: '3.6 Flash',
    providerGroup: 'google',
    providerGroupLabel: 'GOOGLE GEMINI',
    provider: 'gemini',
    tag: 'Verified Active',
    isOperational: true,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    contextWindow: '1M tokens',
    description: 'Verified active high-speed Google multimodal model with instant streaming.',
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash Lite (Ultra Fast)',
    shortName: 'Flash-Lite',
    providerGroup: 'google',
    providerGroupLabel: 'GOOGLE GEMINI',
    provider: 'gemini',
    tag: 'Sub-Second',
    isOperational: true,
    badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    iconColor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    contextWindow: '1M tokens',
    description: 'Instant sub-second token generation optimized for conversational streaming.',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    shortName: '3.5 Flash',
    providerGroup: 'google',
    providerGroupLabel: 'GOOGLE GEMINI',
    provider: 'gemini',
    tag: 'Google Free Tier',
    isOperational: true,
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contextWindow: '1M tokens',
    description: 'Stable high-speed multimodal intelligence with verified sub-second response.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Latest)',
    shortName: '3.8 Flash',
    providerGroup: 'google',
    providerGroupLabel: 'GOOGLE GEMINI',
    provider: 'gemini',
    tag: 'Next-Gen Preview',
    isOperational: true,
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    contextWindow: '1M tokens',
    description: "Google's newest Gemini preview generation with seamless fallback safeguards.",
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    shortName: '1.5 Pro',
    providerGroup: 'google',
    providerGroupLabel: 'GOOGLE GEMINI',
    provider: 'gemini',
    tag: 'Google Pro',
    isOperational: true,
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    contextWindow: '1M tokens',
    description: 'Complex reasoning and synthesis with massive 1M token context capacity.',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    shortName: 'Llama 3.1',
    providerGroup: 'groq',
    providerGroupLabel: 'GROQ LPU',
    provider: 'groq',
    tag: 'Groq LPU Free Tier',
    isOperational: true,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    contextWindow: '128k tokens',
    description: 'Ultra-low latency inference powered by Groq LPU engine (30 RPM free).',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    shortName: 'Llama 3.3',
    providerGroup: 'groq',
    providerGroupLabel: 'GROQ LPU',
    provider: 'groq',
    tag: 'High Capacity',
    isOperational: true,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconColor: 'bg-amber-600/20 text-amber-500 border-amber-500/30',
    contextWindow: '128k tokens',
    description: 'Open-weights reasoning powerhouse accelerated on Groq LPUs.',
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    shortName: 'Mixtral 8x7B',
    providerGroup: 'groq',
    providerGroupLabel: 'GROQ LPU',
    provider: 'groq',
    tag: 'Groq MoE',
    isOperational: true,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    contextWindow: '32k tokens',
    description: 'High-speed Mixture-of-Experts architecture with 32k context on Groq.',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    shortName: 'GPT-4o',
    providerGroup: 'openai',
    providerGroupLabel: 'OPENAI',
    provider: 'openai',
    tag: 'OpenAI Flagship',
    isOperational: true,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    contextWindow: '128k tokens',
    description: 'OpenAI flagship multimodal intelligence with high-speed reasoning.',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    shortName: 'GPT-4o Mini',
    providerGroup: 'openai',
    providerGroupLabel: 'OPENAI',
    provider: 'openai',
    tag: 'OpenAI Fast',
    isOperational: true,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    contextWindow: '128k tokens',
    description: 'Lightweight high-efficiency model for fast everyday tasks.',
  },
];

export const EFFORT_LEVELS = [
  {
    id: 'low',
    name: 'Low Effort',
    shortName: 'Low',
    icon: '⚡',
    desc: 'Fastest latency, concise responses',
  },
  {
    id: 'medium',
    name: 'Medium Effort',
    shortName: 'Medium',
    icon: '⚖️',
    desc: 'Balanced depth & speed (Default)',
  },
  {
    id: 'high',
    name: 'High Effort',
    shortName: 'High',
    icon: '🧠',
    desc: 'Deep multi-step reasoning',
  },
];

/**
 * Provider Logo Component
 */
export function ProviderLogo({ provider, className = 'w-4 h-4' }) {
  const p = (provider || '').toLowerCase();

  if (p.includes('google') || p.includes('gemini')) {
    return (
      <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
          fill="url(#gemini-grad)"
        />
        <defs>
          <linearGradient id="gemini-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" />
            <stop offset="0.5" stopColor="#818CF8" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (p.includes('groq')) {
    return (
      <svg className={`${className} shrink-0 text-amber-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2" />
      </svg>
    );
  }

  if (p.includes('openai') || p.includes('gpt')) {
    return (
      <svg className={`${className} shrink-0 text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 10 10" />
        <path d="M12 12l5-5" />
      </svg>
    );
  }

  if (p.includes('local') || p.includes('ollama') || p.includes('qwen') || p.includes('smol')) {
    return (
      <svg className={`${className} shrink-0 text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
      </svg>
    );
  }

  // Auto Router Sparkles Icon (Default)
  return (
    <svg className={`${className} shrink-0 text-purple-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.912 5.885L20 10.8l-4.5 4.385 1.062 6.2L12 18.45 7.438 21.385l1.062-6.2L4 10.8l6.088-1.915L12 3z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/**
 * Integrated Model Selector Component
 * Organizes models into two distinct sections:
 * 1. LOCAL MODELS (On-Device Browser WebGPU)
 * 2. CLOUD MODELS (Google Gemini, Groq, OpenAI)
 */
export function ModelSelector({
  selectedModelId = 'auto',
  onSelectModel,
  effort = 'medium',
  onSelectEffort,
  disabled = false,
  customModels = [],
  onOpenApiKeyModal,
  onOpenAuthModal,
  user = null,
  isGuest = false,
  byokStatus = null,
  localModelReady = false,
  localModelLoading = false,
  onOpenLocalModelModal = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { isModelReady, getModelStatus, startDownload } = useModelDownloadManager();
  const dropdownRef = useRef(null);

  const allAvailableModels = useMemo(() => {
    return [...customModels, ...AVAILABLE_MODELS];
  }, [customModels]);

  const selectedModel = useMemo(() => {
    return allAvailableModels.find((m) => m.id === selectedModelId) || allAvailableModels[0];
  }, [allAvailableModels, selectedModelId]);

  // Determine user mode
  const isGuestUser = Boolean(isGuest || (user && user.isGuest));
  const hasActiveProvider = byokStatus ? Boolean(byokStatus.has_active_provider) : true;
  const connectedProviders = useMemo(() => {
    if (!byokStatus || !Array.isArray(byokStatus.providers)) {
      return new Set(['gemini', 'groq', 'openai']);
    }
    return new Set(byokStatus.providers.filter((p) => p.is_connected).map((p) => p.provider));
  }, [byokStatus]);

  // Local models list
  const localModelsList = useMemo(() => {
    return allAvailableModels.filter((m) => m.isLocal || m.provider === 'local');
  }, [allAvailableModels]);

  // Cloud models list
  const cloudModelsList = useMemo(() => {
    return allAvailableModels.filter((m) => !m.isLocal && m.provider !== 'local');
  }, [allAvailableModels]);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentEffort = EFFORT_LEVELS.find((e) => e.id === effort) || EFFORT_LEVELS[1];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Closed Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Selected model: ${selectedModel.shortName || selectedModel.name}. Click to change model or reasoning effort.`}
        className={`inline-flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-[#12151F] hover:bg-[#181C28] text-slate-200 border transition-all cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen ? 'border-purple-500/70 ring-1 ring-purple-500/30' : 'border-[#282D38] hover:border-purple-500/40'
        }`}
      >
        <ProviderLogo provider={selectedModel.providerGroup || selectedModel.provider} className="w-3.5 h-3.5" />
        <span className="font-semibold text-slate-100">
          {selectedModel.shortName || selectedModel.name}
        </span>
        {selectedModel.isLocal && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-medium">
            Local
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute bottom-full mb-2 left-0 w-88 max-w-[calc(100vw-2rem)] rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-2 z-50 focus:outline-none animate-in fade-in duration-150 backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#282D38]/60 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                Model Selection
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                {isGuestUser ? 'Guest Mode' : 'Multi-Provider'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-[#151923] text-xs transition-colors cursor-pointer"
              aria-label="Close selector"
            >
              ✕
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-3 px-1 py-1 scroll-smooth">
            {/* ---------------- SECTION 1: LOCAL MODELS ---------------- */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 pt-1 pb-0.5 text-[10px] font-bold text-emerald-400 tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ProviderLogo provider="local" className="w-3.5 h-3.5" />
                  <span>LOCAL MODELS</span>
                </div>
                <span className="text-[9px] font-medium text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  On-Device WebGPU
                </span>
              </div>

              <div className="space-y-1">
                {localModelsList.map((model) => {
                  const isSelected = model.id === selectedModel.id;
                  const modelStatus = getModelStatus(model.id);
                  const ready = isModelReady(model.id) || (localModelReady && model.id === selectedModel.id);
                  const isDownloading =
                    modelStatus.status === 'downloading' ||
                    modelStatus.status === 'preparing' ||
                    modelStatus.status === 'initializing';

                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (ready) {
                          onSelectModel(model.id);
                          setIsOpen(false);
                        } else if (isDownloading) {
                          if (onOpenLocalModelModal) {
                            onOpenLocalModelModal(model.id);
                          }
                          setIsOpen(false);
                        } else {
                          if (onOpenLocalModelModal) {
                            onOpenLocalModelModal(model.id);
                          } else {
                            startDownload(model.id);
                          }
                          setIsOpen(false);
                        }
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/20 border border-purple-500/60 text-white shadow-xs'
                          : 'hover:bg-[#151923] text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProviderLogo provider="local" className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-100 truncate text-xs">
                              {model.shortName || model.name}
                            </span>
                            <span className="text-[9px] font-medium px-1.5 py-0.2 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              {model.tag || 'Local / On-device'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {model.description}
                          </div>
                          {/* Independent Per-Model Status line */}
                          <div className="text-[10px] flex items-center gap-1 mt-0.5 font-mono">
                            <span className="text-gray-500">Status:</span>
                            {ready ? (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Ready
                              </span>
                            ) : modelStatus.status === 'initializing' ? (
                              <span className="text-teal-300 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                                Initializing
                              </span>
                            ) : isDownloading ? (
                              <span className="text-purple-300 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                                Downloading ({modelStatus.percent}%)
                              </span>
                            ) : modelStatus.status === 'error' ? (
                              <span className="text-red-400">Error</span>
                            ) : (
                              <span className="text-gray-400">Download Required</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator badge */}
                      <div className="shrink-0 pl-2">
                        {ready ? (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                            Ready
                          </span>
                        ) : modelStatus.status === 'initializing' ? (
                          <span className="text-[9px] font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                            Initializing
                          </span>
                        ) : isDownloading ? (
                          <span className="text-[9px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            Downloading
                          </span>
                        ) : modelStatus.status === 'error' ? (
                          <span className="text-[9px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                            Error
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-gray-300 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded group-hover:border-purple-500/40 group-hover:text-purple-300 transition-colors">
                            Download Required
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ---------------- SECTION 2: CLOUD MODELS ---------------- */}
            <div className="space-y-1 pt-1 border-t border-[#1F2430]">
              <div className="flex items-center justify-between px-2 pt-1 pb-0.5 text-[10px] font-bold text-slate-400 tracking-wider">
                <div className="flex items-center gap-1.5">
                  <ProviderLogo provider="gemini" className="w-3.5 h-3.5" />
                  <span>CLOUD MODELS</span>
                </div>
                <span className="text-[9px] text-slate-500 font-medium">
                  {isGuestUser ? 'Sign-in Required' : 'BYOK Keys'}
                </span>
              </div>

              {/* Unauthenticated / Guest View: Show prompt, restrict cloud access */}
              {isGuestUser ? (
                <div className="p-3 bg-[#151923] border border-[#2D3748] rounded-xl text-center space-y-2">
                  <p className="text-[11px] text-gray-300">
                    Cloud models (Google Gemini, Groq, OpenAI) require an account with API keys.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (onOpenAuthModal) onOpenAuthModal('signin');
                    }}
                    className="w-full py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Sign In or Register to Unlock Cloud Models →
                  </button>
                </div>
              ) : !hasActiveProvider && byokStatus ? (
                /* Authenticated User without API keys */
                <div className="p-3 bg-[#151923] border border-purple-500/30 rounded-xl space-y-2 text-center">
                  <p className="text-[11px] text-purple-200">
                    No cloud AI providers connected. Connect your keys to unlock Gemini, Groq, and OpenAI.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      if (onOpenApiKeyModal) onOpenApiKeyModal();
                    }}
                    className="w-full py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    + Connect API Key in Settings
                  </button>
                </div>
              ) : (
                /* Authenticated User with API keys or standard mode */
                <div className="space-y-0.5">
                  {cloudModelsList.map((model) => {
                    const isSelected = model.id === selectedModel.id;
                    const provider = model.provider?.toLowerCase() || '';
                    const isConnected =
                      model.id === 'auto' ||
                      connectedProviders.has(provider) ||
                      connectedProviders.has(model.providerGroup);

                    return (
                      <button
                        key={model.id}
                        type="button"
                        role="option"
                        disabled={!isConnected}
                        aria-selected={isSelected}
                        onClick={() => {
                          if (isConnected) {
                            onSelectModel(model.id);
                            setIsOpen(false);
                          } else if (onOpenApiKeyModal) {
                            onOpenApiKeyModal();
                            setIsOpen(false);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer ${
                          !isConnected
                            ? 'opacity-40 cursor-not-allowed hover:bg-white/5'
                            : isSelected
                            ? 'bg-purple-600/20 border border-purple-500/60 text-white shadow-xs'
                            : 'hover:bg-[#151923] text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProviderLogo provider={model.providerGroup || model.provider} className="w-4 h-4 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-100 truncate text-xs">
                                {model.shortName || model.name}
                              </span>
                              <span className="text-[10px] text-slate-500 hidden sm:inline truncate max-w-[130px]">
                                {model.name}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {model.description}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {!isConnected ? (
                            <span className="text-[9px] font-semibold text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                              + Connect
                            </span>
                          ) : (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${model.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                              {model.tag || model.contextWindow}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Reasoning Effort Selector (Unified) */}
          <div className="border-t border-[#282D38]/60 pt-2 px-1">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider">
                Reasoning Effort
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {currentEffort.name}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 bg-[#12151F] p-0.5 rounded-xl border border-[#282D38]">
              {EFFORT_LEVELS.map((eff) => {
                const isActive = eff.id === effort;
                return (
                  <button
                    key={eff.id}
                    type="button"
                    onClick={() => {
                      if (onSelectEffort) onSelectEffort(eff.id);
                    }}
                    title={eff.desc}
                    className={`py-1 px-1 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#181C28]'
                    }`}
                  >
                    <span>{eff.icon}</span>
                    <span>{eff.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Shortcut to Add API Key */}
          {onOpenApiKeyModal && !isGuestUser && (
            <div className="border-t border-[#282D38]/60 pt-2 px-1 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenApiKeyModal();
                }}
                className="w-full py-1.5 px-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>+</span> <span>Manage AI Providers / API Keys</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ModelSelector;
