/**
 * DownloadProgressTracker: High-precision, mathematically sound progress accounting
 * for single-file and multi-shard on-device model downloads (Transformers.js & WebLLM).
 *
 * Guarantees:
 * 1. Progress is always in [0, 100]%. Never NaN, Infinity, negative, or above 100%.
 * 2. Same calculated percentage is shared across progress bar, text, and status message.
 * 3. File deduplication: unique files are tracked by key; bytes are never double-counted.
 * 4. Supports multi-shard downloads, cached files, retries, and cancellation.
 * 5. Distinct 8 loading states.
 */

export const LOADING_STATES = {
  PREPARING: 'Preparing Download',
  DOWNLOADING: 'Downloading Model Files',
  DOWNLOAD_COMPLETE: 'Download Complete',
  INITIALIZING: 'Initializing Model',
  READY: 'Model Ready',
  DOWNLOAD_FAILED: 'Download Failed',
  INIT_FAILED: 'Initialization Failed',
  CANCELLED: 'Download Cancelled',
};

export class DownloadProgressTracker {
  /**
   * @param {Object} options
   * @param {string} options.modelName - Display name of the model (e.g. 'Qwen2.5-VL 3B')
   * @param {number|null} options.expectedTotalBytes - Estimated total bytes if known (~2.2GB for Qwen2.5-VL 3B)
   * @param {Function} options.onUpdate - Progress listener called with standardized progress payload
   */
  constructor({
    modelName = 'Model',
    expectedTotalBytes = null,
    onUpdate = null,
  } = {}) {
    this.modelName = modelName;
    this.expectedTotalBytes = expectedTotalBytes;
    this.onUpdate = onUpdate;

    /** @type {Map<string, { file: string, loaded: number, total: number, status: string, isCached: boolean }>} */
    this.files = new Map();

    this.state = LOADING_STATES.PREPARING;
    this.percent = 0;
    this.progress = 0.0;
    this.statusText = `Preparing download for ${this.modelName}...`;
    this.error = null;
    this.aborted = false;
    this.indeterminate = false;
  }

  /**
   * Reset tracker for a clean fresh download or retry
   */
  reset() {
    this.files.clear();
    this.state = LOADING_STATES.PREPARING;
    this.percent = 0;
    this.progress = 0.0;
    this.statusText = `Preparing download for ${this.modelName}...`;
    this.error = null;
    this.aborted = false;
    this.indeterminate = false;
    this.emit();
  }

  /**
   * Abort and cancel loading. Rejects future callbacks.
   */
  abort(message = 'Model download cancelled by user.') {
    this.aborted = true;
    this.state = LOADING_STATES.CANCELLED;
    this.statusText = message;
    this.emit();
  }

  /**
   * Transition to Preparing Download
   */
  setPreparing(text) {
    if (this.aborted) return;
    this.state = LOADING_STATES.PREPARING;
    this.statusText = text || `Preparing download for ${this.modelName}...`;
    this.percent = 0;
    this.progress = 0.0;
    this.indeterminate = false;
    this.emit();
  }

  /**
   * Transition to Download Complete
   */
  setDownloadComplete(text) {
    if (this.aborted) return;
    this.state = LOADING_STATES.DOWNLOAD_COMPLETE;
    this.percent = 100;
    this.progress = 1.0;
    this.statusText = text || `Download complete. Preparing to initialize ${this.modelName}...`;
    this.indeterminate = false;
    this.emit();
  }

  /**
   * Transition to Initializing Model
   */
  setInitializing(text) {
    if (this.aborted) return;
    this.state = LOADING_STATES.INITIALIZING;
    this.percent = 100;
    this.progress = 1.0;
    this.statusText = text || `Initializing ${this.modelName} on WebGPU...`;
    this.indeterminate = false;
    this.emit();
  }

  /**
   * Transition to Model Ready
   */
  setReady(text) {
    if (this.aborted) return;
    this.state = LOADING_STATES.READY;
    this.percent = 100;
    this.progress = 1.0;
    this.statusText = text || `${this.modelName} is ready.`;
    this.indeterminate = false;
    this.emit();
  }

