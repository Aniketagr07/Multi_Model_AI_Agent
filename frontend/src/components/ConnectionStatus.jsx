import React from 'react';

export function ConnectionStatus({ status, onRefresh, compact = false }) {
  const isConnected = status === 'connected';
  const isDisconnected = status === 'disconnected';
  const isChecking = status === 'checking';

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" title={`Backend Status: ${status}`}>
        <span
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: isConnected ? '#22C55E' : isDisconnected ? '#EF4444' : '#F59E0B',
            boxShadow: isConnected ? '0 0 6px rgba(34, 197, 94, 0.4)' : isDisconnected ? '0 0 6px rgba(239, 68, 68, 0.4)' : 'none',
          }}
        />
        <span className="text-[11px] text-slate-400 capitalize">
          {isChecking ? 'Checking...' : isConnected ? 'Connected' : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#151923] border border-[#282D38]">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${isChecking ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: isConnected ? '#22C55E' : isDisconnected ? '#EF4444' : '#F59E0B',
            boxShadow: isConnected ? '0 0 8px rgba(34, 197, 94, 0.6)' : isDisconnected ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none',
          }}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-slate-200 truncate">
            {isChecking && 'Checking Backend...'}
            {isConnected && 'FastAPI Online'}
            {isDisconnected && 'Backend Unreachable'}
          </span>
          <span className="text-[10px] text-slate-400">
            {isConnected ? 'REST API Healthy' : 'Check server on port 8000'}
          </span>
        </div>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isChecking}
          title="Verify Backend Connection"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1E2330] rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-purple-400' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>
      )}
    </div>
  );
}

