import React from 'react';
import { ConnectionStatus } from './ConnectionStatus';

export function ChatHeader({
  activeTitle = 'New Conversation',
  selectedModelName = 'Gemini 3.6 Flash',
  onToggleSidebar,
  healthStatus,
  onCheckHealth,
  onOpenApiKeyModal,
  onOpenSettings,
  activeView = 'chat',
  onSelectView,
}) {
  return (
    <header className="h-14 border-b border-[#282D38] bg-[#10131A]/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 select-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Toggle Sidebar Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Toggle Sidebar (Ctrl + B)"
          aria-label="Toggle navigation sidebar"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#151923] border border-transparent hover:border-[#282D38] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        {/* Current Conversation Info */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-xs sm:text-sm font-semibold text-[#F3F4F6] truncate max-w-[140px] sm:max-w-xs md:max-w-sm">
            {activeTitle}
          </h2>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#151923] text-purple-300 border border-[#282D38] font-medium">
            {selectedModelName}
          </span>
        </div>
      </div>

      {/* Center Navigation Switcher for Evaluators (Chat / Compare / Settings) */}
      {onSelectView && (
        <div className="hidden md:flex items-center gap-1 bg-[#0B0D12] p-1 rounded-xl border border-[#282D38] shadow-inner">
          <button
            type="button"
            onClick={() => onSelectView('chat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              activeView === 'chat'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <span>💬</span>
            <span>Chat</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectView('compare')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              activeView === 'compare'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <span>⚖️</span>
            <span>Compare</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectView('settings')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              activeView === 'settings'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <span>⚙️</span>
            <span>Settings</span>
          </button>
        </div>
      )}

      {/* Right Controls: API Key Discovery Trigger & Health Status */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenApiKeyModal}
          title="Add Custom API Key & Discover Models (BYOK)"
          aria-label="Connect API Key"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 hover:text-purple-200 border border-purple-800/50 hover:border-purple-600/60 transition-all shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <span>🔑</span>
          <span className="hidden sm:inline">Add Key</span>
        </button>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings & Personalization"
            aria-label="Open settings"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#151923] border border-transparent hover:border-[#282D38] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}

        <div className="hidden sm:block">
          <ConnectionStatus status={healthStatus} onRefresh={onCheckHealth} compact />
        </div>
      </div>
    </header>
  );
}