  /**
   * Transition to Download Failed
   */
  setDownloadFailed(err) {
    if (this.aborted) return;
    this.state = LOADING_STATES.DOWNLOAD_FAILED;
    this.error = typeof err === 'string' ? err : err?.message || 'Download failed';
    this.statusText = `Failed to download ${this.modelName}: ${this.error}`;
    this.emit();
  }

  /**
   * Transition to Initialization Failed
   */
  setInitFailed(err) {
    if (this.aborted) return;
    this.state = LOADING_STATES.INIT_FAILED;
    this.error = typeof err === 'string' ? err : err?.message || 'Initialization failed';
    this.statusText = `Failed to initialize ${this.modelName}: ${this.error}`;
    this.emit();
  }

  /**
   * Calculate current totals across all unique files
   */
  calculateTotals() {
    let totalDownloaded = 0;
    let totalExpected = 0;
    let hasKnownSize = false;

    for (const file of this.files.values()) {
      if (typeof file.loaded === 'number' && Number.isFinite(file.loaded)) {
        totalDownloaded += Math.max(0, file.loaded);
      }
      if (typeof file.total === 'number' && Number.isFinite(file.total) && file.total > 0) {
        totalExpected += file.total;
        hasKnownSize = true;
      }
    }

    // If expected total size is known in advance (e.g. 2.2GB), ensure we don't flash 100%
    // while early small metadata files (config.json) finish before large weights arrive.
    const effectiveTotal = Math.max(totalExpected, this.expectedTotalBytes || 0);

    if (effectiveTotal > 0) {
      this.indeterminate = false;
      const rawPercent = (totalDownloaded / effectiveTotal) * 100;
      // Enforce: integer in [0, 100], never NaN or Infinity
      if (Number.isFinite(rawPercent)) {
        this.percent = Math.min(100, Math.max(0, Math.round(rawPercent)));
        this.progress = Number((this.percent / 100).toFixed(4));
      } else {
        this.percent = 0;
        this.progress = 0.0;
      }
    } else if (!hasKnownSize) {
      // Content length is unknown
      this.indeterminate = true;
      this.percent = 0;
      this.progress = 0.0;
    }

    return {
      totalDownloaded,
      totalExpected: effectiveTotal,
      indeterminate: this.indeterminate,
      percent: this.percent,
      progress: this.progress,
    };
  }

