import React from 'react';

export function ChatHeader({
  activeTitle = '',
  onToggleSidebar,
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
        <div className="min-w-0 flex-1">
          <span
            className="text-sm font-semibold text-[#F3F4F6] truncate block max-w-[220px] sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl"
            title={displayTitle}
          >
            {displayTitle}
          </span>
        </div>
      </div>

      {/* Right side is kept completely clean - account moved to bottom-left sidebar */}
      <div className="shrink-0" />
    </header>
  );
}
