/**
 * ModelDownloadManager: Non-blocking background model download orchestrator.
 *
 * Responsibilities:
 * - Manages downloads independently of chat interactions (no UI lock).
 * - Tracks Qwen2.5 1.5B download state.
 * - Preserves download progress across conversation navigations.
 * - Prevents duplicate concurrent downloads for the same model.
 * - Supports cancellation and retry after failure.
 * - Provides reactive event subscriptions for UI components.
 */

import { LocalModelProvider, LOADING_STATES } from './localInference';
import {
  LOCAL_MODELS,
  getLocalModelById,
  DEFAULT_LOCAL_TEXT_MODEL_ID,
} from '../core/localModelRegistry';
import { useState, useEffect } from 'react';

class ModelDownloadManagerService {
  constructor() {
    /** @type {Map<string, { modelId: string, name: string, status: string, state: string, percent: number, progress: number, text: string, downloadedBytes: number, totalBytes: number, error: string|null, abortController: AbortController|null, promise: Promise|null }>} */
    this.modelStates = new Map();
    this.listeners = new Set();
    this.isInitializingQueue = false;

    // Pre-populate states for all local models
    for (const m of LOCAL_MODELS) {
      this.modelStates.set(m.id, {
        modelId: m.id,
        name: m.name,
        status: LocalModelProvider.isReady(m.id) ? 'ready' : 'idle',
        state: LocalModelProvider.isReady(m.id) ? LOADING_STATES.READY : 'Idle',
        percent: LocalModelProvider.isReady(m.id) ? 100 : 0,
        progress: LocalModelProvider.isReady(m.id) ? 1.0 : 0,
        text: LocalModelProvider.isReady(m.id) ? `${m.name} is ready.` : `Ready to download (~${m.approxSizeMB}MB)`,
        downloadedBytes: 0,
        totalBytes: m.approxSizeMB * 1024 * 1024,
        error: null,
        abortController: null,
        promise: null,
      });
    }

    // Check cache status asynchronously on boot
    this.checkInitialCache();
  }

  async checkInitialCache() {
    for (const m of LOCAL_MODELS) {
      const isReady = LocalModelProvider.isReady(m.id);
      if (isReady) {
        this.updateState(m.id, {
          status: 'ready',
          state: LOADING_STATES.READY,
          percent: 100,
          progress: 1.0,
          text: `${m.name} is ready.`,
        });
      }
    }
  }

  /**
   * Get the current status for a specific model
   */
  getModelStatus(modelId) {
    const canonical = getLocalModelById(modelId)?.id || modelId;
    return (
      this.modelStates.get(canonical) || {
        modelId: canonical,
        name: getLocalModelById(canonical)?.name || canonical,
        status: 'idle',
        state: 'Idle',
        percent: 0,
        progress: 0,
        text: 'Idle',
        error: null,
      }
    );
  }

  /**
   * Check if a specific model is ready for inference
   */
  isModelReady(modelId) {
    const canonical = getLocalModelById(modelId)?.id || modelId;
    if (LocalModelProvider.isReady(canonical)) return true;
    return this.getModelStatus(canonical).status === 'ready';
  }

  /**
   * Returns list of currently active downloads
   */
  getActiveDownloads() {
    const active = [];
    for (const state of this.modelStates.values()) {
      if (
        state.status === 'preparing' ||
        state.status === 'downloading' ||
        state.status === 'initializing'
      ) {
        active.push(state);
      }
    }
    return active;
  }

  /**
   * Returns all model download states
   */
  getAllStatuses() {
    return Array.from(this.modelStates.values());
  }

