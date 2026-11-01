import React, { useState } from 'react';
import { useModelDownloadManager } from '../services/modelDownloadManager';
import { LOCAL_MODELS } from '../core/localModelRegistry';

/**
 * Compact background download indicator and mini download manager panel.
 * Never covers or blocks the chat interface. Allows users to chat seamlessly.
 */
export function BackgroundDownloadIndicator({ onOpenFullModal = null }) {
  const { statuses, getActiveDownloads, cancelDownload, startDownload } = useModelDownloadManager();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeDownloads = getActiveDownloads();

  if (activeDownloads.length === 0 && !isExpanded) {
    return null;
  }

  const primary = activeDownloads[0];

  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="fixed bottom-20 right-6 z-40 max-w-sm w-full animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Expanded Mini Download Manager Drawer */}
      {isExpanded && (
        <div className="mb-2 p-4 bg-[#121622] border border-[#2D3748] rounded-2xl shadow-2xl space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 border-b border-[#1F2430]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Local Model Downloads</span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                Background
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white text-xs p-1 rounded-md hover:bg-white/5 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {statuses.map((s) => {
              const isDownloading =
                s.status === 'downloading' || s.status === 'preparing' || s.status === 'initializing';
              const isReady = s.status === 'ready';

              return (
                <div key={s.modelId} className="p-2.5 rounded-xl bg-[#171C28] border border-[#232938] space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{s.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        isReady
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isDownloading
                          ? 'bg-purple-500/20 text-purple-300'
                          : s.status === 'error'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {isReady ? 'Ready' : isDownloading ? `${s.percent}%` : s.status}
                    </span>
                  </div>

                  {isDownloading && (
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-[#1F2430] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                          style={{ width: `${s.percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                        <span>{formatBytes(s.downloadedBytes)} / {formatBytes(s.totalBytes)}</span>
                        <span>{s.state}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-gray-400 truncate max-w-[180px]">
                      {s.text}
                    </span>
                    {isDownloading ? (
                      <button
                        type="button"
                        onClick={() => cancelDownload(s.modelId)}
                        className="px-2 py-0.5 text-[10px] text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    ) : !isReady ? (
                      <button
                        type="button"
                        onClick={() => startDownload(s.modelId)}
                        className="px-2 py-0.5 text-[10px] text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded cursor-pointer"
                      >
                        Download
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {onOpenFullModal && (
            <div className="pt-2 border-t border-[#1F2430] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  onOpenFullModal();
                }}
                className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
              >
                Advanced Model Settings & Cache →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Compact Floating Indicator Pill */}
      {primary && (
        <div className="bg-[#121622]/95 border border-purple-500/40 rounded-xl p-2.5 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 text-xs">
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-1 min-w-0 cursor-pointer space-y-1"
            title="Click to view all model downloads"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shrink-0" />
                <span className="font-semibold text-white truncate">{primary.name}</span>
                <span className="text-[10px] text-purple-300 font-mono">({primary.percent}%)</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-1">
                {formatBytes(primary.downloadedBytes)} / {formatBytes(primary.totalBytes)}
              </span>
            </div>

            {/* Mini Progress Bar */}
            <div className="w-full h-1 bg-[#1F2430] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-300"
                style={{ width: `${primary.percent}%` }}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => cancelDownload(primary.modelId)}
              className="p-1 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
              title="Cancel download"
              aria-label="Cancel download"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-purple-300 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
              title="Expand manager"
              aria-label="Expand download manager"
            >
              {isExpanded ? '▼' : '▲'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default BackgroundDownloadIndicator;

