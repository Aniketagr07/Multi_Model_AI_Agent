import React, { useState } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ProviderLogo } from './ModelSelector';

/**
 * Format raw model name and model ID into a shortened, human-readable model name.
 * Strips technical noise such as "(Active)", "(Latest)", "(Ultra Fast)", "(Google AI Studio)", etc.
 * Returns null if model information is unavailable (to omit rather than guessing).
 */
export function formatRespondingModelName(rawName, modelId) {
  if (!rawName && !modelId) return null;

  const id = (modelId || '').toLowerCase();

  // Known specific models
  if (id === 'gemini-3.8-flash') return 'Gemini 3.8 Flash';
  if (id === 'gemini-3.6-flash') return 'Gemini 3.6 Flash';
  if (id === 'gemini-3.5-flash') return 'Gemini 3.5 Flash';
  if (id === 'gemini-flash-lite-latest') return 'Gemini Flash Lite';
  if (id === 'gemini-1.5-pro') return 'Gemini 1.5 Pro';
  if (id === 'gemini-1.5-flash') return 'Gemini 1.5 Flash';
  if (id === 'gemini-2.0-flash') return 'Gemini 2.0 Flash';
  if (id === 'llama-3.1-8b-instant' || id === 'llama-3.1-8b' || id === 'llama-3.1') return 'Llama 3.1';
  if (id === 'llama-3.3-70b-versatile' || id === 'llama-3.3-70b' || id === 'llama-3.3') return 'Llama 3.3';
  if (id === 'mixtral-8x7b-32768' || id === 'mixtral-8x7b') return 'Mixtral 8x7B';
  if (id === 'llama-3-8b-local') return 'Llama 3';
  if (id === 'gpt-6') return 'GPT-6';

  // If rawName is 'Auto' or starts with 'Auto', and we don't have a specific resolved model, omit
  if ((rawName === 'Auto' || rawName === 'Auto (Smart Router)') && (!modelId || modelId === 'auto')) {
    return null;
  }

  let name = rawName || modelId;

  // Clean up parenthetical tags such as "(Active)", "(Latest)", "(Ultra Fast)", "(Google AI Studio)", "(Groq LPU Free Tier)", etc.
  name = name.replace(/\s*\([^)]*\)/g, '').trim();

  // Remove common API prefix if present
  name = name.replace(/^(models\/)/i, '');

  // Match common human-readable formats
  if (/^llama\s*3\.1/i.test(name)) return 'Llama 3.1';
  if (/^llama\s*3\.3/i.test(name)) return 'Llama 3.3';
  if (/^mixtral\s*8x7b/i.test(name)) return 'Mixtral 8x7B';
  if (/^gpt-?6/i.test(name)) return 'GPT-6';
  if (/claude.*sonnet/i.test(name)) return 'Claude Sonnet';

  return name || null;
}

/**
 * Resolve provider string for the provider logo icon.
 */
export function resolveProviderForModel(provider, modelId) {
  if (provider && provider !== 'auto') {
    return provider.toLowerCase();
  }
  const id = (modelId || '').toLowerCase();
  if (id.includes('gemini')) return 'gemini';
  if (id.includes('llama') || id.includes('mixtral') || id.includes('groq')) return 'groq';
  if (id.includes('gpt') || id.includes('openai')) return 'openai';
  if (id.includes('claude') || id.includes('anthropic')) return 'anthropic';
  return 'gemini';
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  onRetry,
  onRegenerate,
  isLastAssistant = false,
  showTokenMetrics = true,
}) {
  const [copiedFull, setCopiedFull] = useState(false);
  const isUser = message.sender === 'user';
  const isError = Boolean(message.isError);
  const isStreaming = Boolean(message.isStreaming);
  const isSystemNotice = Boolean(message.isNotice || message.status === 'unconnected');

  const respondingModelName = formatRespondingModelName(message.modelName, message.modelId);
  const resolvedProvider = resolveProviderForModel(message.provider, message.modelId);

  const handleCopyFull = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2000);
    } catch (err) {
      console.warn('Failed to copy message to clipboard:', err);
    }
  };

  const isGroq = message.provider === 'groq' ||
    (message.modelName && (message.modelName.includes('Llama') || message.modelName.includes('Mixtral')));

  return (
    <article
      className={`flex gap-3 max-w-4xl w-full mx-auto p-3 sm:p-4 transition-colors group ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md mt-0.5 ${
          isError
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : isStreaming
            ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 animate-pulse shadow-purple-500/30 ring-2 ring-purple-500/40'
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
          ) : isStreaming ? (
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
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
        className={`flex flex-col space-y-1 max-w-[88%] sm:max-w-[82%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* User Author Attribution for Collaborative Conversations */}
        {isUser && message.author_name && (
          <div className="flex items-center gap-1.5 text-[11px] text-purple-300 font-medium px-1 mb-0.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            <span>{message.author_name}</span>
          </div>
        )}

        {/* Compact, subtle model attribution immediately above response bubble */}
        {!isUser && !isError && (respondingModelName || isStreaming) && (
          <div className="flex items-center gap-1.5 px-0.5 text-xs text-slate-300 font-medium select-none mb-0.5">
            {respondingModelName ? (
              <>
                <ProviderLogo provider={resolvedProvider} className="w-3.5 h-3.5" />
                <span className="truncate">{respondingModelName}</span>
              </>
            ) : isStreaming ? (
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
                <span>Resolving model...</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Clean Message Content Box */}
        <div
          className={`p-3.5 sm:p-4 rounded-2xl w-full transition-all ${
            isUser
              ? 'bg-[#1E2330] text-[#F3F4F6] border border-[#282D38] rounded-tr-sm'
              : isError
              ? 'bg-red-950/20 text-red-200 border border-red-500/30 rounded-tl-sm'
              : isSystemNotice
              ? 'bg-[#151923] border border-purple-500/30 text-[#F3F4F6] rounded-tl-sm'
              : 'bg-[#151923] text-[#F3F4F6] border border-[#282D38] rounded-tl-sm shadow-md'
          }`}
        >
          {/* Secure Markdown Rendering */}
          <MarkdownRenderer
            content={message.content}
            isStreaming={isStreaming}
          />

          {/* Error Retry Action */}
          {isError && onRetry && message.originalUserMessage && (
            <div className="mt-3 pt-3 border-t border-red-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-red-400 text-[11px]">
                Target: {respondingModelName || message.modelName || 'Model'}
              </span>
              <button
                type="button"
                onClick={() => onRetry(message.originalUserMessage, message.modelId, message.effort)}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/40 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Retry Message</span>
              </button>
            </div>
          )}
        </div>

        {/* Assistant Action Bar (Copy & Regenerate) */}
        {!isUser && !isError && !isStreaming && message.content && (
          <div className="flex items-center gap-2 pt-0.5 px-1 opacity-75 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopyFull}
              title="Copy entire response"
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded-md bg-[#10131A] hover:bg-[#151923] border border-[#282D38] transition-colors cursor-pointer"
            >
              {copiedFull ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>

            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message)}
                title="Regenerate this response"
                className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-purple-300 px-2 py-1 rounded-md bg-[#10131A] hover:bg-[#151923] border border-[#282D38] transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
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
});
