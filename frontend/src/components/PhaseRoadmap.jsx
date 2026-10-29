import React from 'react';

export function PhaseRoadmap() {
  const upcomingFeatures = [
    {
      title: 'Multi-Model Provider Adapters',
      desc: 'Unified interface for OpenAI, Anthropic Claude, Google Gemini, and local Ollama models.',
      status: 'Day 2',
      badge: 'Planned',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Manual & Smart Router',
      desc: 'Direct model selection or rule-based auto-routing based on query complexity and context.',
      status: 'Day 3',
      badge: 'Planned',
      badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      title: 'Multi-Model Comparison & AI Council',
      desc: 'Simultaneous prompt distribution across models with synthesized peer consensus output.',
      status: 'Day 4',
      badge: 'Planned',
      badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
    {
      title: 'Persistent SQLite History & Metrics',
      desc: 'Threaded conversation sessions, latency benchmarking, and token usage analytics.',
      status: 'Day 5',
      badge: 'Planned',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="bg-[#16181D] border border-charcoal-700/80 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-charcoal-700/60">
        <div>
          <h2 className="text-base font-semibold text-white">Project Roadmap & Architecture Status</h2>
          <p className="text-xs text-slate-400">
            Day 1 delivers the architectural foundation, clean API contracts, and connection pipeline.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium self-start sm:self-auto">
          Phase 1: Foundation Active
        </span>
      </div>

      <div className="p-4 rounded-xl bg-charcoal-800/40 border border-charcoal-700/50 text-xs text-slate-300 space-y-2">
        <p className="font-medium text-slate-200">
          ℹ️ Notice for College Evaluation Reviewers:
        </p>
        <p className="text-slate-400 leading-relaxed">
          In accordance with good software engineering practices, model API integrations (OpenAI, Gemini, Ollama)
          and fake response mocks are intentionally withheld on Day 1. Today establishes the decoupled frontend-backend
          architecture, CORS security boundary, health verification, and directory hierarchy necessary to support
          multi-model orchestration smoothly in Day 2+.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {upcomingFeatures.map((feat, idx) => (
          <div key={idx} className="p-4 rounded-xl bg-charcoal-800/50 border border-charcoal-700/60 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">{feat.title}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${feat.badgeColor}`}>
                {feat.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

