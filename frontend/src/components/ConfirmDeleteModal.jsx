import React, { useEffect } from 'react';

export function ConfirmDeleteModal({
  isOpen,
  conversationTitle,
  onConfirm,
  onCancel,
  isDeleting = false,
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (!isOpen) return;
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, isDeleting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-[#10131A] border border-[#282D38] rounded-2xl shadow-2xl overflow-hidden p-6 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Delete Conversation?</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="text-slate-200 font-semibold truncate block mt-0.5">
                "{conversationTitle || 'Untitled Session'}"
              </span>
              This action cannot be undone and will erase all associated messages from persistent SQLite storage.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-[#151923] hover:bg-[#1E2330] border border-[#282D38] hover:border-slate-600 transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-500 transition-all cursor-pointer shadow-sm shadow-red-500/20 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Permanently</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
