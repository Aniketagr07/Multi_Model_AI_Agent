import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS } from './ModelSelector';
import { sendCompareRequest } from '../services/api';

/**
 * Reusable Code block with Copy button
 */
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
          className="flex items-center gap-1 text-[11px] hover:text-white px-2 py-0.5 rounded hover:bg-[#151923] transition-colors cursor-pointer"
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

function FormattedContent({ text }) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-[#F3F4F6] break-words">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          let language = 'code';
          let codeContent = part.slice(3, -3);

          if (lines[0] && !lines[0].includes(' ') && lines.length > 1) {
            language = lines[0].trim();
            codeContent = lines.slice(1).join('\n');
          }

          return <CodeBlock key={index} code={codeContent.trim()} language={language} />;
        }

        return (
          <p key={index} className="whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}

const SAMPLE_COMPARISONS = [
  'Explain the trade-offs between SRAM memory in Groq LPUs and HBM memory in Nvidia GPUs.',
  'Implement an iterative binary search in Python and explain the space-time complexity.',
  'What are the core differences between monolithic neural architectures and modular multi-agent LLM systems?',
];

export function CompareView() {
  const [prompt, setPrompt] = useState('');
  const [modelAId, setModelAId] = useState('gemini-1.5-flash');
  const [modelBId, setModelBId] = useState('llama-3.1-8b-instant');
  const [isLoading, setIsLoading] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [prompt]);

  const handleRunComparison = async (overridePrompt) => {
    const textToCompare = (overridePrompt !== undefined ? overridePrompt : prompt).trim();
    if (!textToCompare || isLoading) return;

    if (modelAId === modelBId) {
      setGeneralError('Please select two distinct models to compare (e.g. Gemini 1.5 Flash vs. Llama 3.1 8B).');
      return;
    }

    setGeneralError(null);
    setIsLoading(true);

    try {
      const result = await sendCompareRequest({
        prompt: textToCompare,
        model_a_id: modelAId,
        model_b_id: modelBId,
      });
      setCompareResult(result);
    } catch (err) {
      console.error('[OmniAI Compare] Request failed:', err);
      setGeneralError(err instanceof Error ? err.message : 'Comparison request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetrySingle = (modelId) => {
    handleRunComparison();
  };

  const isIdentical = modelAId === modelBId;
  const isSubmitDisabled = isLoading || !prompt.trim() || isIdentical;

  // Filter operational models
  const operationalModels = AVAILABLE_MODELS.filter(m => m.isOperational);

  const modelAInfo = AVAILABLE_MODELS.find(m => m.id === modelAId) || AVAILABLE_MODELS[0];
  const modelBInfo = AVAILABLE_MODELS.find(m => m.id === modelBId) || AVAILABLE_MODELS[1];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0B0D12] text-[#F3F4F6] p-4 sm:p-6 max-w-6xl mx-auto w-full select-none">
      {/* Header */}
      <div className="mb-6 space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Multi-Model Response Comparison
          </h1>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
            Day 5 Concurrent Dispatch
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[#9CA3AF]">
          Broadcast the exact same prompt concurrently to two distinct AI architectures and evaluate reasoning, formatting, and latency side by side.
        </p>
      </div>

      {/* Quota Notice Banner */}
      <div className="mb-6 p-3 rounded-xl bg-[#151923] border border-[#282D38] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>
            <strong>Zero Budget Note:</strong> Comparison uses Python's <code className="text-purple-300 font-mono">asyncio.gather</code> to query both providers simultaneously via their free developer quotas.
          </span>
        </div>
      </div>

      {/* Controls Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#151923] border border-[#282D38] shadow-xl space-y-4 mb-6">
        {/* Model Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Model A Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Model A (Primary)
            </label>
            <select
              value={modelAId}
              onChange={(e) => setModelAId(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#10131A] text-slate-100 text-xs rounded-xl p-2.5 border border-[#282D38] focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 cursor-pointer"
            >
              {operationalModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>

          {/* Model B Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Model B (Comparison)
            </label>
            <select
              value={modelBId}
              onChange={(e) => setModelBId(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#10131A] text-slate-100 text-xs rounded-xl p-2.5 border border-[#282D38] focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 cursor-pointer"
            >
              {operationalModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warning if models identical */}
        {isIdentical && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
            ⚠️ Please select two different models to perform a meaningful side-by-side comparison.
          </div>
        )}

        {/* Prompt Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            Comparison Prompt
          </label>
          <textarea
            ref={textareaRef}
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            placeholder="Enter a prompt to broadcast to both models concurrently... (e.g., Explain binary search with code)"
            className="w-full bg-[#10131A] text-slate-100 text-xs sm:text-sm rounded-xl p-3 border border-[#282D38] focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/50 resize-none min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isSubmitDisabled) handleRunComparison();
              }
            }}
          />
        </div>

        {/* Sample Prompts */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-medium">Suggestions:</span>
          {SAMPLE_COMPARISONS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => {
                setPrompt(sample);
                handleRunComparison(sample);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#10131A] hover:bg-[#1E2330] text-slate-300 border border-[#282D38] hover:border-purple-500/40 transition-colors cursor-pointer"
            >
              {sample.length > 40 ? `${sample.slice(0, 40)}...` : sample}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-2 border-t border-[#282D38]/60">
          <span className="text-[11px] text-slate-500">
            Press <kbd className="px-1.5 py-0.5 rounded bg-[#10131A] border border-[#282D38] text-[10px]">Enter</kbd> to broadcast
          </span>

          <button
            type="button"
            onClick={() => handleRunComparison()}
            disabled={isSubmitDisabled}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-purple-500/20 cursor-pointer"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Broadcasting Concurrently...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Compare Models</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* General Error Banner */}
      {generalError && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-300">
          <strong>Request Error:</strong> {generalError}
        </div>
      )}

      {/* Side-by-Side Comparison Results */}
      <div className="flex-1">
        {isLoading && !compareResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Loading Panel A */}
            <div className="p-5 rounded-2xl bg-[#151923] border border-[#282D38] space-y-3 animate-pulse">
              <div className="flex items-center justify-between border-b border-[#282D38]/60 pb-3">
                <span className="text-xs font-semibold text-slate-300">{modelAInfo.name}</span>
                <span className="text-[10px] text-purple-400">Waiting for response...</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-4 bg-[#10131A] rounded w-3/4"></div>
                <div className="h-4 bg-[#10131A] rounded w-full"></div>
                <div className="h-4 bg-[#10131A] rounded w-5/6"></div>
              </div>
            </div>

            {/* Loading Panel B */}
            <div className="p-5 rounded-2xl bg-[#151923] border border-[#282D38] space-y-3 animate-pulse">
              <div className="flex items-center justify-between border-b border-[#282D38]/60 pb-3">
                <span className="text-xs font-semibold text-slate-300">{modelBInfo.name}</span>
                <span className="text-[10px] text-purple-400">Waiting for response...</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-4 bg-[#10131A] rounded w-3/4"></div>
                <div className="h-4 bg-[#10131A] rounded w-full"></div>
                <div className="h-4 bg-[#10131A] rounded w-5/6"></div>
              </div>
            </div>
          </div>
        )}

        {compareResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model A Panel */}
            <div className="flex flex-col p-5 rounded-2xl bg-[#151923] border border-[#282D38] shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#282D38]/80 mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {compareResult.model_a.name}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                    compareResult.model_a.provider === 'groq'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  }`}>
                    {compareResult.model_a.provider === 'groq' ? 'Groq LPU' : 'Google AI Studio'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {compareResult.model_a.success && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                      ⚡ {compareResult.model_a.latency_ms}ms
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    compareResult.model_a.success ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {compareResult.model_a.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
              </div>

              {/* Response or Error */}
              <div className="flex-1 overflow-y-auto">
                {compareResult.model_a.success ? (
                  <FormattedContent text={compareResult.model_a.response} />
                ) : (
                  <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-300 space-y-2">
                    <div className="font-semibold text-red-400">Execution Failure</div>
                    <p>{compareResult.model_a.error || 'Provider request failed.'}</p>
                    <button
                      type="button"
                      onClick={() => handleRetrySingle(compareResult.model_a.model_id)}
                      className="px-2.5 py-1 text-[11px] rounded bg-[#10131A] hover:bg-red-900/40 text-red-300 border border-red-500/30 transition-colors cursor-pointer"
                    >
                      Retry Comparison
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Model B Panel */}
            <div className="flex flex-col p-5 rounded-2xl bg-[#151923] border border-[#282D38] shadow-lg">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#282D38]/80 mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {compareResult.model_b.name}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                    compareResult.model_b.provider === 'groq'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  }`}>
                    {compareResult.model_b.provider === 'groq' ? 'Groq LPU' : 'Google AI Studio'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {compareResult.model_b.success && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                      ⚡ {compareResult.model_b.latency_ms}ms
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    compareResult.model_b.success ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                  }`}>
                    {compareResult.model_b.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
              </div>

              {/* Response or Error */}
              <div className="flex-1 overflow-y-auto">
                {compareResult.model_b.success ? (
                  <FormattedContent text={compareResult.model_b.response} />
                ) : (
                  <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-xs text-red-300 space-y-2">
                    <div className="font-semibold text-red-400">Execution Failure</div>
                    <p>{compareResult.model_b.error || 'Provider request failed.'}</p>
                    <button
                      type="button"
                      onClick={() => handleRetrySingle(compareResult.model_b.model_id)}
                      className="px-2.5 py-1 text-[11px] rounded bg-[#10131A] hover:bg-red-900/40 text-red-300 border border-red-500/30 transition-colors cursor-pointer"
                    >
                      Retry Comparison
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

