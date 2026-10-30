import React, { useState, useRef, useEffect } from 'react';

export function ChatHeader({
  user = null,
  onToggleSidebar,
  onOpenAuth,
  onOpenSettings,
  onLogout,
  onDeleteAccount,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const displayName = user ? user.username : 'Guest User';

  return (
    <header className="h-13 border-b border-[#282D38]/80 bg-[#10131A]/90 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Left: Sidebar Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Toggle Sidebar (Ctrl + B)"
          aria-label="Toggle navigation sidebar"
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-[#151923] border border-transparent hover:border-[#282D38] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      {/* Center: Clean & Uncluttered */}
      <div className="flex-1" />

      {/* Right: Only Account Control [ User Profile Icon | Guest User / Username ▼ ] */}
      <div className="relative inline-block text-left" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={isMenuOpen}
          aria-label={`Account menu for ${displayName}`}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
            isMenuOpen
              ? 'bg-[#151923] text-white border border-purple-500/60 shadow-xs'
              : 'bg-[#12151F] hover:bg-[#181C28] text-slate-300 hover:text-white border border-[#282D38]'
          }`}
        >
          {/* User Profile Avatar / Icon */}
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 text-[10px] font-bold shadow-xs">
            {user ? (
              user.username.charAt(0).toUpperCase()
            ) : (
              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>

          {/* Username / Guest User Label */}
          <span className="font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-[160px]">
            {displayName}
          </span>

          {/* Small Caret / Dropdown Indicator */}
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isMenuOpen ? 'rotate-180' : ''
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Account Menu Popover */}
        {isMenuOpen && (
          <div
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-2 z-50 animate-fade-in backdrop-blur-md"
          >
            {/* User Profile Summary Header */}
            <div className="px-3 py-2.5 mb-1.5 rounded-xl bg-[#151923] border border-[#282D38]/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {user ? user.username.charAt(0).toUpperCase() : 'G'}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    {user ? user.username : 'Guest User'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {user ? user.email : 'Local Session (Unregistered)'}
                  </div>
                </div>
              </div>
              {!user && (
                <div className="mt-2 text-[10px] text-amber-300/90 leading-tight">
                  Guest chats remain on this device. Sign in to synchronize history.
                </div>
              )}
            </div>

            {/* Account Actions */}
            <div className="space-y-0.5">
              {!user ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('signin');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#151923] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>🔑</span>
                    <span>Sign In</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenAuth) onOpenAuth('register');
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-600/20 transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>✨</span>
                    <span>Create Account</span>
                  </button>
                </>
              ) : (
                <>
                  {onOpenSettings && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#151923] transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <span>⚙️</span>
                      <span>Account Settings</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#151923] transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>🚪</span>
                    <span>Sign Out</span>
                  </button>

                  {onDeleteAccount && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (window.confirm('Are you sure you want to permanently delete your account and all associated conversations? This action cannot be undone.')) {
                          onDeleteAccount();
                        }
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-200 hover:bg-red-950/40 transition-colors flex items-center gap-2 cursor-pointer border-t border-[#282D38]/60 mt-1 pt-1.5"
                    >
                      <span>🗑️</span>
                      <span>Delete Account & Data</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
