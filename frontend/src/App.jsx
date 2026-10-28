import React from 'react';
import { Header } from './components/Header';
import { StatusIndicator } from './components/StatusIndicator';
import { PhaseRoadmap } from './components/PhaseRoadmap';
import { useHealthCheck } from './hooks/useHealthCheck';

export default function App() {
  const { status, data, error, lastChecked, checkHealth } = useHealthCheck();

  return (
    <div className="min-h-screen bg-[#111215] text-slate-100 flex flex-col font-sans">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        {/* Hero section */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            System Initialization & Environment Verification
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Welcome to the developer workspace for <strong className="text-slate-200">OmniAI</strong>.
            This interface monitors the active FastAPI backend service and outlines the multi-model architecture.
          </p>
        </div>

        {/* Backend Connectivity Status Indicator */}
        <StatusIndicator
          status={status}
          data={data}
          error={error}
          lastChecked={lastChecked}
          onCheckAgain={checkHealth}
        />

        {/* Next Development Phases */}
        <PhaseRoadmap />
      </main>

      <footer className="border-t border-charcoal-700/60 bg-[#16181D]/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>OmniAI • B.Tech Artificial Intelligence and Machine Learning</span>
          <span>Target Deadline: November 10, 2026</span>
        </div>
      </footer>
    </div>
  );
}
