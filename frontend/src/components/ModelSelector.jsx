import React, { useState, useRef, useEffect } from 'react';

export const AVAILABLE_MODELS = [
  {
    id: 'gpt-4o-demo',
    name: 'GPT-4o',
    tag: 'Demo Mode',
    provider: 'OpenAI',
    description: 'High-speed multimodal reasoning and analytical synthesis',
    iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'claude-3-5-sonnet-demo',
    name: 'Claude 3.5 Sonnet',
    tag: 'Demo Mode',
    provider: 'Anthropic',
    description: 'Specialized for nuanced logic, deep analysis, and code synthesis',
    iconColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  {
    id: 'gemini-1-5-pro-demo',
    name: 'Gemini 1.5 Pro',
    tag: 'Demo Mode',
    provider: 'Google',
    description: 'Massive context window analysis and multimodal synthesis',
    iconColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'llama-3-8b-local-demo',
    name: 'Llama 3 8B',
    tag: 'Local Demo',
    provider: 'Ollama',
    description: 'Privacy-first on-device local neural model execution',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
];

export function ModelSelector({ selectedModelId, onSelectModel, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

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
        <span className={`w-2 h-2 rounded-full ${selectedModel.id.includes('local') ? 'bg-purple-400' : 'bg-emerald-400'}`} />
        <span className="font-semibold text-slate-200">{selectedModel.name}</span>
        <span className="text-[10px] px-1.5 py-0.2 rounded bg-charcoal-800 text-slate-400 border border-[#282D38]">
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
          className="absolute bottom-full mb-2 left-0 w-72 rounded-xl bg-[#10131A] border border-[#282D38] shadow-2xl p-1.5 z-50 focus:outline-none animate-in fade-in duration-150"
        >
          <div className="px-3 py-2 border-b border-[#282D38]/60 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Select Model
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                Day 2 Mock
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Target provider for routing request. Real API keys wired in Day 3.
            </p>
          </div>

          <div className="space-y-1">
            {AVAILABLE_MODELS.map((model) => {
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
                      ? 'bg-[#151923] border border-[#8B5CF6]/50 text-white'
                      : 'hover:bg-[#151923]/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className={`mt-0.5 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border shrink-0 ${model.iconColor}`}>
                    {model.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-100 truncate">{model.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{model.tag}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {model.description}
                    </p>
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

