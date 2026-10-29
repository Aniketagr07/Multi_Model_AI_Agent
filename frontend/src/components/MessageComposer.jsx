import React, { useRef, useEffect } from 'react';
import { ModelSelector } from './ModelSelector';

export function MessageComposer({
  input,
  setInput,
  onSend,
  isLoading,
  selectedModelId,
  onSelectModel,
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
          placeholder="Ask anything or request code... (Shift + Enter for new line)"
          className="w-full bg-transparent resize-none text-sm text-[#F3F4F6] placeholder-slate-500 focus:outline-none leading-relaxed min-h-[44px] max-h-[160px] px-1 py-1"
        />

        {/* Bottom Toolbar: Model Selector & Send Button */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#282D38]/60">
          {/* Model Selector component */}
          <div className="flex items-center gap-2">
            <ModelSelector
              selectedModelId={selectedModelId}
              onSelectModel={onSelectModel}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-3">
            {/* Keyboard shortcut hint */}
            <span className="hidden sm:inline-block text-[11px] text-slate-500 select-none">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#10131A] border border-[#282D38] text-[10px]">Enter</kbd> to send
            </span>

            {/* Send Button */}
            <button
              type="button"
              onClick={onSend}
              disabled={isSendDisabled}
              aria-label="Send message"
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#8B5CF6] shadow-sm shadow-purple-500/20 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
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
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

