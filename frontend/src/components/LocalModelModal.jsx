import React, { useState, useEffect, useRef } from 'react';
import { LocalModelProvider, LOADING_STATES } from '../services/localInference';
import {
  LOCAL_MODELS,
  getLocalModelById,
  DEFAULT_LOCAL_TEXT_MODEL_ID,
} from '../core/localModelRegistry';

/**
 * Local Model Loading & Management Modal
 * Guides users through on-device model downloading, WebGPU verification,
 * high-precision multi-shard progress accounting, cancellation, and cache storage management.
 */
export default function LocalModelModal({
  isOpen,
  onClose,
  selectedModelId = DEFAULT_LOCAL_TEXT_MODEL_ID,
  onModelReady,
}) {
  const [modelId, setModelId] = useState(selectedModelId);
  const [modelInfo, setModelInfo] = useState(() => getLocalModelById(selectedModelId));
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(LOADING_STATES.PREPARING);
  const [percent, setPercent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isIndeterminate, setIsIndeterminate] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [gpuInfo, setGpuInfo] = useState({ available: true, reason: '' });

  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (selectedModelId) {
      setModelId(selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    const info = getLocalModelById(modelId);
    setModelInfo(info);
    setIsReady(LocalModelProvider.isReady(modelId));
    LocalModelProvider.isCached(modelId).then((cached) => {
      setIsCached(cached);
    });
  }, [modelId]);

  // Check WebGPU availability on open
  useEffect(() => {
    if (!isOpen) return;

    const avail = LocalModelProvider.isAvailable();
    setGpuInfo(avail);

    const ready = LocalModelProvider.isReady(modelId);
    setIsReady(ready);

    LocalModelProvider.isCached(modelId).then((cached) => {
      setIsCached(cached);
    });
  }, [isOpen, modelId]);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    // Reset any prior abort controller and create fresh one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentSignal = abortControllerRef.current.signal;

    setErrorText('');
    setIsLoading(true);
    setLoadingState(LOADING_STATES.PREPARING);
    setPercent(0);
    setProgress(0);
    setIsIndeterminate(false);
    setStatusText(`Preparing WebGPU pipeline for ${modelInfo.name}...`);

    try {
      await LocalModelProvider.initialize({
        modelId,
        signal: currentSignal,
        onProgress: (report) => {
          if (currentSignal.aborted) return;

          if (report.state) {
            setLoadingState(report.state);
          }

          if (typeof report.indeterminate === 'boolean') {
            setIsIndeterminate(report.indeterminate);
          }

          // Strict percentage normalization: integer between 0 and 100
          if (typeof report.percent === 'number' && Number.isFinite(report.percent)) {
            const safeP = Math.min(100, Math.max(0, Math.round(report.percent)));
            setPercent(safeP);
            setProgress(Number((safeP / 100).toFixed(4)));
          } else if (typeof report.progress === 'number' && Number.isFinite(report.progress)) {
            const safeFraction = Math.min(1.0, Math.max(0.0, report.progress));
            const safeP = Math.min(100, Math.max(0, Math.round(safeFraction * 100)));
            setPercent(safeP);
            setProgress(safeFraction);
          }

          if (report.text) {
            setStatusText(report.text);
          }
        },
      });

      if (currentSignal.aborted) {
        return;
      }

      setLoadingState(LOADING_STATES.READY);
      setPercent(100);
      setProgress(1.0);
      setIsReady(true);
      setIsCached(true);
      setIsLoading(false);
      setStatusText(`${modelInfo.name} is ready for private local inference.`);

      if (onModelReady) {
        onModelReady(modelId);
      }
    } catch (err) {
      setIsLoading(false);
      if (err.name === 'AbortError' || currentSignal.aborted || err.message?.includes('cancelled')) {
        setLoadingState(LOADING_STATES.CANCELLED);
        setStatusText('Model download cancelled by user.');
        setPercent(0);
        setProgress(0);
      } else {
        if (loadingState === LOADING_STATES.DOWNLOADING || loadingState === LOADING_STATES.PREPARING) {
          setLoadingState(LOADING_STATES.DOWNLOAD_FAILED);
        } else {
          setLoadingState(LOADING_STATES.INIT_FAILED);
        }
        setErrorText(err.message || 'Failed to download or initialize local model.');
      }
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    LocalModelProvider.cancelLoading();
    setIsLoading(false);
    setLoadingState(LOADING_STATES.CANCELLED);
    setStatusText('Model download cancelled by user.');
    setPercent(0);
    setProgress(0);
  };

  const handleClearCache = async () => {
    if (!window.confirm(`Delete downloaded ${modelInfo.name} weights from browser cache and reclaim disk space?`)) {
      return;
    }
    try {
      await LocalModelProvider.clearCache(modelId);
      setIsCached(false);
      setIsReady(false);
      setPercent(0);
      setProgress(0);
      setStatusText('Model cache removed successfully.');
    } catch (err) {
      setErrorText('Failed to clear cache: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#10131A] border border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2430] bg-[#151923]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Local On-Device AI Models</h2>
              <p className="text-xs text-gray-400">Run private browser text & vision intelligence via WebGPU</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Model Tabs Selector */}
        {LOCAL_MODELS.length > 1 && (
          <div className="px-6 pt-4 pb-0 flex gap-2 border-b border-[#1F2430]">
            {LOCAL_MODELS.map((m) => {
              const isTabActive = m.id === modelId;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (isLoading) return;
                    setModelId(m.id);
                    setErrorText('');
                    setStatusText('');
                    setPercent(0);
                    setProgress(0);
                  }}
                  className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isTabActive
                      ? 'border-purple-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span>💬</span>
                  <span>{m.name}</span>
                  <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.2 rounded">
                    ~{m.approxSizeMB}MB
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* WebGPU Status Banner */}
          {!gpuInfo.available ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>WebGPU Not Detected</span>
              </div>
              <p className="text-amber-300/80 leading-relaxed">
                {gpuInfo.reason}
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>WebGPU Hardware Acceleration Available</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300 font-medium">Ready</span>
            </div>
          )}

          {/* Model Card Selection */}
          <div className="p-4 bg-[#151923] border border-[#1F2430] rounded-xl space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{modelInfo.name}</span>
                  <span className={`text-[10px] border px-2 py-0.5 rounded font-medium ${modelInfo.badgeColor}`}>
                    {modelInfo.badge || modelInfo.tag}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{modelInfo.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1F2430] text-[11px]">
              <div>
                <span className="text-gray-500 block">Download Size</span>
                <span className="font-mono text-gray-200 font-semibold">~{modelInfo.approxSizeMB} MB</span>
              </div>
              <div>
                <span className="text-gray-500 block">Required VRAM</span>
                <span className="font-mono text-gray-200 font-semibold">~{modelInfo.vramMB} MB</span>
              </div>
              <div>
                <span className="text-gray-500 block">License</span>
                <span className="font-mono text-gray-200 font-semibold">{modelInfo.license}</span>
              </div>
            </div>
          </div>

          {/* Loading / Progress State */}
          {isLoading && (
            <div className="space-y-3 p-4 rounded-xl bg-[#151923] border border-purple-500/30 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {loadingState}
                  </span>
                  <span className="font-medium text-gray-300 truncate max-w-[320px]">
                    {statusText || 'Loading model weights...'}
                  </span>
                </div>
                <span className="font-mono font-bold text-white shrink-0 ml-2">
                  {isIndeterminate ? 'Calculating...' : `${percent}%`}
                </span>
              </div>

              {/* Progress bar strictly bound between 0% and 100% */}
              <div className="w-full h-2.5 bg-[#1F2430] rounded-full overflow-hidden relative">
                {isIndeterminate ? (
                  <div className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full w-full animate-pulse" />
                ) : (
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-gray-400">
                <span>{percent === 100 ? 'Finalizing pipeline verification...' : 'Browser-based local weights download'}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2.5 py-1 text-xs text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Continue in Background ↗
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1 text-xs text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel Loading
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cancelled State Banner */}
          {!isLoading && loadingState === LOADING_STATES.CANCELLED && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <span>✕</span>
                <div>
                  <div className="font-semibold">{LOADING_STATES.CANCELLED}</div>
                  <div className="text-amber-300/80 text-[11px]">Download was stopped. You can retry anytime.</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartDownload}
                className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg font-medium cursor-pointer"
              >
                Retry Download
              </button>
            </div>
          )}

          {/* Ready State */}
          {isReady && !isLoading && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <span className="text-lg">✓</span>
                <span>Your local AI model is ready ({modelInfo.name}).</span>
              </div>
              <p className="text-xs text-emerald-200/80 leading-relaxed">
                Weights are loaded in WebGPU memory and cached locally. You can chat without internet or external API keys.
              </p>
            </div>
          )}

          {/* Error Banner */}
          {errorText && !isLoading && (
            <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start justify-between gap-2 animate-in fade-in">
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0">⚠️</span>
                <div className="space-y-1">
                  <div className="font-semibold">{loadingState || 'Operation Failed'}</div>
                  <div className="text-red-300/90">{errorText}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartDownload}
                className="px-3 py-1 bg-red-900/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 rounded-lg shrink-0 cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Privacy & Hardware Guarantees */}
          <div className="p-3.5 rounded-xl bg-[#121622] border border-[#1F2430] text-xs text-gray-300 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <span>🛡️</span>
              <span>100% On-Device Privacy Guarantee</span>
            </div>
            <p className="text-gray-400 text-[11px] leading-relaxed">
              Local model responses are generated on your device. Your prompts and images are not sent to an external AI provider for local inference.
            </p>
            <p className="text-gray-500 text-[10px] leading-relaxed">
              ⚡ Note: Local inference speed depends on your local hardware (GPU/RAM). First download will be stored in browser cache for instant repeat visits.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1F2430] bg-[#151923]">
          <div>
            {isCached && !isLoading && (
              <button
                type="button"
                onClick={handleClearCache}
                className="text-xs text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                title="Reclaim browser storage"
              >
                Clear Model Cache
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white bg-[#1F2430] hover:bg-[#282D38] rounded-xl transition-colors cursor-pointer"
            >
              {isReady ? 'Close' : 'Cancel'}
            </button>

            {!isReady ? (
              <button
                type="button"
                disabled={isLoading || !gpuInfo.available}
                onClick={handleStartDownload}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-purple-600/20 cursor-pointer flex items-center gap-1.5"
              >
                {isLoading ? (
                  <span>Loading...</span>
                ) : (
                  <>
                    <span>Download & Start</span>
                    <span>(~{modelInfo.approxSizeMB}MB)</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Start Chatting →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
