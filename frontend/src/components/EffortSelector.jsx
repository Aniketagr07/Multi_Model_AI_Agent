import React, { useState, useRef, useEffect } from 'react';

export const EFFORT_LEVELS = [
  {
    id: 'low',
    name: 'Low Effort',
    shortName: 'Low',
    icon: '⚡',
    badge: 'Fast',
    description: 'Fastest latency, concise & direct response with minimal token overhead',
    activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    indicatorClass: 'bg-emerald-400',
  },
  {
    id: 'medium',
    name: 'Medium Effort',
    shortName: 'Medium',
    icon: '⚖️',
    badge: 'Balanced',
    description: 'Standard reasoning depth, balanced clarity, optimal default for all tasks',
    activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    indicatorClass: 'bg-purple-400',
  },
  {
    id: 'high',
    name: 'High Effort',
    shortName: 'High',
    icon: '🧠',
    badge: 'Deep',
    description: 'Deep multi-step reasoning, comprehensive explanations, and edge-case analysis',
    activeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    indicatorClass: 'bg-rose-400',
  },
];

export function EffortSelector({ selectedEffort = 'medium', onSelectEffort, disabled = false, compact = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentEffort = EFFORT_LEVELS.find((e) => e.id === selectedEffort) || EFFORT_LEVELS[1];

  // Close dropdown on outside click or Escape
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

  if (compact) {
    // Inline Segmented Control for Compare View or compact toolbars
    return (
      <div className="inline-flex items-center p-0.5 rounded-xl bg-[#0B0D12] border border-[#282D38] select-none">
        {EFFORT_LEVELS.map((level) => {
          const isActive = level.id === selectedEffort;
          return (
            <button
              key={level.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectEffort && onSelectEffort(level.id)}
              title={`${level.name}: ${level.description}`}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? `${level.activeClass} border shadow-sm`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923] border border-transparent'
              }`}
            >
              <span>{level.icon}</span>
              <span>{level.shortName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${
          isOpen
            ? 'bg-[#1A1F2C] border-[#8B5CF6]/50 text-white shadow-lg'
            : `${currentEffort.activeClass} hover:brightness-110`
        }`}
        title={`Current Effort: ${currentEffort.name} - ${currentEffort.description}`}
      >
        <span className="text-sm">{currentEffort.icon}</span>
        <span className="font-semibold">{currentEffort.shortName}</span>
        <span className="text-[10px] px-1 py-0.2 rounded bg-black/30 opacity-80 uppercase tracking-wider font-mono">
          Effort
        </span>
        <svg
          className={`w-3.5 h-3.5 opacity-70 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2 py-1.5 border-b border-[#282D38]/60 mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Reasoning Effort
            </span>
            <span className="text-[10px] text-purple-400 font-mono">
              All Models
            </span>
          </div>

          <div className="space-y-1">
            {EFFORT_LEVELS.map((level) => {
              const isSelected = level.id === selectedEffort;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => {
                    onSelectEffort && onSelectEffort(level.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer border ${
                    isSelected
                      ? `${level.activeClass} border`
                      : 'border-transparent hover:bg-[#151923] text-slate-300'
                  }`}
                >
                  <span className="text-base mt-0.5">{level.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200">
                        {level.name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        level.id === 'low'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : level.id === 'high'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {level.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                      {level.description}
                    </p>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-purple-400 shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
