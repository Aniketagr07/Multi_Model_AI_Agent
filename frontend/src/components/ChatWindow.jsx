import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';

export function ChatWindow({
  messages = [],
  isLoading = false,
  selectedModelName = 'GPT-4o',
  onSelectPrompt,
  onRetryMessage,
}) {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on messages update or loading state change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!messages || messages.length === 0) {
    return <WelcomeScreen onSelectPrompt={onSelectPrompt} />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-6 space-y-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRetry={onRetryMessage}
        />
      ))}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="flex items-center gap-3 max-w-4xl w-full mx-auto p-4 justify-start">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-500/20">
            <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-[11px] text-slate-400 font-medium">
              {selectedModelName} is generating response...
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
    </div>
  );
}

