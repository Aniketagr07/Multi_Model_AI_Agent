import React from 'react';

const SUGGESTIONS = [
  {
    title: 'Explain a programming concept',
    prompt: 'Explain how Groq LPUs differ from GPUs for LLM inference and why SRAM bandwidth matters.',
    icon: (
      <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    title: 'Help me debug some code',
    prompt: 'Help me debug an asynchronous deadlock in a Python FastAPI application handling concurrent HTTP client requests.',
    icon: (
      <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="14" y1="4" x2="10" y2="20" />
      </svg>
    ),
  },
  {
    title: 'Summarize a document',
    prompt: 'Summarize the primary architectural trade-offs between monolithic neural networks and modular multi-agent LLM systems.',
    icon: (
      <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
];

export function WelcomeScreen({ onSelectPrompt }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-3xl mx-auto w-full select-none">
      {/* Brand Icon & Welcome Tagline */}
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 shadow-lg shadow-purple-500/20 mb-2">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F3F4F6]">
          Your AI workspace, all in one place.
        </h1>
        <p className="text-sm text-[#9CA3AF] max-w-lg mx-auto leading-relaxed">
          Ask a question, explore ideas, or switch models to compare answers from different AI architectures.
        </p>
      </div>

      {/* Suggestion Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-6">
        {SUGGESTIONS.map((item, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="flex flex-col text-left p-4 rounded-xl bg-[#151923] hover:bg-[#1E2330] border border-[#282D38] hover:border-[#8B5CF6]/50 transition-all group cursor-pointer"
          >
            <div className="p-2 rounded-lg bg-[#10131A] border border-[#282D38] w-fit mb-3 group-hover:scale-105 transition-transform">
              {item.icon}
            </div>
            <span className="text-xs font-semibold text-slate-200 group-hover:text-white mb-1">
              {item.title}
            </span>
            <p className="text-[11px] text-[#9CA3AF] line-clamp-2 leading-relaxed">
              {item.prompt}
            </p>
          </button>
        ))}
      </div>

      {/* College Project Evaluation Note */}
      <div className="w-full p-3.5 rounded-xl bg-[#10131A] border border-[#282D38]/80 text-[11px] text-slate-400 flex items-start gap-3">
        <span className="text-purple-400 font-bold shrink-0 mt-0.5">ℹ️ Day 4 Multi-Model Status:</span>
        <div className="leading-relaxed">
          Multi-model routing is live! Switch between <strong>Google Gemini (Gemini 1.5 Flash / Pro)</strong> and <strong>Groq Cloud (Llama 3.1 8B / Mixtral 8x7B)</strong> using the model selector at the bottom left. Each response displays its provider and round-trip latency.
        </div>
      </div>
    </div>
  );
}
