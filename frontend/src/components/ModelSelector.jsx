import React, { useState, useRef, useEffect } from 'react';

export const AVAILABLE_MODELS = [
  {
    id: 'auto',
    name: 'Auto (Smart Router)',
    tag: 'Rule-Based Router',
    provider: 'OmniAI Router',
    isOperational: true,
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description: 'Automatically routes to the best model based on prompt classification (coding, writing, reasoning, general)',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Latest)',
    tag: 'Google AI Studio Latest',
    provider: 'Google AI Studio',
    isOperational: true,
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description: "Google's latest flagship multimodal intelligence with enhanced reasoning and multi-task capability",
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    tag: 'Google Free Tier',
    provider: 'Google AI Studio',
    isOperational: true,
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'Stable high-speed multimodal intelligence with verified low latency',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    tag: 'Google Free Tier',
    provider: 'Google AI Studio',
    isOperational: true,
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    description: 'High-speed multimodal intelligence with 15 RPM / 1M TPM free quota',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B',
    tag: 'Groq LPU Free Tier',
    provider: 'Groq Cloud',
    isOperational: true,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description: 'Ultra-low latency inference powered by Groq LPU engine (30 RPM free)',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    tag: 'Google Pro',
    provider: 'Google AI Studio',
    isOperational: true,
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    iconColor: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    description: 'Complex reasoning and synthesis with massive 1M token context',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    tag: 'Groq Heavy LPU',
    provider: 'Groq Cloud',
    isOperational: true,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconColor: 'bg-amber-600/20 text-amber-500 border-amber-500/30',
    description: 'Open-weights reasoning powerhouse accelerated on Groq LPUs',
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    tag: 'Groq MoE',
    provider: 'Groq Cloud',
    isOperational: true,
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    iconColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    description: 'High-speed Mixture-of-Experts architecture with 32k context on Groq',
  },
  {
    id: 'llama-3-8b-local',
    name: 'Llama 3 (Local)',
    tag: 'Coming Soon',
    provider: 'Ollama Local (Day 7)',
    isOperational: false,
    badgeColor: 'bg-charcoal-800 text-slate-500 border-[#282D38]',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description: 'Privacy-first on-device local execution via Ollama',
  },
];

export function ModelSelector({ selectedModelId, onSelectModel, disabled = false, customModels = [], onOpenApiKeyModal }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const allAvailableModels = [...customModels, ...AVAILABLE_MODELS];
  const selectedModel = allAvailableModels.find(m => m.id === selectedModelId) || allAvailableModels[0];

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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select AI Model"
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#151923] hover:bg-[#1E2330] text-[#F3F4F6] border border-[#282D38] hover:border-[#8B5CF6]/50 transition-all focus:outline-none focus:ring-1 focus:ring-[#8B5CF6] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span className={`w-2 h-2 rounded-full ${selectedModel.isOperational ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
        <span className="font-semibold text-slate-200">{selectedModel.name}</span>
        <span className={`text-[10px] px-1.5 py-0.2 rounded border ${selectedModel.badgeColor}`}>
          {selectedModel.tag}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute bottom-full mb-2 left-0 w-84 rounded-xl bg-[#10131A] border border-[#282D38] shadow-2xl p-1.5 z-50 focus:outline-none animate-in fade-in duration-150"
        >
          <div className="px-3 py-2 border-b border-[#282D38]/60 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Model Selector & Router
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                Day 6 Router Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Choose "Auto" for intelligent heuristic routing or select a specific model.
            </p>
          </div>

          {/* Quick Connect BYOK Button */}
          <div className="p-2 border-b border-[#282D38]/60 mb-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onOpenApiKeyModal) onOpenApiKeyModal();
              }}
              className="w-full py-1.5 px-2.5 rounded-lg bg-gradient-to-r from-purple-900/30 to-indigo-900/30 hover:from-purple-800/50 hover:to-indigo-800/50 border border-purple-500/40 text-purple-200 text-xs font-semibold flex items-center justify-between transition-all cursor-pointer shadow-sm"
            >
              <span className="flex items-center gap-1.5">
                <span>🔑</span>
                <span>Connect API Key & Fetch Models</span>
              </span>
              <span className="text-[10px] font-mono bg-purple-500/20 px-1.5 py-0.2 rounded border border-purple-500/30 text-purple-300">
                BYOK
              </span>
            </button>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {/* Custom BYOK Discovered Models */}
            {customModels.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Your Custom Models</span>
                  <span className="text-[9px] font-mono bg-emerald-500/20 px-1 rounded border border-emerald-500/30">
                    {customModels.length} active
                  </span>
                </div>
                {customModels.map((model) => {
                  const isSelected = model.id === selectedModel.id;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelectModel(model.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#151923] border border-emerald-500/50 text-white'
                          : 'hover:bg-[#151923]/80 text-slate-300 border border-transparent'
                      }`}
                    >
                      <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border shrink-0 ${model.iconColor}`}>
                        🔑
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-slate-100 truncate">{model.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${model.badgeColor}`}>
                            {model.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {model.description}
                        </p>
                      </div>
                      {isSelected && (
                        <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
                <div className="my-1 border-t border-[#282D38]/60" />
              </div>
            )}

            {/* Built-in Master Registry Models */}
            {AVAILABLE_MODELS.map((model) => {
              const isSelected = model.id === selectedModel.id;
              const isOperational = model.isOperational;

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
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start gap-2.5 ${
                    isOperational ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } ${
                    isSelected
                      ? 'bg-[#151923] border border-[#8B5CF6]/50 text-white'
                      : isOperational
                      ? 'hover:bg-[#151923]/80 text-slate-300 border border-transparent'
                      : 'text-slate-500 border border-transparent'
                  }`}
                >
                  <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border shrink-0 ${model.iconColor}`}>
                    {model.id === 'auto' ? '⚡' : model.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-100 truncate">{model.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border shrink-0 ${model.badgeColor}`}>
                        {model.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {model.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 select-none">
                      <span className="text-slate-500 font-mono">Effort:</span>
                      <span className="text-emerald-400 font-medium">Low ⚡</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-purple-400 font-medium">Med ⚖️</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-rose-400 font-medium">High 🧠</span>
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
