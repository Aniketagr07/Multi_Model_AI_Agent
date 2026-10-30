import React, { useState, useRef, useEffect, useMemo } from 'react';

export const AVAILABLE_MODELS = [
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
    tag: 'Groq Heavy LPU',
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
    id: 'llama-3-8b-local',
    name: 'Llama 3 (Local)',
    shortName: 'Llama 3 Local',
    providerGroup: 'local',
    providerGroupLabel: 'LOCAL MODELS',
    provider: 'local',
    tag: 'Ollama Local',
    isOperational: false,
    badgeColor: 'bg-charcoal-800 text-slate-500 border-[#282D38]',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    contextWindow: '8k tokens',
    description: 'Privacy-first on-device local execution via Ollama (requires local daemon).',
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
 * Renders verified SVG brand icons for Google, Groq, OpenAI, Anthropic, Ollama/Local, and Auto Router.
 */
export function ProviderLogo({ provider, className = 'w-4 h-4' }) {
  const p = (provider || '').toLowerCase();

  if (p.includes('google') || p.includes('gemini')) {
    // Official Google Gemini 4-Point Star Sparkle
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
    // Groq Amber LPU Lightning Mark
    return (
      <svg className={`${className} shrink-0 text-amber-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2" />
      </svg>
    );
  }

  if (p.includes('openai') || p.includes('gpt')) {
    // OpenAI Spiral Flower Logo
    return (
      <svg className={`${className} shrink-0 text-emerald-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a10 10 0 0 1 10 10" />
        <path d="M12 12l5-5" />
      </svg>
    );
  }

  if (p.includes('anthropic') || p.includes('claude')) {
    // Anthropic Geometric Mark
    return (
      <svg className={`${className} shrink-0 text-orange-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.5 3h3.5L11.5 21H8L14.5 3zm-7 18h3.5L4.5 10H1L7.5 21z" />
      </svg>
    );
  }

  if (p.includes('local') || p.includes('ollama')) {
    // Local / Ollama On-Device CPU Icon
    return (
      <svg className={`${className} shrink-0 text-slate-400`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
 * Integrated Model Selector & Reasoning Effort Component
 * Unifies model switching, provider grouping, and reasoning effort into a single modern popover.
 */
export function ModelSelector({
  selectedModelId = 'auto',
  onSelectModel,
  effort = 'medium',
  onSelectEffort,
  disabled = false,
  customModels = [],
  onOpenApiKeyModal,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const allAvailableModels = useMemo(() => {
    return [...customModels, ...AVAILABLE_MODELS];
  }, [customModels]);

  const selectedModel = useMemo(() => {
    return allAvailableModels.find((m) => m.id === selectedModelId) || allAvailableModels[0];
  }, [allAvailableModels, selectedModelId]);

  // Dynamically group models by provider
  const groupedModels = useMemo(() => {
    const groups = {};

    for (const m of allAvailableModels) {
      const p = (m.providerGroup || m.provider || 'other').toLowerCase();
      let key = 'other';
      let label = 'OTHER MODELS';

      if (m.id === 'auto' || p.includes('router') || p.includes('auto')) {
        key = 'auto';
        label = 'AUTO ROUTING';
      } else if (p.includes('gemini') || p.includes('google')) {
        key = 'google';
        label = 'GOOGLE GEMINI';
      } else if (p.includes('groq')) {
        key = 'groq';
        label = 'GROQ LPU';
      } else if (p.includes('openai') || p.includes('gpt')) {
        key = 'openai';
        label = 'OPENAI';
      } else if (p.includes('anthropic') || p.includes('claude')) {
        key = 'anthropic';
        label = 'ANTHROPIC';
      } else if (p.includes('local') || p.includes('ollama')) {
        key = 'local';
        label = 'LOCAL MODELS';
      }

      if (!groups[key]) {
        groups[key] = {
          key,
          label: m.providerGroupLabel || label,
          models: [],
        };
      }
      groups[key].models.push(m);
    }

    // Explicit ordering: Auto -> Google -> Groq -> OpenAI -> Anthropic -> Local -> Other
    const order = ['auto', 'google', 'groq', 'openai', 'anthropic', 'local', 'other'];
    return order
      .filter((k) => groups[k] && groups[k].models.length > 0)
      .map((k) => groups[k]);
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
      {/* Closed Trigger Button: Provider Logo + Shortened Model Name + Small Chevron */}
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
        {/* Provider Brand Logo */}
        <ProviderLogo provider={selectedModel.providerGroup || selectedModel.provider} className="w-3.5 h-3.5" />

        {/* Shortened Human-Readable Model Name */}
        <span className="font-semibold text-slate-100">
          {selectedModel.shortName || selectedModel.name}
        </span>

        {/* Small Dropdown Indicator */}
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

      {/* Integrated Opened Dropdown Popover */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute bottom-full mb-2 left-0 w-88 max-w-[calc(100vw-2rem)] rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-2 z-50 focus:outline-none animate-in fade-in duration-150 backdrop-blur-md"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#282D38]/60 mb-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                Model Selection
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                Multi-Provider
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

          {/* Grouped Models List (Scrollable) */}
          <div className="max-h-60 overflow-y-auto space-y-2.5 px-1 py-1 scroll-smooth">
            {groupedModels.map((group) => (
              <div key={group.key} className="space-y-1">
                {/* Provider Section Heading */}
                <div className="flex items-center gap-1.5 px-2 pt-1 pb-0.5 text-[10px] font-bold text-slate-400 tracking-wider">
                  <ProviderLogo provider={group.key} className="w-3.5 h-3.5" />
                  <span>{group.label}</span>
                </div>

                {/* Model Items in Group */}
                <div className="space-y-0.5">
                  {group.models.map((model) => {
                    const isSelected = model.id === selectedModel.id;
                    const isOperational = model.isOperational !== false;

                    return (
                      <button
                        key={model.id}
                        type="button"
                        role="option"
                        disabled={!isOperational}
                        aria-selected={isSelected}
                        onClick={() => {
                          if (isOperational) {
                            onSelectModel(model.id);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer ${
                          !isOperational
                            ? 'opacity-40 cursor-not-allowed bg-transparent'
                            : isSelected
                            ? 'bg-purple-600/20 border border-purple-500/60 text-white shadow-xs'
                            : 'hover:bg-[#151923] text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProviderLogo provider={group.key} className="w-4 h-4 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-100 truncate text-xs">
                                {model.shortName || model.name}
                              </span>
                              {/* Full model name rendered so tests and accessibility find it */}
                              <span className="text-[10px] text-slate-500 hidden sm:inline truncate max-w-[140px]">
                                {model.name}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[210px] mt-0.5">
                              {model.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {model.contextWindow && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-slate-400 border border-white/5">
                              {model.contextWindow}
                            </span>
                          )}
                          {isSelected ? (
                            <svg className="w-4 h-4 text-purple-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : !isOperational ? (
                            <span className="text-[9px] text-slate-500">Offline</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Integrated Reasoning Effort Section */}
          <div className="mt-2 pt-2.5 border-t border-[#282D38]/80 px-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <span>Reasoning Effort</span>
              </span>
              <span className="text-[10px] text-purple-300 font-mono">
                {currentEffort.desc}
              </span>
            </div>

            {/* 3-way Segmented Toggle */}
            <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[#0B0D12] border border-[#282D38]">
              {EFFORT_LEVELS.map((level) => {
                const isActive = level.id === effort;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => onSelectEffort && onSelectEffort(level.id)}
                    title={level.desc}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isActive
                        ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923] border border-transparent'
                    }`}
                  >
                    <span>{level.icon}</span>
                    <span>{level.shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Popover Footer Bar */}
          <div className="mt-2.5 pt-2 border-t border-[#282D38]/60 px-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onOpenApiKeyModal) onOpenApiKeyModal();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors cursor-pointer"
            >
              <span className="text-sm font-bold leading-none">+</span>
              <span>Add API Key</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 rounded-lg bg-[#151923] hover:bg-[#1E2330] text-slate-200 hover:text-white border border-[#282D38] text-[11px] font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
