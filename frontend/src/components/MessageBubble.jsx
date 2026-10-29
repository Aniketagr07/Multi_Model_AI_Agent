import React, { useState } from 'react';

/**
 * Helper to render message content with support for code blocks (```code```)
 * and preserve line breaks without external heavy dependencies.
 */
function FormattedContent({ text }) {
  if (!text) return null;

  // Split on code block delimiters: ```[language]\n...\n```
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-[#F3F4F6] break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          // Extract language (if any) and code body
          const lines = part.slice(3, -3).trim().split('\n');
          let language = 'code';
          let codeContent = part.slice(3, -3);

          if (lines[0] && !lines[0].includes(' ') && lines.length > 1) {
            language = lines[0].trim();
            codeContent = lines.slice(1).join('\n');
          }

          return <CodeBlock key={index} code={codeContent.trim()} language={language} />;
        }

        // Render normal paragraph text with line breaks preserved
        return (
          <p key={index} className="whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy code to clipboard', err);
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#282D38] bg-[#0B0D12] text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#10131A] border-b border-[#282D38] text-slate-400">
        <span className="font-mono text-[11px] uppercase tracking-wider text-purple-400 font-semibold">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] hover:text-white px-2 py-0.5 rounded hover:bg-[#151923] transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto font-mono text-[12px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MessageBubble({ message, onRetry }) {
  const isUser = message.sender === 'user';
  const isError = Boolean(message.isError);
  const isSystemNotice = Boolean(message.isNotice || message.status === 'unconnected');

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  // Determine distinctive badge styling per provider
  const isGroq = message.provider === 'groq' ||
    (message.modelName && (message.modelName.includes('Llama') || message.modelName.includes('Mixtral')));

  const badgeStyle = isError
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : isGroq
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    : 'bg-blue-500/10 text-blue-400 border-blue-500/30';

  return (
    <article
      className={`flex gap-3 max-w-4xl w-full mx-auto p-4 transition-colors ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md mt-0.5 ${
          isError
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : isGroq
            ? 'bg-gradient-to-tr from-amber-500 to-orange-600 shadow-amber-500/20'
            : 'bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 shadow-purple-500/20'
        }`}>
          {isError ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          )}
        </div>
      )}

      {/* Bubble Container */}
      <div
        className={`flex flex-col space-y-1.5 max-w-[85%] sm:max-w-[78%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Header tag: Model name, latency & timestamp */}
        <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] px-1 flex-wrap">
          <span className="font-semibold text-slate-300">
            {isUser ? 'You' : message.modelName || 'OmniAI Assistant'}
          </span>
          {message.modelTag && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${badgeStyle}`}>
              {message.modelTag}
            </span>
          )}
          {message.routed && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
              🎯 Auto: {message.routingCategory ? message.routingCategory.toUpperCase() : 'ROUTED'}
            </span>
          )}
          {message.fallbackUsed && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
              ⚠️ Fallback Model
            </span>
          )}
          {typeof message.latencyMs === 'number' && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              ⚡ {message.latencyMs}ms
            </span>
          )}
          {formattedTime && <span className="text-slate-500">• {formattedTime}</span>}
        </div>

        {/* Content Box */}
        <div
          className={`p-4 rounded-2xl ${
            isUser
              ? 'bg-[#1E2330] text-[#F3F4F6] border border-[#282D38] rounded-tr-sm'
              : isError
              ? 'bg-red-950/20 text-red-200 border border-red-500/30 rounded-tl-sm'
              : isSystemNotice
              ? 'bg-[#151923] border border-purple-500/30 text-[#F3F4F6] rounded-tl-sm'
              : 'bg-[#151923] text-[#F3F4F6] border border-[#282D38] rounded-tl-sm'
          }`}
        >
          <FormattedContent text={message.content} />

          {/* Explainable Routing Rationale Banner */}
          {message.routingExplanation && (
            <div className="mt-3 pt-2.5 border-t border-[#282D38]/80 text-[11px] text-purple-300 flex items-start gap-2 bg-[#10131A]/70 px-3 py-2 rounded-xl border border-purple-500/20">
              <span className="shrink-0 text-purple-400 text-xs">🎯</span>
              <span className="leading-relaxed">
                <strong className="text-purple-300">Routing Rationale:</strong> {message.routingExplanation}
              </span>
            </div>
          )}

          {/* Error Retry Action */}
          {isError && onRetry && message.originalUserMessage && (
            <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-red-400 text-[11px]">
                Target: {message.modelName || 'Model'}
              </span>
              <button
                type="button"
                onClick={() => onRetry(message.originalUserMessage, message.modelId)}
                className="px-2.5 py-1 rounded bg-[#10131A] hover:bg-red-900/30 text-red-300 border border-red-500/30 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Retry with {message.modelName || 'Model'}
              </button>
            </div>
          )}

          {/* Historical notice */}
          {isSystemNotice && !isError && onRetry && message.originalUserMessage && (
            <div className="mt-3 pt-3 border-t border-[#282D38] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-purple-400 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                Day 6: Intelligent Model Router
              </span>
              <button
                type="button"
                onClick={() => onRetry(message.originalUserMessage, message.modelId)}
                className="px-2.5 py-1 rounded bg-[#10131A] hover:bg-[#1E2330] text-slate-300 border border-[#282D38] text-[11px] font-medium transition-colors cursor-pointer"
              >
                Submit with Active AI Model
              </button>
            </div>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-lg bg-[#282D38] border border-[#3D4454] flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </article>
  );
}
