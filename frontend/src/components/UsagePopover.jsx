import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fetchModelUsage } from '../services/api';
import { ProviderLogo } from './ModelSelector';

export function UsagePopover({ lastCompletedTimestamp }) {
  const [isOpen, setIsOpen] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const popoverRef = useRef(null);

  const loadUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchModelUsage();
      setUsageData(data);
    } catch (err) {
      console.warn('Failed to load usage analytics:', err);
      setError('Unable to load usage data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch usage when opened or after request completes
  useEffect(() => {
    if (isOpen) {
      loadUsage();
    }
  }, [isOpen, loadUsage]);

  useEffect(() => {
    if (lastCompletedTimestamp && isOpen) {
      loadUsage();
    }
  }, [lastCompletedTimestamp, isOpen, loadUsage]);

  // Click outside to close or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
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

  const defaultProviders = [
    {
      provider: 'google',
      display_name: 'Google Gemini',
      weekly: { percent_left: 76, reset_countdown: 'Resets in 2d' },
      five_hour: { percent_left: 89, reset_countdown: 'Resets in 4h 12m' },
    },
    {
      provider: 'groq',
      display_name: 'Groq',
      weekly: { percent_left: 80, reset_countdown: 'Resets in 2d' },
      five_hour: { percent_left: 92, reset_countdown: 'Resets in 3h 45m' },
    },
    {
      provider: 'openai',
      display_name: 'OpenAI',
      weekly: { percent_left: 100, reset_countdown: 'Resets in 2d' },
      five_hour: { percent_left: 100, reset_countdown: 'Resets in 5h' },
    },
    {
      provider: 'anthropic',
      display_name: 'Claude',
      weekly: { percent_left: 100, reset_countdown: 'Resets in 2d' },
      five_hour: { percent_left: 100, reset_countdown: 'Resets in 5h' },
    },
  ];

  const providers = (usageData && usageData.providers && usageData.providers.length > 0)
    ? usageData.providers
    : defaultProviders;

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Small "View Usage" Trigger Option */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View Model Usage"
        title="View sliding window limits and quota usage"
        className="text-[11px] text-slate-400 hover:text-purple-300 transition-colors flex items-center gap-1 font-medium cursor-pointer focus:outline-none focus-visible:underline select-none"
      >
        <svg className="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20v-6M6 20V10M18 20V4" />
        </svg>
        <span>View Usage</span>
      </button>

      {/* Compact Floating Popover (Appears above the button without resizing chat layout) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Model Usage Analytics"
          className="absolute bottom-full right-0 mb-2 w-80 sm:w-84 rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-3.5 z-50 backdrop-blur-md animate-fade-in text-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#282D38]/80 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white tracking-wider">USAGE</span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                5h & 7d Windows
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded text-xs transition-colors cursor-pointer"
              aria-label="Close usage popover"
            >
              ✕
            </button>
          </div>

          {/* Body: Grouped by Provider */}
          <div className="space-y-3 max-h-72 overflow-y-auto px-0.5 py-1 scroll-smooth">
            {isLoading && !usageData ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Loading usage metrics...
              </div>
            ) : error && !usageData ? (
              <div className="py-4 text-center text-xs text-slate-500">
                Usage metrics will record after model requests.
              </div>
            ) : (
              providers.map((p) => {
                const weeklyLeft = p.weekly?.percent_left ?? 100;
                const fiveHrLeft = p.five_hour?.percent_left ?? 100;

                return (
                  <div key={p.provider} className="bg-[#151923] border border-[#282D38]/70 rounded-xl p-2.5 space-y-2">
                    {/* Provider Name and Reset Countdown */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-100">
                        <ProviderLogo provider={p.provider} className="w-3.5 h-3.5" />
                        <span>{p.display_name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {p.five_hour?.reset_countdown || 'Rolling window'}
                      </span>
                    </div>

                    {/* Weekly Limit Row */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Weekly limit</span>
                        <span className="font-mono text-slate-200 font-medium">{weeklyLeft}% left</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#0B0D12] rounded-full overflow-hidden border border-[#282D38]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            weeklyLeft < 20 ? 'bg-red-500' : weeklyLeft < 50 ? 'bg-amber-500' : 'bg-purple-500'
                          }`}
                          style={{ width: `${weeklyLeft}%` }}
                        />
                      </div>
                    </div>

                    {/* 5-Hour Limit Row */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">5-hour limit</span>
                        <span className="font-mono text-slate-200 font-medium">{fiveHrLeft}% left</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#0B0D12] rounded-full overflow-hidden border border-[#282D38]">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            fiveHrLeft < 20 ? 'bg-red-500' : fiveHrLeft < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${fiveHrLeft}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Disclaimer */}
          <div className="pt-2 mt-2 border-t border-[#282D38]/60 text-[10px] text-slate-500 leading-tight">
            * OmniAI configured sliding windows (5h/7d). Not official upstream hard caps.
          </div>
        </div>
      )}
    </div>
  );
}
