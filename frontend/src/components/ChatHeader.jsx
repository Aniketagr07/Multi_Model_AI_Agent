import React from 'react';

export function ChatHeader({
  activeTitle = '',
  onToggleSidebar,
  activeConversationId,
  presence = [],
  onOpenShare,
  currentUserRole = 'owner',
}) {
  const displayTitle = activeTitle && activeTitle.trim() ? activeTitle.trim() : 'New Chat';

  return (
    <header className="h-13 border-b border-[#282D38]/80 bg-[#10131A]/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Left: Sidebar Toggle + Current Conversation Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Toggle Sidebar (Ctrl + B)"
          aria-label="Toggle navigation sidebar"
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-[#151923] border border-transparent hover:border-[#282D38] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        {/* Current Conversation Title with Ellipsis Truncation */}
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span
            className="text-sm font-semibold text-[#F3F4F6] truncate block max-w-[220px] sm:max-w-md md:max-w-lg lg:max-w-xl"
            title={displayTitle}
          >
            {displayTitle}
          </span>
          {currentUserRole && currentUserRole !== 'owner' && (
            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide ${
              currentUserRole === 'editor'
                ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              {currentUserRole}
            </span>
          )}
        </div>
      </div>

      {/* Right Side: Active Presence & Share Button */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Presence indicator when multiple users connected */}
        {presence && presence.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#151923] border border-slate-800 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-medium">{presence.length} online</span>
          </div>
        )}

        {/* Share Button (available when conversation exists) */}
        {activeConversationId && (
          <button
            type="button"
            onClick={onOpenShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-purple-950/20"
            title="Share this conversation with others"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Share</span>
          </button>
        )}
      </div>
    </header>
  );
}
