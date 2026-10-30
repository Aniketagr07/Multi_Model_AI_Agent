import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';

export function ChatWindow({
  messages = [],
  isLoading = false,
  selectedModelName = 'OmniAI Model',
  onSelectPrompt,
  onRetryMessage,
  onRegenerate,
  onSelectView,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Monitor user scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceToBottom < 100;
    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollBottom(!isNearBottom);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    shouldAutoScrollRef.current = true;
    setShowScrollBottom(false);
  }, []);

  // Auto-scroll when new messages or tokens arrive IF user hasn't scrolled up
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <WelcomeScreen onSelectPrompt={onSelectPrompt} onSelectView={onSelectView} />
      </div>
    );
  }

  // Check if an active streaming message is already showing tokens
  const isStreamingActive = messages.some((m) => m.isStreaming);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-2 sm:px-4 py-6 space-y-4 relative scroll-smooth"
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRetry={onRetryMessage}
          onRegenerate={onRegenerate}
          isLastAssistant={
            message.sender === 'assistant' &&
            index === messages.length - 1
          }
        />
      ))}

      {/* Loading state indicator (shown only while connecting before tokens stream) */}
      {isLoading && !isStreamingActive && (
        <div className="flex items-center gap-3 max-w-4xl w-full mx-auto p-4 justify-start animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-500/20">
            <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              Connecting to <strong className="text-purple-300">{selectedModelName}</strong>...
            </span>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#151923] border border-[#282D38] w-fit">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"></span>
            </div>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} className="h-4" />

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-24 right-8 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#151923]/95 hover:bg-[#1E2330] text-purple-300 text-xs font-medium border border-purple-500/30 shadow-xl backdrop-blur-md transition-all animate-bounce cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>Scroll to latest</span>
        </button>
      )}
    </div>
  );
}
