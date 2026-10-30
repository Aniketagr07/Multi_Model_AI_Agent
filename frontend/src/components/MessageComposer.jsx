import React, { useRef, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';
import { EffortSelector } from './EffortSelector';

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
}) {
  const textareaRef = useRef(null);

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
      if (!isLoading && input.trim()) {
        onSend();
      }
    }
  };

  const isSendDisabled = isLoading || !input.trim();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-2">
      <div className="rounded-2xl bg-[#151923] border border-[#282D38] shadow-2xl focus-within:border-[#8B5CF6]/70 focus-within:ring-1 focus-within:ring-[#8B5CF6]/50 transition-all p-3">
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
              : "Ask anything or request code... (Shift + Enter for new line)"
          }
          className="w-full bg-transparent resize-none text-sm text-[#F3F4F6] placeholder-slate-500 focus:outline-none leading-relaxed min-h-[44px] max-h-[160px] px-1 py-1 disabled:opacity-60"
        />

        {/* Bottom Toolbar: Model Selector, Effort, Stop & Send Button */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#282D38]/60">
          {/* Model Selector, Effort Selector & API Key Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <ModelSelector
              selectedModelId={selectedModelId}
              onSelectModel={onSelectModel}
              disabled={isLoading}
              customModels={customModels}
              onOpenApiKeyModal={onOpenApiKeyModal}
            />
            <EffortSelector
              selectedEffort={effort}
              onSelectEffort={onSelectEffort}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              title="Connect Your Own API Key & Fetch Models"
              className="px-2 py-1.5 rounded-xl text-xs bg-[#151923] hover:bg-[#1E2330] text-purple-300 hover:text-white border border-[#282D38] hover:border-purple-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔑</span>
              <span className="hidden sm:inline font-medium">Add Key</span>
            </button>
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
