import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { categorizeInferenceError, ERROR_CATEGORIES } from '../services/errorClassifier';
import { ModelDownloadManager } from '../services/modelDownloadManager';
import { LocalModelProvider } from '../services/localInference';
import { LOADING_STATES } from '../services/progressTracker';

describe('Vision Model Runtime & Background Download Architecture Suite', () => {
  beforeEach(async () => {
    LocalModelProvider.setMockMode(true);
    await LocalModelProvider.unload();
  });

  afterEach(async () => {
    await LocalModelProvider.unload();
    LocalModelProvider.setMockMode(false);
  });

  describe('Part 1: Vision Inference Runtime & Error Categorization', () => {
    it('accurately classifies the exact historical error "undefined is not iterable" as Vision Processor Error', () => {
      const error = new TypeError('undefined is not iterable (cannot read property Symbol(Symbol.iterator))');
      error.stack = 'TypeError: undefined is not iterable\n  at closure.preprocess (transformers.node.cjs:21377:35)\n  at closure._call (image_processing_qwen2_vl.js:20:10)';

      const classified = categorizeInferenceError(error);

      expect(classified.category).toBe(ERROR_CATEGORIES.VISION_PROCESSOR);
      expect(classified.message).toContain('vision processor encountered an issue preparing the image pixels');
      expect(classified.suggestion).toContain('standard format');
      // Must NOT be labeled as GPU memory problem!
      expect(classified.category).not.toBe(ERROR_CATEGORIES.INSUFFICIENT_MEMORY);
    });

    it('accurately classifies WebGPU Initialization Error without conflating with memory', () => {
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

    it('accurately classifies Invalid Image Input when missing or corrupted', () => {
      const err = new Error('No image provided. Qwen2.5-VL 3B requires an attached image or active context.');
      const classified = categorizeInferenceError(err);
      expect(classified.category).toBe(ERROR_CATEGORIES.INVALID_IMAGE);
    });

    it('accurately classifies Model Configuration and Tokenizer errors', () => {
      const cfgErr = new Error('ModelFileNotFoundError: config.json missing in repository');
      expect(categorizeInferenceError(cfgErr).category).toBe(ERROR_CATEGORIES.MODEL_CONFIG);

      const tokErr = new Error('Failed to tokenize prompt: vocab lookup failed');
      expect(categorizeInferenceError(tokErr).category).toBe(ERROR_CATEGORIES.TOKENIZER_INIT);
    });

    it('executes genuine multimodal vision inference without throwing undefined is not iterable', async () => {
      const dummyImage = {
        name: 'sample_physics_diagram.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      const chunks = [];
      const result = await LocalModelProvider.streamResponse({
        messages: [{ role: 'user', content: 'Analyze the forces acting on the inclined plane in this diagram.' }],
        modelId: 'qwen2.5-vl-3b',
        image: dummyImage,
        onChunk: (delta) => chunks.push(delta),
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(result.provider).toBe('local');
      expect(result.modelId).toBe('qwen2.5-vl-3b');
      expect(result.content).toContain('### Understanding the Question');
      expect(result.content).toContain('### Solution & Reasoning');
      expect(result.content).toContain('### Final Answer');
      expect(LocalModelProvider.hasActiveImageContext()).toBe(true);
    });

    it('supports multi-turn follow-up queries using cached visual context', async () => {
      const dummyImage = {
        name: 'geometry.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      // Turn 1: Attach image
      await LocalModelProvider.streamResponse({
        messages: [{ role: 'user', content: 'Find angle theta in this triangle.' }],
        modelId: 'qwen2.5-vl-3b',
        image: dummyImage,
      });

      // Turn 2: Follow-up question without re-uploading image
      const followUp = await LocalModelProvider.streamResponse({
        messages: [
          { role: 'user', content: 'Find angle theta in this triangle.' },
          { role: 'assistant', content: 'Theta is 45 degrees.' },
          { role: 'user', content: 'How would theta change if the opposite side doubled?' },
        ],
        modelId: 'qwen2.5-vl-3b',
        hasPriorImageContext: true,
      });

      expect(followUp.hasImageContext).toBe(true);
      expect(followUp.content).toBeDefined();
    });
  });

  describe('Part 2: Background Download Manager & Non-Blocking Concurrency', () => {
    it('maintains independent model download states', () => {
      const textStatus = ModelDownloadManager.getModelStatus('qwen2.5-1.5b');
      const visionStatus = ModelDownloadManager.getModelStatus('qwen2.5-vl-3b');

      expect(textStatus.modelId).toBe('qwen2.5-1.5b');
      expect(visionStatus.modelId).toBe('qwen2.5-vl-3b');

      // They must be separate state objects
      expect(textStatus).not.toBe(visionStatus);
    });

    it('allows one model to remain Ready while another is Downloading', async () => {
      // 1. Mark text model as ready
      ModelDownloadManager.updateState('qwen2.5-1.5b', {
        status: 'ready',
        state: LOADING_STATES.READY,
        percent: 100,
        text: 'Qwen2.5 1.5B is ready.',
      });

      // 2. Simulate vision model downloading in background at 64%
      ModelDownloadManager.updateState('qwen2.5-vl-3b', {
        status: 'downloading',
        state: LOADING_STATES.DOWNLOADING,
        percent: 64,
        downloadedBytes: 1400 * 1024 * 1024,
        totalBytes: 2200 * 1024 * 1024,
        text: 'Downloading Qwen2.5-VL 3B weights (64%)...',
      });

      expect(ModelDownloadManager.isModelReady('qwen2.5-1.5b')).toBe(true);
      expect(ModelDownloadManager.isModelReady('qwen2.5-vl-3b')).toBe(false);

      const active = ModelDownloadManager.getActiveDownloads();
      expect(active.length).toBe(1);
      expect(active[0].modelId).toBe('qwen2.5-vl-3b');
      expect(active[0].percent).toBe(64);

      // 3. User can chat with text model while vision is downloading!
      const textResult = await LocalModelProvider.streamResponse({
        messages: [{ role: 'user', content: 'What is 10 + 10?' }],
        modelId: 'qwen2.5-1.5b',
      });

      expect(textResult.content).toContain('10 + 10');
      // Vision model download state is still preserved and downloading at 64%!
      expect(ModelDownloadManager.getModelStatus('qwen2.5-vl-3b').percent).toBe(64);
      expect(ModelDownloadManager.getModelStatus('qwen2.5-vl-3b').status).toBe('downloading');
    });

    it('cancels vision model download without interrupting text model', () => {
      // Setup both models
      ModelDownloadManager.updateState('qwen2.5-1.5b', { status: 'ready', state: LOADING_STATES.READY });
      const visionAbort = new AbortController();
      ModelDownloadManager.updateState('qwen2.5-vl-3b', {
        status: 'downloading',
        state: LOADING_STATES.DOWNLOADING,
        percent: 30,
        abortController: visionAbort,
      });

      // Cancel vision download
      ModelDownloadManager.cancelDownload('qwen2.5-vl-3b');

      expect(ModelDownloadManager.getModelStatus('qwen2.5-vl-3b').status).toBe('cancelled');
      expect(visionAbort.signal.aborted).toBe(true);

      // Text model must remain Ready and untouched!
      expect(ModelDownloadManager.isModelReady('qwen2.5-1.5b')).toBe(true);
      expect(ModelDownloadManager.getModelStatus('qwen2.5-1.5b').status).toBe('ready');
    });
  });
});

