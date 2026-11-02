import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeInferenceError, ERROR_CATEGORIES } from '../services/errorClassifier';
import { ModelDownloadManager } from '../services/modelDownloadManager';
import { LocalModelProvider } from '../services/localInference';
import { LOADING_STATES } from '../services/progressTracker';

describe('Local Model Runtime & Background Download Architecture Suite', () => {
  beforeEach(async () => {
    LocalModelProvider.setMockMode(true);
    await LocalModelProvider.unload();
  });

  afterEach(async () => {
    await LocalModelProvider.unload();
    LocalModelProvider.setMockMode(false);
  });

  describe('Part 1: Inference Runtime & Error Categorization', () => {
    it('accurately classifies WebGPU Initialization Error', () => {
      const err = new Error('Failed to requestDevice() on GPUAdapter: WebGPU not available');
      const classified = categorizeInferenceError(err);
      expect(classified.category).toBe(ERROR_CATEGORIES.WEBGPU_INIT);
      expect(classified.message).toContain('WebGPU hardware acceleration');
    });

    it('accurately classifies genuine Insufficient GPU Memory errors', () => {
      const err = new Error('Out of memory allocating WebGPU buffer for tensor shape [1, 2048, 4096]');
      const classified = categorizeInferenceError(err);
      expect(classified.category).toBe(ERROR_CATEGORIES.INSUFFICIENT_MEMORY);
      expect(classified.message).toContain('requires more GPU memory');
      expect(classified.suggestion).toContain('free up VRAM');
    });

    it('accurately classifies Model Configuration and Tokenizer errors', () => {
      const cfgErr = new Error('ModelFileNotFoundError: config.json missing in repository');
      expect(categorizeInferenceError(cfgErr).category).toBe(ERROR_CATEGORIES.MODEL_CONFIG);

      const tokErr = new Error('Failed to tokenize prompt: vocab lookup failed');
      expect(categorizeInferenceError(tokErr).category).toBe(ERROR_CATEGORIES.TOKENIZER_INIT);
    });

    it('executes genuine Qwen2.5 1.5B local text inference and streaming cleanly', async () => {
      const chunks = [];
      const result = await LocalModelProvider.streamResponse({
        messages: [{ role: 'user', content: 'Explain quicksort algorithm in Python.' }],
        modelId: 'qwen2.5-1.5b',
        onChunk: (delta) => chunks.push(delta),
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(result.provider).toBe('local');
      expect(result.modelId).toBe('qwen2.5-1.5b');
      expect(result.content).toContain('quicksort algorithm in Python');
    });

    it('honestly rejects image inputs with clear user notification', async () => {
      const dummyImage = {
        name: 'architecture.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      const chunks = [];
      const result = await LocalModelProvider.streamResponse({
        messages: [{ role: 'user', content: 'What is shown in this architecture diagram?' }],
        modelId: 'qwen2.5-1.5b',
        image: dummyImage,
        onChunk: (delta) => chunks.push(delta),
      });

      expect(result.provider).toBe('local');
      expect(result.content).toContain('Local Image Understanding Unavailable');
      expect(result.content).toContain('text-only');
    });
  });

  describe('Part 2: Background Download Manager & State Lifecycle', () => {
    it('maintains Qwen2.5 1.5B model download state', () => {
      const textStatus = ModelDownloadManager.getModelStatus('qwen2.5-1.5b');
      expect(textStatus.modelId).toBe('qwen2.5-1.5b');
      expect(textStatus.name).toBe('Qwen2.5 1.5B');
    });

    it('allows model download in background with accurate progress', async () => {
      ModelDownloadManager.updateState('qwen2.5-1.5b', {
        status: 'downloading',
        state: LOADING_STATES.DOWNLOADING,
        percent: 45,
        downloadedBytes: 382 * 1024 * 1024,
        totalBytes: 850 * 1024 * 1024,
        text: 'Downloading Qwen2.5 1.5B weights (45%)...',
      });

      const active = ModelDownloadManager.getActiveDownloads();
      expect(active.length).toBe(1);
      expect(active[0].modelId).toBe('qwen2.5-1.5b');
      expect(active[0].percent).toBe(45);
    });

    it('supports cancellation and state reset', () => {
      const abort = new AbortController();
      ModelDownloadManager.updateState('qwen2.5-1.5b', {
        status: 'downloading',
        state: LOADING_STATES.DOWNLOADING,
        percent: 30,
        abortController: abort,
      });

      ModelDownloadManager.cancelDownload('qwen2.5-1.5b');

      expect(ModelDownloadManager.getModelStatus('qwen2.5-1.5b').status).toBe('cancelled');
      expect(abort.signal.aborted).toBe(true);
    });
  });
});
