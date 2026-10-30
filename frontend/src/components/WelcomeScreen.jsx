import React from 'react';

const SUGGESTIONS = [
  {
    category: 'Coding',
    badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    title: 'Python Binary Search',
    prompt: 'Implement an iterative binary search in Python with docstrings and space-time complexity explanation.',
    icon: (
      <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="14" y1="4" x2="10" y2="20" />
      </svg>
    ),
  },
  {
    category: 'Reasoning',
    badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
    title: 'Multi-Step Math Logic',
    prompt: 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost? Show step-by-step mathematical reasoning.',
    icon: (
      <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    category: 'Writing',
    badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
    title: 'Executive AI Summary',
    prompt: 'Draft an executive briefing summarizing why decoupled multi-model AI architectures reduce single-vendor lock-in and optimize latency.',
    icon: (
      <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    category: 'Architecture',
    badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    title: 'SSE vs WebSockets',
    prompt: 'Compare Server-Sent Events (SSE) versus WebSockets for LLM token streaming in terms of transport protocol, HTTP/2 multiplexing, and reconnection.',
    icon: (
      <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
];

export function WelcomeScreen({ onSelectPrompt, onSelectView }) {
  return (
    <div className="m-auto flex flex-col items-center justify-center px-3 py-2 sm:px-5 sm:py-3 max-w-4xl mx-auto w-full select-none animate-fade-in">
      {/* Brand Icon & Welcome Tagline */}
      <div className="text-center space-y-1.5 mb-2.5 sm:mb-3.5">
        <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 shadow-lg shadow-purple-500/25 mb-1">
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#F3F4F6]">
          Your AI workspace, all in one place.
        </h1>
        <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-lg mx-auto leading-relaxed">
          Ask a question, explore ideas, or switch models to compare answers from different AI architectures.
        </p>

        {/* Live Engine Badges */}
        <div className="inline-flex items-center justify-center gap-2 px-2.5 py-0.5 rounded-full bg-[#12151F] border border-white/10 text-[10px] sm:text-[11px] text-slate-300 shadow-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Google Gemini (REST/SSE)
          </span>
          <span className="text-slate-600">•</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Groq LPU (Llama 3.1)
          </span>
          <span className="text-slate-600">•</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            SQLite WAL
          </span>
        </div>
      </div>

      {/* Evaluation Demonstration Prompt Grid (4 Intent Categories) */}
      <div className="w-full mb-2 sm:mb-3">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
            Evaluation Demonstration Prompts
          </span>
          <span className="text-[10px] sm:text-[11px] text-purple-400 font-medium">
            Click any prompt to test Auto-Routing
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 w-full">
          {SUGGESTIONS.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="flex flex-col text-left p-2 sm:p-2.5 rounded-xl bg-[#151923] hover:bg-[#1E2330] border border-[#282D38] hover:border-[#8B5CF6]/50 transition-all group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 shadow-sm"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border ${item.badgeColor}`}>
                  {item.category}
                </span>
                <div className="p-1 rounded-md bg-[#10131A] border border-[#282D38] group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white mb-0.5">
                {item.title}
              </span>
              <p className="text-[10.5px] text-[#9CA3AF] line-clamp-2 leading-relaxed">
                {item.prompt}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Navigation Buttons for Evaluators */}
      {onSelectView && (
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 w-full pt-0.5">
          <button
            type="button"
            onClick={() => onSelectView('compare')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:from-purple-800/50 hover:to-indigo-800/50 text-purple-200 border border-purple-500/30 hover:border-purple-400/50 transition-all shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <span>⚖️</span>
            <span>Launch Dual-Model Comparison</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectView('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#151923] hover:bg-[#1E2330] text-slate-300 hover:text-white border border-[#282D38] hover:border-slate-600 transition-all shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <span>⚙️</span>
            <span>Configure Settings & Custom Instructions</span>
          </button>
        </div>
      )}
    </div>
  );
}