  /**
   * Start downloading a model in the background (Non-blocking)
   */
  startDownload(modelId) {
    const canonical = getLocalModelById(modelId)?.id || modelId;
    const current = this.getModelStatus(canonical);

    // If already downloading or preparing, return active promise
    if (
      (current.status === 'downloading' || current.status === 'preparing' || current.status === 'initializing') &&
      current.promise
    ) {
      return current.promise;
    }

    // If already ready, return resolved promise
    if (current.status === 'ready' && LocalModelProvider.isReady(canonical)) {
      return Promise.resolve();
    }

    // Check if another large download is active (Resource management)
    const activeDownloads = this.getActiveDownloads();
    if (activeDownloads.length >= 1 && activeDownloads[0].modelId !== canonical) {
      console.info(`[ModelDownloadManager] Note: Active download for ${activeDownloads[0].name} in progress.`);
    }

    const abortController = new AbortController();
    const modelInfo = getLocalModelById(canonical);

    this.updateState(canonical, {
      status: 'preparing',
      state: LOADING_STATES.PREPARING,
      percent: 0,
      progress: 0,
      text: `Preparing background download for ${modelInfo.name}...`,
      error: null,
      abortController,
    });

    const downloadPromise = (async () => {
      try {
        await LocalModelProvider.initialize({
          modelId: canonical,
          signal: abortController.signal,
          onProgress: (report) => {
            if (abortController.signal.aborted) return;

            let nextStatus = 'downloading';
            if (report.state === LOADING_STATES.INITIALIZING) nextStatus = 'initializing';
            if (report.state === LOADING_STATES.DOWNLOAD_COMPLETE) nextStatus = 'download_complete';
            if (report.state === LOADING_STATES.READY) nextStatus = 'ready';

            this.updateState(canonical, {
              status: nextStatus,
              state: report.state || LOADING_STATES.DOWNLOADING,
              percent: typeof report.percent === 'number' ? report.percent : 0,
              progress: typeof report.progress === 'number' ? report.progress : 0,
              text: report.text || `Downloading ${modelInfo.name}...`,
              downloadedBytes: report.downloadedBytes || 0,
              totalBytes: report.totalBytes || modelInfo.approxSizeMB * 1024 * 1024,
            });
          },
        });

        if (abortController.signal.aborted) {
          return;
        }

        this.updateState(canonical, {
          status: 'ready',
          state: LOADING_STATES.READY,
          percent: 100,
          progress: 1.0,
          text: `${modelInfo.name} is ready for private local inference.`,
          abortController: null,
          promise: null,
        });
      } catch (err) {
        if (abortController.signal.aborted || err.name === 'AbortError' || err.message?.includes('cancelled')) {
          this.updateState(canonical, {
            status: 'cancelled',
            state: LOADING_STATES.CANCELLED,
            percent: 0,
            progress: 0,
            text: 'Download cancelled by user.',
            abortController: null,
            promise: null,
          });
        } else {
          this.updateState(canonical, {
            status: 'error',
            state: LOADING_STATES.DOWNLOAD_FAILED,
            text: `Failed: ${err.message}`,
            error: err.message,
            abortController: null,
            promise: null,
          });
          throw err;
        }
      }
    })();

    this.updateState(canonical, { promise: downloadPromise });
    return downloadPromise;
  }

  /**
   * Cancel an active download for a specific model without affecting others
   */
  cancelDownload(modelId) {
    const canonical = getLocalModelById(modelId)?.id || modelId;
    const current = this.getModelStatus(canonical);

    if (current.abortController) {
      try {
        current.abortController.abort();
      } catch (e) {
        console.warn(`[ModelDownloadManager] Abort warning for ${canonical}:`, e);
      }
    }

    this.updateState(canonical, {
      status: 'cancelled',
      state: LOADING_STATES.CANCELLED,
      percent: 0,
      progress: 0,
      text: 'Download cancelled by user.',
      abortController: null,
      promise: null,
    });
  }

  /**
   * Internal state update and subscriber notification
   */
  updateState(modelId, partial) {
    const existing = this.getModelStatus(modelId);
    const updated = { ...existing, ...partial };
    this.modelStates.set(modelId, updated);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getAllStatuses());
      } catch (e) {
        console.error('[ModelDownloadManager] Subscriber error:', e);
      }
    }
  }
}

export const ModelDownloadManager = new ModelDownloadManagerService();
export default ModelDownloadManager;

/**
 * React Hook for listening to all model download statuses
 */
export function useModelDownloadManager() {
  const [statuses, setStatuses] = useState(() => ModelDownloadManager.getAllStatuses());

  useEffect(() => {
    return ModelDownloadManager.subscribe((newStatuses) => {
      setStatuses([...newStatuses]);
    });
  }, []);

  return {
    statuses,
    isModelReady: (id) => ModelDownloadManager.isModelReady(id),
    getModelStatus: (id) => ModelDownloadManager.getModelStatus(id),
    getActiveDownloads: () => ModelDownloadManager.getActiveDownloads(),
    startDownload: (id) => ModelDownloadManager.startDownload(id),
    cancelDownload: (id) => ModelDownloadManager.cancelDownload(id),
  };
}

