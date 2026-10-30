import React from 'react';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DocumentAttachmentCard({
  document,
  isUploading = false,
  uploadProgress = 0,
  onRemove,
  onQuickAction,
  disabled = false,
}) {
  if (!document) return null;

  const fileType = (document.file_type || 'txt').toLowerCase();

  const typeConfig = {
    pdf: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      label: 'PDF',
      icon: (
        <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    markdown: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-400',
      label: 'MD',
      icon: (
        <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <polyline points="9 15 12 12 15 15" />
        </svg>
      ),
    },
    txt: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      label: 'TXT',
      icon: (
        <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  }[fileType] || {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    label: 'DOC',
    icon: (
      <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  };

  const quickActions = [
    { label: '📝 Summarize', prompt: 'Please provide a comprehensive summary of this document, highlighting its primary themes and conclusions.' },
    { label: '🔍 Key Points', prompt: 'Extract the most critical takeaways and key points from this document in clear bullet points.' },
    { label: '❓ Study Questions', prompt: 'Generate 5 insightful study and review questions with detailed answers based strictly on this document.' },
    { label: '💡 Explain Concepts', prompt: 'Identify and explain the most complex or technical concepts in this document in simple, clear terms.' },
  ];

  return (
    <div className="mb-2 p-2.5 rounded-xl bg-[#10131A] border border-purple-500/40 shadow-xl select-none animate-fade-in">
      {/* File Info Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.bg} border ${typeConfig.border}`}>
            {typeConfig.icon}
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-md">
                {document.filename}
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-semibold ${typeConfig.bg} ${typeConfig.border} ${typeConfig.text}`}>
                {typeConfig.label}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span>{formatBytes(document.file_size)}</span>
              {document.char_count > 0 && (
                <span>• {document.char_count.toLocaleString()} chars</span>
              )}
              {document.chunk_count > 1 && (
                <span className="hidden sm:inline">• {document.chunk_count} chunks</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Upload State or Remove Button */}
        <div className="flex items-center gap-2 shrink-0">
          {isUploading ? (
            <div className="flex items-center gap-2 text-xs text-purple-300 font-medium">
              <span className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
              <span>{uploadProgress > 0 ? `${uploadProgress}%` : 'Parsing...'}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              title="Remove attached document"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar (while uploading) */}
      {isUploading && (
        <div className="w-full bg-[#151923] h-1.5 rounded-full overflow-hidden mt-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${Math.max(5, uploadProgress)}%` }}
          />
        </div>
      )}

      {/* Quick Action Shortcuts (when upload is complete) */}
      {!isUploading && onQuickAction && (
        <div className="flex items-center gap-1.5 pt-2 mt-2 border-t border-[#282D38]/60 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">
            Quick Analysis:
          </span>
          {quickActions.map((qa, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onQuickAction(qa.prompt)}
              className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#151923] hover:bg-[#1E2330] text-purple-300 hover:text-purple-100 border border-[#282D38] hover:border-purple-500/40 transition-all cursor-pointer disabled:opacity-50"
            >
              {qa.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

