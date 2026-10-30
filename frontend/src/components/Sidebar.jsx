import React, { useState, useRef, useEffect } from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export function Sidebar({
  isOpen,
  onClose,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onPinConversation,
  onArchiveConversation,
  onExportConversation,
  searchQuery = '',
  onSearchChange,
  healthStatus,
  onCheckHealth,
  activeView = 'chat',
  onSelectView,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }
  const [isDeleting, setIsDeleting] = useState(false);

  // Export menu dropdown state: convId or null
  const [exportMenuId, setExportMenuId] = useState(null);
  const exportMenuRef = useRef(null);

  // Collapsible archived section
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuId(null);
      }
    }
    if (exportMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuId]);

  // Rename handlers
  const handleStartRename = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title || '');
    setExportMenuId(null);
  };

  const handleSaveRename = (convId, e) => {
    if (e) e.stopPropagation();
    if (onRenameConversation && editTitle.trim()) {
      onRenameConversation(convId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  // Delete modal handlers
  const handleOpenDeleteModal = (conv, e) => {
    e.stopPropagation();
    setExportMenuId(null);
    setDeleteTarget({ id: conv.id, title: conv.title });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDeleteConversation) return;
    setIsDeleting(true);
    try {
      await onDeleteConversation(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Pin / Archive handlers
  const handleTogglePin = (conv, e) => {
    e.stopPropagation();
    if (onPinConversation) {
      onPinConversation(conv.id, !conv.isPinned);
    }
  };

  const handleToggleArchive = (conv, e) => {
    e.stopPropagation();
    if (onArchiveConversation) {
      onArchiveConversation(conv.id, !conv.isArchived);
    }
  };

  // Export handler
  const handleExport = async (convId, format, e) => {
    e.stopPropagation();
    setExportMenuId(null);
    if (onExportConversation) {
      try {
        await onExportConversation(convId, format);
      } catch (err) {
        console.error('Export error:', err);
      }
    }
  };

  // Split conversations into sections
  const pinnedConversations = conversations.filter(c => c.isPinned && !c.isArchived);
  const recentConversations = conversations.filter(c => !c.isPinned && !c.isArchived);
  const archivedConversations = conversations.filter(c => c.isArchived);

  // Render a single conversation item
  const renderConversationItem = (conv, isArchivedSection = false) => {
    const isActive = conv.id === activeConversationId;
    const isEditing = editingId === conv.id;
    const isExportOpen = exportMenuId === conv.id;

    return (
      <div
        key={conv.id}
        className={`group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer ${
          isActive && activeView === 'chat'
            ? 'bg-[#151923] text-white border border-[#282D38]'
            : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923]/60 border border-transparent'
        }`}
        onClick={() => {
          if (isEditing) return;
          if (onSelectView) onSelectView('chat');
          onSelectConversation(conv.id);
          if (window.innerWidth < 768) onClose();
        }}
      >
        <div className="flex items-center gap-2 min-w-0 pr-16 flex-1">
          {/* Status Icon: Pin or Chat */}
          {conv.isPinned && !conv.isArchived ? (
            <svg
              className="w-3.5 h-3.5 text-purple-400 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          ) : isArchivedSection ? (
            <svg
              className="w-3.5 h-3.5 text-slate-500 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          ) : (
            <svg
              className={`w-3.5 h-3.5 shrink-0 ${isActive && activeView === 'chat' ? 'text-purple-400' : 'text-slate-500'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}

          {isEditing ? (
            <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveRename(conv.id, e);
                  if (e.key === 'Escape') handleCancelRename(e);
                }}
                autoFocus
                className="w-full bg-[#0B0D12] text-white text-xs px-1.5 py-0.5 rounded border border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={e => handleSaveRename(conv.id, e)}
                title="Save title"
                className="p-1 text-emerald-400 hover:text-emerald-300"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={handleCancelRename}
                title="Cancel"
                className="p-1 text-slate-400 hover:text-slate-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate font-medium">{conv.title || 'Untitled Session'}</span>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>{conv.dateLabel}</span>
                {typeof conv.messageCount === 'number' && conv.messageCount > 0 && (
                  <span>• {conv.messageCount} msgs</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Toolbar on Hover */}
        {!isEditing && (
          <div
            className={`absolute right-1.5 flex items-center gap-0.5 ${
              isExportOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity bg-[#151923]/95 px-1 py-0.5 rounded-md shadow-sm border border-[#282D38]/60`}
            onClick={e => e.stopPropagation()}
          >
            {/* Pin Toggle Button (Only for unarchived) */}
            {!isArchivedSection && onPinConversation && (
              <button
                type="button"
                title={conv.isPinned ? 'Unpin conversation' : 'Pin to top'}
                onClick={e => handleTogglePin(conv, e)}
                className={`p-1 rounded transition-colors ${
                  conv.isPinned
                    ? 'text-purple-400 hover:text-purple-300 hover:bg-[#1E2330]'
                    : 'text-slate-400 hover:text-purple-300 hover:bg-[#1E2330]'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={conv.isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
              </button>
            )}

            {/* Rename Button */}
            {onRenameConversation && (
              <button
                type="button"
                title="Rename conversation"
                onClick={e => handleStartRename(conv, e)}
                className="p-1 text-slate-400 hover:text-purple-300 hover:bg-[#1E2330] rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
            )}

            {/* Export Dropdown Trigger */}
            {onExportConversation && (
              <div className="relative">
                <button
                  type="button"
                  title="Export conversation"
                  onClick={e => {
                    e.stopPropagation();
                    setExportMenuId(prev => (prev === conv.id ? null : conv.id));
                  }}
                  className={`p-1 rounded transition-colors ${
                    isExportOpen
                      ? 'text-purple-400 bg-[#1E2330]'
                      : 'text-slate-400 hover:text-purple-300 hover:bg-[#1E2330]'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>

                {/* Export Options Menu */}
                {isExportOpen && (
                  <div
                    ref={exportMenuRef}
                    className="absolute right-0 bottom-full mb-1 w-36 rounded-lg bg-[#10131A] border border-[#282D38] shadow-xl p-1 z-50 text-[11px] animate-in fade-in duration-100"
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[#282D38]/60 mb-0.5">
                      Export As
                    </div>
                    <button
                      type="button"
                      onClick={e => handleExport(conv.id, 'markdown', e)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#151923] text-slate-200 hover:text-purple-300 flex items-center justify-between"
                    >
                      <span>Markdown</span>
                      <span className="text-[10px] text-purple-400 font-mono">.md</span>
                    </button>
                    <button
                      type="button"
                      onClick={e => handleExport(conv.id, 'text', e)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#151923] text-slate-200 hover:text-purple-300 flex items-center justify-between"
                    >
                      <span>Plain Text</span>
                      <span className="text-[10px] text-slate-400 font-mono">.txt</span>
                    </button>
                    <button
                      type="button"
                      onClick={e => handleExport(conv.id, 'json', e)}
                      className="w-full text-left px-2 py-1 rounded hover:bg-[#151923] text-slate-200 hover:text-purple-300 flex items-center justify-between"
                    >
                      <span>JSON Data</span>
                      <span className="text-[10px] text-emerald-400 font-mono">.json</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Archive / Restore Button */}
            {onArchiveConversation && (
              <button
                type="button"
                title={conv.isArchived ? 'Restore to recent list' : 'Archive conversation'}
                onClick={e => handleToggleArchive(conv, e)}
                className="p-1 text-slate-400 hover:text-amber-400 hover:bg-[#1E2330] rounded transition-colors"
              >
                {conv.isArchived ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                )}
              </button>
            )}

            {/* Delete Button */}
            {onDeleteConversation && (
              <button
                type="button"
                title="Delete conversation"
                onClick={e => handleOpenDeleteModal(conv, e)}
                className="p-1 text-slate-400 hover:text-red-400 hover:bg-[#1E2330] rounded transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 flex flex-col w-72 bg-[#10131A] border-r border-[#282D38] transition-transform duration-300 ease-in-out shrink-0 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-72'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#282D38]/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/20">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-[#F3F4F6]">OmniAI</h1>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                  Day 7+
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">Intelligent Multi-Model</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#151923]"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Action: New Chat Button */}
        <div className="p-3 pb-2">
          <button
            type="button"
            onClick={() => {
              if (onSelectView) onSelectView('chat');
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#151923] hover:bg-[#1E2330] text-[#F3F4F6] border border-[#282D38] hover:border-[#8B5CF6]/50 transition-all font-medium text-xs shadow-sm hover:shadow-purple-500/5 group cursor-pointer"
          >
            <svg className="w-4 h-4 text-purple-400 group-hover:rotate-90 transition-transform duration-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Chat</span>
          </button>
        </div>

        {/* TASK 1: Search Bar */}
        <div className="px-3 pb-2">
          <div className="relative">
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Search title & messages..."
              className="w-full bg-[#151923] text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-8 pr-7 py-1.5 border border-[#282D38] focus:border-purple-500/60 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange && onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Secondary Navigation */}
        <div className="px-3 pb-2 border-b border-[#282D38]/60 space-y-1">
          <button
            type="button"
            onClick={() => {
              if (onSelectView) onSelectView('chat');
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeView === 'chat'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923]/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${activeView === 'chat' ? 'text-purple-400' : 'text-slate-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Chat</span>
            </div>
            {activeView === 'chat' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onSelectView) onSelectView('compare');
              if (window.innerWidth < 768) onClose();
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeView === 'compare'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923]/50 border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${activeView === 'compare' ? 'text-purple-400' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span>Compare Models</span>
            </div>
            {activeView === 'compare' && <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>}
          </button>
        </div>

        {/* TASK 3: Conversation History List Organized into Pinned, Recent, and Archived */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Active Search Result State */}
          {searchQuery && (
            <div className="px-1 flex items-center justify-between text-[11px] text-purple-400 font-medium">
              <span>Search results: {conversations.length}</span>
              <button
                type="button"
                onClick={() => onSearchChange && onSearchChange('')}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}

          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 italic">
              {searchQuery ? `No sessions matching "${searchQuery}"` : 'No conversations yet'}
            </div>
          ) : (
            <>
              {/* SECTION 1: 📌 PINNED CONVERSATIONS */}
              {pinnedConversations.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 pb-1 flex items-center justify-between text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <span>📌</span>
                      <span>Pinned</span>
                    </span>
                    <span className="text-[10px] font-mono bg-purple-500/10 px-1 rounded text-purple-300">
                      {pinnedConversations.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {pinnedConversations.map(conv => renderConversationItem(conv, false))}
                  </div>
                </div>
              )}

              {/* SECTION 2: 🕒 RECENT CONVERSATIONS */}
              {recentConversations.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 pb-1 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <span>🕒</span>
                      <span>Recent</span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {recentConversations.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {recentConversations.map(conv => renderConversationItem(conv, false))}
                  </div>
                </div>
              )}

              {/* SECTION 3: 📦 ARCHIVED CONVERSATIONS (Collapsible) */}
              {archivedConversations.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-[#282D38]/60">
                  <button
                    type="button"
                    onClick={() => setIsArchivedExpanded(prev => !prev)}
                    className="w-full px-2 py-1 flex items-center justify-between text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>📦</span>
                      <span>Archived</span>
                      <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1 rounded border border-amber-500/20 lowercase">
                        {archivedConversations.length}
                      </span>
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                        isArchivedExpanded ? 'rotate-180' : ''
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isArchivedExpanded && (
                    <div className="space-y-1 pl-1 border-l border-[#282D38]/80 mt-1">
                      {archivedConversations.map(conv => renderConversationItem(conv, true))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar Footer: Health Status & Version */}
        <div className="p-3 border-t border-[#282D38]/80 space-y-2 bg-[#0B0D12]/50">
          <ConnectionStatus status={healthStatus} onRefresh={onCheckHealth} />

          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
            <span>OmniAI • B.Tech AI & ML</span>
            <span className="font-mono text-slate-400">v0.1.0 (Day 7+)</span>
          </div>
        </div>
      </aside>

      {/* Permanent Deletion Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        conversationTitle={deleteTarget?.title}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
