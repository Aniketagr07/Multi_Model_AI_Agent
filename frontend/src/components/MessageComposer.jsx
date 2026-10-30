import React, { useRef, useEffect, useState } from 'react';
import { ModelSelector } from './ModelSelector';
import { DocumentAttachmentCard } from './DocumentAttachmentCard';

export function MessageComposer({
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
  selectedModelId,
  onSelectModel,
  effort = 'medium',
  onSelectEffort,
  customModels = [],
  onOpenApiKeyModal,
  attachedDocument = null,
  isUploadingDocument = false,
  uploadProgress = 0,
  onAttachFile,
  onRemoveDocument,
  onQuickAction,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-resize textarea height as content expands
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 160; // Max ~6 lines
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Strictly prevent duplicate submissions while loading or streaming
      if (!isLoading && (input.trim() || attachedDocument)) {
        onSend();
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onAttachFile) {
      onAttachFile(file);
    }
    // Reset file input so user can re-upload same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && onAttachFile) {
      onAttachFile(droppedFile);
    }
  };

  const isSendDisabled = isLoading || isUploadingDocument || (!input.trim() && !attachedDocument);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="shrink-0 w-full max-w-4xl mx-auto px-4 pb-4 pt-2 relative"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-x-4 inset-y-2 z-30 rounded-2xl bg-[#10131A]/95 border-2 border-dashed border-purple-500 backdrop-blur-sm flex flex-col items-center justify-center gap-2 pointer-events-none animate-fade-in shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center animate-bounce">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-purple-200">
            Drop PDF, TXT, or Markdown to Attach
          </p>
          <p className="text-xs text-slate-400">
            Max file size: 10MB
          </p>
        </div>
      )}

      <div className={`rounded-2xl bg-[#151923] border ${
        isDragging ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-[#282D38]'
      } shadow-2xl focus-within:border-[#8B5CF6]/70 focus-within:ring-1 focus-within:ring-[#8B5CF6]/50 transition-all p-3`}>
        {/* Attached Document Card */}
        {(attachedDocument || isUploadingDocument) && (
          <DocumentAttachmentCard
            document={attachedDocument}
            isUploading={isUploadingDocument}
            uploadProgress={uploadProgress}
            onRemove={onRemoveDocument}
            onQuickAction={onQuickAction}
            disabled={isLoading}
          />
        )}

        {/* Multiline Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={
            isLoading
              ? "Generating response... Click Stop to halt."
              : attachedDocument
              ? `Ask a question, request summary, or choose a quick analysis for ${attachedDocument.filename}...`
              : "Ask anything, request code, or attach a document... (Shift + Enter for new line)"
          }
          className="w-full bg-transparent resize-none text-sm text-[#F3F4F6] placeholder-slate-500 focus:outline-none leading-relaxed min-h-[44px] max-h-[160px] px-1 py-1 disabled:opacity-60"
        />

        {/* Bottom Toolbar: Attachment, Model Selector, Effort, Stop & Send Button */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#282D38]/60">
          {/* Left Actions: Attachment Button, Model Selector, Effort & API Key */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploadingDocument}
              title="Attach Document (PDF, TXT, Markdown)"
              className="px-2.5 py-1.5 rounded-xl text-xs bg-[#10131A] hover:bg-[#1E2330] text-slate-300 hover:text-purple-300 border border-[#282D38] hover:border-purple-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span className="hidden sm:inline font-medium">Attach</span>
            </button>

            <ModelSelector
              selectedModelId={selectedModelId}
              onSelectModel={onSelectModel}
              effort={effort}
              onSelectEffort={onSelectEffort}
              disabled={isLoading}
              customModels={customModels}
              onOpenApiKeyModal={onOpenApiKeyModal}
            />


          </div>

          <div className="flex items-center gap-2.5">
            {/* Active Stop Generation Action */}
            {isLoading && onStop && (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 border border-red-500/40 text-xs font-medium transition-all shadow-sm shadow-red-950/50 cursor-pointer animate-pulse"
              >
                <span className="w-2 h-2 rounded-xs bg-red-400"></span>
                <span>Stop</span>
              </button>
            )}

            {/* Keyboard shortcut hint */}
            {!isLoading && (
              <span className="hidden sm:inline-block text-[11px] text-slate-500 select-none">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[#10131A] border border-[#282D38] text-[10px]">Enter</kbd> to send
              </span>
            )}

            {/* Send / Stop Button */}
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                aria-label="Stop generation"
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-red-600/90 hover:bg-red-600 active:scale-95 text-white transition-all shadow-sm shadow-red-500/30 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={isSendDisabled}
                aria-label="Send message"
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#8B5CF6] shadow-sm shadow-purple-500/20 cursor-pointer"
              >
                <svg
                  className="w-4 h-4 translate-x-0.5 -translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