  /**
   * Format human-readable bytes (e.g. "450 MB / 2.20 GB")
   */
  formatBytes(bytes) {
    if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  /**
   * Handle events emitted by Transformers.js (AutoProcessor & AutoModelForImageTextToText)
   *
   * Transformers.js emits:
   * - { status: 'initiate', file: '...' }
   * - { status: 'download', file: '...' }
   * - { status: 'progress', file: '...', progress: number in [0, 100], loaded: number, total: number }
   * - { status: 'done', file: '...' }
   * - { status: 'progress_total', progress: number in [0, 100], loaded: number, total: number, files: {...} }
   */
  handleTransformersEvent(info) {
    if (this.aborted || !info || typeof info !== 'object') return;

    // Check if this is an aggregate progress_total event from Transformers.js
    if (info.status === 'progress_total') {
      this.state = LOADING_STATES.DOWNLOADING;

      if (info.files && typeof info.files === 'object') {
        for (const [fileKey, fData] of Object.entries(info.files)) {
          const existing = this.files.get(fileKey) || { file: fileKey, isCached: false };
          this.files.set(fileKey, {
            ...existing,
            file: fileKey,
            loaded: Math.max(0, fData.loaded || 0),
            total: Math.max(0, fData.total || 0),
            status: fData.loaded >= fData.total && fData.total > 0 ? 'done' : 'progress',
          });
        }
      }

      const totals = this.calculateTotals();
      const currentFileName = info.file || 'weights';
      this.statusText = `Downloading ${this.modelName} weights (${this.percent}%)... (${this.formatBytes(totals.totalDownloaded)} / ${this.formatBytes(totals.totalExpected)})`;
      this.emit();
      return;
    }

    const fileKey = info.file || info.name || 'weights.onnx';
    const current = this.files.get(fileKey) || {
      file: fileKey,
      loaded: 0,
      total: 0,
      status: info.status || 'initiate',
      isCached: false,
    };

    switch (info.status) {
      case 'initiate':
      case 'download': {
        this.state = LOADING_STATES.DOWNLOADING;
        current.status = info.status;
        this.files.set(fileKey, current);
        break;
      }

      case 'progress': {
        this.state = LOADING_STATES.DOWNLOADING;
        current.status = 'progress';

        if (typeof info.loaded === 'number' && Number.isFinite(info.loaded)) {
          current.loaded = Math.max(0, info.loaded);
        }
        if (typeof info.total === 'number' && Number.isFinite(info.total) && info.total > 0) {
          current.total = Math.max(current.loaded, info.total);
        } else if (!current.total && typeof info.progress === 'number' && info.progress > 0 && current.loaded > 0) {
          // In Transformers.js, info.progress is in [0, 100]
          const normProgress = info.progress > 1 ? info.progress / 100 : info.progress;
          current.total = Math.round(current.loaded / normProgress);
        }

        this.files.set(fileKey, current);
        break;
      }

      case 'done': {
        current.status = 'done';
        if (current.total > 0) {
          current.loaded = current.total;
        } else if (current.loaded > 0) {
          current.total = current.loaded;
        }
        this.files.set(fileKey, current);
        break;
      }

      default:
        break;
    }

    const totals = this.calculateTotals();
    const cleanFileName = fileKey.split('/').pop();
    if (totals.indeterminate) {
      this.statusText = `Downloading ${this.modelName} files... (${this.formatBytes(totals.totalDownloaded)})`;
    } else {
      this.statusText = `Downloading ${this.modelName} weights (${this.percent}%)... (${this.formatBytes(totals.totalDownloaded)} / ${this.formatBytes(totals.totalExpected)})`;
    }

    this.emit();
  }

  /**
   * Handle WebLLM progress callbacks
   *
   * WebLLM emits:
   * - { progress: float in [0, 1], text: string, timeElapsed: number }
   */
  handleWebLLMEvent(report) {
    if (this.aborted || !report || typeof report !== 'object') return;

    let p = typeof report.progress === 'number' && Number.isFinite(report.progress) ? report.progress : 0;
    // WebLLM progress is 0.0 to 1.0
    p = Math.min(1.0, Math.max(0.0, p));
    this.progress = Number(p.toFixed(4));
    this.percent = Math.min(100, Math.max(0, Math.round(p * 100)));
    this.indeterminate = false;

    const rawText = report.text || '';

    if (p >= 1.0) {
      this.state = LOADING_STATES.DOWNLOAD_COMPLETE;
      this.statusText = `Download complete. Initializing ${this.modelName}...`;
    } else if (rawText.toLowerCase().includes('compiling') || rawText.toLowerCase().includes('shader')) {
      this.state = LOADING_STATES.INITIALIZING;
      this.statusText = `Compiling WebGPU shaders (${this.percent}%)...`;
    } else {
      this.state = LOADING_STATES.DOWNLOADING;
      this.statusText = `Downloading ${this.modelName} weights (${this.percent}%)...`;
    }

    this.emit();
  }

  /**
   * Emit standardized report to onUpdate listener
   */
  emit() {
    if (!this.onUpdate) return;

    // Strict boundary verification
    const safePercent = Number.isFinite(this.percent)
      ? Math.min(100, Math.max(0, Math.round(this.percent)))
      : 0;

    const safeProgress = Number.isFinite(this.progress)
      ? Math.min(1.0, Math.max(0.0, this.progress))
      : 0.0;

    const payload = {
      state: this.state,
      progress: safeProgress,
      percent: safePercent,
      text: this.statusText,
      indeterminate: this.indeterminate,
      error: this.error,
      aborted: this.aborted,
    };

    try {
      this.onUpdate(payload);
    } catch (e) {
      console.warn('[DownloadProgressTracker] onUpdate error:', e);
    }
  }
}

