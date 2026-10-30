import React from 'react';
import { ConnectionStatus } from './ConnectionStatus';

export function ChatHeader({
  activeTitle = 'New Conversation',
  selectedModelName = 'GPT-4o',
  onToggleSidebar,
  healthStatus,
  onCheckHealth,
  onOpenApiKeyModal,
}) {
  return (
    <header className="h-14 border-b border-[#282D38] bg-[#10131A]/90 backdrop-blur-sm px-4 flex items-center justify-between shrink-0 z-10 select-none">
      <div className="flex items-center gap-3 min-w-0">
        {/* Toggle Sidebar Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Toggle Sidebar"
          aria-label="Toggle navigation sidebar"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#151923] border border-transparent hover:border-[#282D38] transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        {/* Current Conversation Info */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-[#F3F4F6] truncate max-w-xs sm:max-w-md">
            {activeTitle}
          </h2>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#151923] text-purple-400 border border-[#282D38]">
            {selectedModelName}
          </span>
        </div>
      </div>

      {/* Right Controls: API Key Discovery Trigger & Health Status */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenApiKeyModal}
          title="Add Custom API Key & Discover Models"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 hover:text-purple-200 border border-purple-800/50 hover:border-purple-600/60 transition-all shadow-sm cursor-pointer"
        >
          <span>🔑</span>
          <span className="hidden sm:inline">Add Key</span>
        </button>

        <div className="hidden sm:block">
          <ConnectionStatus status={healthStatus} onRefresh={onCheckHealth} compact />
        </div>
      </div>
    </header>
  );
}
