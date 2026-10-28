import React from 'react';

export function StatusIndicator({ status, data, error, lastChecked, onCheckAgain }) {
  const isChecking = status === 'checking';
  const isConnected = status === 'connected';
  const isDisconnected = status === 'disconnected';

  return (
    <div className="bg-[#16181D] border border-charcoal-700/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Decorative subtle ambient background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-charcoal-700/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-white">Backend Connectivity</h2>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.1)' : isDisconnected ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                borderColor: isConnected ? 'rgba(16, 185, 129, 0.25)' : isDisconnected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                color: isConnected ? '#34d399' : isDisconnected ? '#f87171' : '#fbbf24',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: isConnected ? '#10b981' : isDisconnected ? '#ef4444' : '#f59e0b',
                  boxShadow: isConnected ? '0 0 8px #10b981' : isDisconnected ? '0 0 8px #ef4444' : 'none',
                }}
              />
              <span>
                {isChecking && 'Checking...'}
                {isConnected && 'Connected'}
                {isDisconnected && 'Disconnected'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Real-time health verification via <code className="text-blue-400 bg-charcoal-800 px-1.5 py-0.5 rounded text-[11px]">/api/health</code>
          </p>
        </div>

        <button
          onClick={onCheckAgain}
          disabled={isChecking}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-xl bg-charcoal-800 hover:bg-charcoal-700 active:scale-[0.98] text-slate-200 border border-charcoal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg
            className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-blue-400' : 'text-slate-400'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {isChecking ? 'Checking...' : 'Check Connection'}
        </button>
      </div>

      {/* Connection details / payload */}
      <div className="pt-5">
        {isConnected && data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-charcoal-800/60 border border-charcoal-700/50">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Application</span>
              <span className="text-sm font-semibold text-slate-100">{data.app_name}</span>
            </div>
            <div className="p-3 rounded-xl bg-charcoal-800/60 border border-charcoal-700/50">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Version</span>
              <span className="text-sm font-semibold text-blue-400">v{data.version}</span>
            </div>
            <div className="p-3 rounded-xl bg-charcoal-800/60 border border-charcoal-700/50">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Environment</span>
              <span className="text-sm font-semibold capitalize text-emerald-400">{data.environment}</span>
            </div>
            <div className="p-3 rounded-xl bg-charcoal-800/60 border border-charcoal-700/50">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Status</span>
              <span className="text-sm font-semibold text-emerald-400 uppercase">{data.status}</span>
            </div>
          </div>
        )}

        {isDisconnected && (
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-xs text-red-300 space-y-1">
            <div className="font-semibold text-red-400 flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Backend Unreachable
            </div>
            <p className="text-red-300/80">{error || 'Failed to connect to FastAPI service at configured backend base URL.'}</p>
            <p className="text-[11px] text-slate-400 pt-1">
              Ensure FastAPI backend is running via <code className="text-slate-300 bg-charcoal-800 px-1 py-0.5 rounded">uvicorn app.main:app --reload</code> on port 8000.
            </p>
          </div>
        )}

        {isChecking && (
          <div className="py-6 flex flex-col items-center justify-center space-y-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Pinging FastAPI backend service...</p>
          </div>
        )}

        {lastChecked && (
          <div className="mt-4 text-[11px] text-slate-500 text-right">
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
