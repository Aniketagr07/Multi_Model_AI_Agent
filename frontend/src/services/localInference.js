/**
 * LocalModelProvider: WebLLM In-Browser Inference Engine
 * Provides the dedicated local model:
 * - LocalTextModel: Qwen2.5-1.5B for high-quality conversational text generation, reasoning, and programming (WebLLM / WebGPU).
 *
 * Runs 100% locally in the browser.
 * No prompts or data are ever sent to external servers or cloud providers.
 */

import { DownloadProgressTracker, LOADING_STATES } from './progressTracker';
import { categorizeInferenceError } from './errorClassifier';
import {
  LOCAL_MODELS,
  getLocalModelById,
  DEFAULT_LOCAL_TEXT_MODEL_ID,
  QWEN_CDN_MIRRORS,
} from '../core/localModelRegistry';

/**
 * Polyfills Cache.prototype.add in browser environments to safely handle
 * cross-origin redirects (HTTP 302/308 from huggingface.co to S3/CloudFront storage on *.cdn.hf.co).
 * Standard Cache.prototype.add() rejects with TypeError: Failed to fetch on redirects in several browser engines.
 */
export function installCacheAddPolyfill() {
  if (typeof window === 'undefined' || !window.Cache || window.__omni_cache_patched) return;
  window.__omni_cache_patched = true;

  const originalAdd = window.Cache.prototype.add;
  window.Cache.prototype.add = async function (request) {
    try {
      return await originalAdd.call(this, request);
    } catch (err) {
      const reqUrl = typeof request === 'string' ? request : request?.url;
      console.info(
        `[WebLLM Cache Recovery] Cache.add failed for ${reqUrl} (${err?.message}). Falling back to fetch(cors) + cache.put...`
      );

      const req = request instanceof Request ? request : new Request(request, { mode: 'cors' });
      const response = await fetch(req);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} while fetching ${req.url}`);
      }
      return await this.put(request, response);
    }
  };
}

/**
 * Classifies model download failures into clear, actionable categories.
 */
export function categorizeDownloadError(err, url = null) {
  const msg = err?.message || String(err);
  const name = err?.name || '';

  if (
    msg.includes('QuotaExceeded') ||
    msg.includes('quota') ||
    name === 'QuotaExceededError'
  ) {
    return {
      category: 'Insufficient Browser Storage',
      userMessage:
        'Insufficient disk space in browser cache. Qwen2.5 1.5B requires ~850MB free storage. Please free up browser space or clear site data and retry.',
      technicalDetails: msg,
    };
  }

  if (
    msg.includes('WebGPU') ||
    msg.includes('adapter') ||
    msg.includes('device lost') ||
    msg.includes('ShaderF16') ||
    msg.includes('Out of memory')
  ) {
    return {
      category: 'WebGPU Hardware Constraint',
      userMessage:
        'WebGPU hardware acceleration failed or device ran out of memory. Please close other GPU-intensive tabs/software and retry.',
      technicalDetails: msg,
    };
  }

  if (name === 'AbortError' || msg.includes('cancelled') || msg.includes('aborted')) {
    return {
      category: 'Download Cancelled',
      userMessage: 'Model download was cancelled by the user.',
      technicalDetails: msg,
    };
  }

  if (msg.includes('404') || msg.includes('Not Found') || msg.includes('Cannot locate')) {
    return {
      category: 'Model File Not Found (HTTP 404)',
      userMessage:
        'A required model weight shard or config file could not be found on the model repository. Please notify support or report this issue.',
      technicalDetails: url ? `${msg} (URL: ${url})` : msg,
    };
  }

  if (
    msg.includes('CORS') ||
    msg.includes('blocked by client') ||
    msg.includes('SecurityError') ||
    msg.includes('Cross-Origin')
  ) {
    return {
      category: 'Download Blocked by Browser Security',
      userMessage:
        'The model download was blocked by browser security or an ad-blocker extension. Please disable shields/ad-blockers for this site and retry.',
      technicalDetails: url ? `${msg} (URL: ${url})` : msg,
    };
  }

  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Cannot fetch') ||
    msg.includes('timeout')
  ) {
    return {
      category: 'Model Host Unreachable / Network Interrupted',
      userMessage:
        'Unable to download model shards from Hugging Face or CDN. This can occur due to connection drops, ISP throttling, or cross-origin redirect failures. Click "Reset Cache & Retry" to clean any partial cache and reconnect.',
      technicalDetails: url ? `${msg} (URL: ${url})` : msg,
    };
  }

  return {
    category: 'Initialization Failed',
    userMessage: `Failed to initialize Qwen2.5-1.5B: ${msg}`,
    technicalDetails: msg,
  };
}

/**
 * Builds a reliable WebLLM AppConfig with CDN mirrors and fallbacks for Qwen2.5 1.5B.
 * Primary wasm library points to jsDelivr (global CDN with CORS wildcard *),
 * avoiding the frequent connection timeouts associated with raw.githubusercontent.com.
 */
export function buildWebLLMAppConfig(webllm, options = {}) {
  const { wasmIndex = 0, modelIndex = 0 } = options;
  const wasmList = QWEN_CDN_MIRRORS?.wasm || [];
  const modelList = QWEN_CDN_MIRRORS?.model || [];

  const wasmUrl = wasmList[wasmIndex % wasmList.length] || wasmList[0];
  const modelUrl = modelList[modelIndex % modelList.length] || modelList[0];

  const targetId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  const baseConfig = webllm.prebuiltAppConfig || { model_list: [] };
  const customModelList = (baseConfig.model_list || []).map((m) => {
    if (m.model_id === targetId) {
      return {
        ...m,
        model: modelUrl,
        model_lib: wasmUrl,
      };
    }
    return m;
  });

  return {
    ...baseConfig,
    model_list: customModelList,
  };
}

/**
 * LocalTextModel: Qwen2.5-1.5B Text-Only Adapter
 * Strictly processes textual prompts, programming questions, and reasoning.
 * Does not process image pixels.
 */
export class LocalTextModel {
  constructor(provider) {
    this.provider = provider;
    this.modelId = DEFAULT_LOCAL_TEXT_MODEL_ID;
    this.modelInfo = getLocalModelById(this.modelId);
    this.engine = null;
    this.isInitializing = false;
    this.initPromise = null;
  }

  isReady() {
    return Boolean(this.engine);
  }

  async initialize({ onProgress, signal } = {}) {
    if (this.engine) {
      if (onProgress) {
        onProgress({
          state: LOADING_STATES.READY,
          progress: 1.0,
          percent: 100,
          text: 'Your local text model is ready.',
        });
      }
      return this.engine;
    }
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    const tracker = new DownloadProgressTracker({
      modelName: 'Qwen2.5 1.5B',
      expectedTotalBytes: 850 * 1024 * 1024,
      onUpdate: (report) => {
        if (signal?.aborted) return;
        if (onProgress) onProgress(report);
      },
    });

    this.initPromise = (async () => {
      try {
        if (signal?.aborted) {
          tracker.abort();
          throw new Error('Model loading cancelled by user.');
        }

        tracker.setPreparing('Preparing download for Qwen2.5 1.5B text model...');

        if (this.provider._isMockMode) {
          tracker.handleWebLLMEvent({ progress: 0.3, text: 'Downloading Qwen2.5 1.5B weights...' });
          await new Promise((r) => setTimeout(r, 40));
          if (signal?.aborted) {
            tracker.abort();
            throw new Error('Model loading cancelled by user.');
          }

          tracker.handleWebLLMEvent({ progress: 0.85, text: 'Compiling WebGPU shaders...' });
          await new Promise((r) => setTimeout(r, 40));
          if (signal?.aborted) {
            tracker.abort();
            throw new Error('Model loading cancelled by user.');
          }

          this.engine = {
            chat: {
              completions: {
                create: async ({ messages, stream }) => {
                  const lastUserMsg = messages[messages.length - 1]?.content || 'Hello';
                  const responseText = `[Qwen2.5 1.5B Local]: ${lastUserMsg} — processed on-device via WebGPU.`;
                  if (stream) {
                    const tokens = responseText.split(' ');
                    let i = 0;
                    return {
                      [Symbol.asyncIterator]() {
                        return {
                          async next() {
                            if (i >= tokens.length) return { done: true };
                            const word = tokens[i++] + (i < tokens.length ? ' ' : '');
                            return { done: false, value: { choices: [{ delta: { content: word } }] } };
                          },
                        };
                      },
                    };
                  }
                  return { choices: [{ message: { content: responseText } }] };
                },
              },
            },
            interruptGenerate: () => {},
            unload: async () => {},
          };
          tracker.setReady('Your local text model is ready.');
          return this.engine;
        }

        // Install cache polyfill to handle 302/308 redirects from Hugging Face LFS to S3 CDN
        installCacheAddPolyfill();

        const webllm = await import('@mlc-ai/web-llm');
        const targetWebLLMId = this.modelInfo.webllmModelId;

        const initProgressCallback = (report) => {
          if (signal?.aborted) return;
          tracker.handleWebLLMEvent(report);
        };

        const maxAttempts = 3;
        let lastError = null;
        let lastFailingUrl = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (signal?.aborted) {
            tracker.abort('Model loading cancelled by user.');
            throw new Error('Model loading cancelled by user.');
          }

          if (attempt > 1) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 2), 3000);
            tracker.handleWebLLMEvent({
              progress: 0.05,
              text: `Download retry (${attempt}/${maxAttempts}): switching to mirror in ${(backoffMs / 1000).toFixed(1)}s...`,
            });
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, backoffMs);
              signal?.addEventListener(
                'abort',
                () => {
                  clearTimeout(timer);
                  reject(new Error('Model loading cancelled by user.'));
                },
                { once: true }
              );
            });
          }

          // Cycle mirrors: attempt 1 uses jsDelivr (index 0), attempt 2 uses Fastly jsDelivr, attempt 3 uses GCore jsDelivr
          const appConfig = buildWebLLMAppConfig(webllm, {
            wasmIndex: attempt - 1,
            modelIndex: attempt > 1 ? 1 : 0,
          });

          const currentModelRecord = appConfig.model_list.find((m) => m.model_id === targetWebLLMId);
          console.info(`[WebLLM Diagnostics] (Attempt ${attempt}/${maxAttempts}) Loading ${targetWebLLMId}`);
          console.info(`[WebLLM Diagnostics] WASM URL: ${currentModelRecord?.model_lib}`);
          console.info(`[WebLLM Diagnostics] Model URL: ${currentModelRecord?.model}`);

          try {
            const engine = await webllm.CreateMLCEngine(targetWebLLMId, {
              initProgressCallback,
              appConfig,
            });

            if (signal?.aborted) {
              await engine.unload();
              tracker.abort('Model loading cancelled by user.');
              throw new Error('Model loading cancelled by user.');
            }

            this.engine = engine;
            tracker.setReady('Your local text model is ready.');
            return this.engine;
          } catch (err) {
            lastError = err;
            if (err.name === 'AbortError' || signal?.aborted || err.message?.includes('cancelled')) {
              tracker.abort('Model loading cancelled by user.');
              throw new Error('Model loading cancelled by user.');
            }

            // Extract failing URL if present in error message
            const urlMatch = err.message?.match(/https?:\/\/[^\s"',)]+/);
            if (urlMatch) {
              lastFailingUrl = urlMatch[0];
            } else if (!lastFailingUrl) {
              lastFailingUrl = currentModelRecord?.model_lib;
            }

            console.warn(`[WebLLM Diagnostics] Attempt ${attempt}/${maxAttempts} failed:`, err.message, 'URL:', lastFailingUrl);

            // Clean up potentially corrupted cached shards before the final attempt
            if (attempt === 2) {
              try {
                await webllm.deleteModelAllInfoInCache(targetWebLLMId, appConfig);
              } catch (_) {}
            }
          }
        }

        // All attempts failed: produce categorized, actionable message
        const classified = categorizeDownloadError(lastError, lastFailingUrl);
        const friendlyMsg = `${classified.category}: ${classified.userMessage}`;

        if (tracker.state === LOADING_STATES.DOWNLOADING || tracker.state === LOADING_STATES.PREPARING) {
          tracker.setDownloadFailed(new Error(friendlyMsg));
        } else {
          tracker.setInitFailed(new Error(friendlyMsg));
        }
        throw new Error(`Failed to initialize Qwen2.5-1.5B: ${friendlyMsg}`);
      } catch (err) {
        this.engine = null;
        if (err.name === 'AbortError' || signal?.aborted || err.message?.includes('cancelled')) {
          tracker.abort('Model loading cancelled by user.');
          throw new Error('Model loading cancelled by user.');
        }
        if (!err.message?.includes('Failed to initialize Qwen2.5-1.5B')) {
          if (tracker.state === LOADING_STATES.DOWNLOADING || tracker.state === LOADING_STATES.PREPARING) {
            tracker.setDownloadFailed(err);
          } else {
            tracker.setInitFailed(err);
          }
          throw new Error(`Failed to initialize Qwen2.5-1.5B: ${err.message}`);
        }
        throw err;
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  async streamResponse({ messages, onChunk, onDone, onError, signal, effort = 'medium' }) {
    const startTime = Date.now();
    try {
      if (!this.engine) {
        await this.initialize({ signal });
      }

      const temperature = effort === 'high' ? 0.85 : effort === 'low' ? 0.2 : 0.6;
      const systemPrompt =
        'You are OmniAI, a helpful, precise, and concise AI assistant running 100% locally in the browser via WebGPU. Answer questions accurately and provide structured markdown formatting.';

      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role || (m.sender === 'assistant' ? 'assistant' : 'user'),
          content: m.content || '',
        })),
      ];

      const stream = await this.engine.chat.completions.create({
        messages: formattedMessages,
        temperature,
        max_tokens: 2048,
        stream: true,
      });

      let accumulated = '';
      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          accumulated += delta;
          if (onChunk) onChunk(delta);
        }
      }

      const latencyMs = Date.now() - startTime;
      const result = {
        content: accumulated,
        latencyMs,
        modelId: this.modelId,
        modelName: this.modelInfo.name,
        provider: 'local',
      };

      if (onDone) onDone(result);
      return result;
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        return {
          content: '*[Generation stopped by user]*',
          latencyMs: Date.now() - startTime,
          modelId: this.modelId,
          modelName: this.modelInfo.name,
          provider: 'local',
        };
      }
      if (onError) onError(err);
      throw err;
    }
  }

  cancelGeneration() {
    if (this.engine && typeof this.engine.interruptGenerate === 'function') {
      try {
        this.engine.interruptGenerate();
      } catch (err) {
        console.warn('[LocalTextModel] Interrupt error:', err);
      }
    }
  }

  async unload() {
    if (this.engine && typeof this.engine.unload === 'function') {
      try {
        await this.engine.unload();
      } catch (e) {
        console.warn('[LocalTextModel] Unload warning:', e);
      }
    }
    this.engine = null;
  }
}

/**
 * Primary Local Model Provider Service
 * Coordinates browser-based on-device execution for Qwen2.5 1.5B.
 */
class LocalModelProviderService {
  constructor() {
    this._isMockMode =
      typeof process !== 'undefined' &&
      (process.env?.NODE_ENV === 'test' || process.env?.VITEST === 'true');
    this.textModel = new LocalTextModel(this);
  }

  setMockMode(enabled) {
    this._isMockMode = Boolean(enabled);
  }

  isAvailable() {
    if (this._isMockMode) return { available: true };
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return { available: false, reason: 'Non-browser execution environment.' };
    }
    if (!('gpu' in navigator) || !navigator.gpu) {
      return {
        available: false,
        reason:
          'WebGPU is not supported or enabled in this browser. Please use Chrome 113+, Edge 113+, Safari 18+, or Firefox 115+ (with dom.webgpu.enabled) on a compatible GPU.',
      };
    }
    return { available: true };
  }

  /**
   * Deep diagnostics for WebGPU hardware adapter and available browser storage quota.
   */
  async checkCapabilities() {
    if (this._isMockMode) {
      return { available: true, adapter: true, storageEstimate: { freeMB: 10000 } };
    }
    const basic = this.isAvailable();
    if (!basic.available) return basic;

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return {
          available: false,
          reason:
            'WebGPU adapter could not be initialized. Please check that hardware acceleration is enabled in your browser settings and GPU drivers are up to date.',
        };
      }

      let storageEstimate = null;
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          const freeBytes = (est.quota || 0) - (est.usage || 0);
          const freeMB = Math.round(freeBytes / (1024 * 1024));
          storageEstimate = { freeMB, quotaMB: Math.round((est.quota || 0) / (1024 * 1024)) };
          // Qwen2.5 1.5B requires ~850MB download + ~500MB headroom
          if (freeMB < 1200) {
            console.warn(`[LocalModelProvider] Low storage warning: only ${freeMB} MB free.`);
          }
        } catch (_) {}
      }

      return { available: true, adapter, storageEstimate };
    } catch (err) {
      return {
        available: false,
        reason: `WebGPU initialization check failed: ${err.message}`,
      };
    }
  }

  hasActiveImageContext() {
    return false;
  }

  isReady() {
    return this.textModel.isReady();
  }

  async isCached(modelId = DEFAULT_LOCAL_TEXT_MODEL_ID) {
    if (this._isMockMode) return true;
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const target = getLocalModelById(modelId);
      const appConfig = buildWebLLMAppConfig(webllm);
      return await webllm.hasModelInCache(target.webllmModelId, appConfig);
    } catch (err) {
      console.warn('[LocalModelProvider] Cache check warning:', err);
      return false;
    }
  }

  async initialize({ onProgress = null, signal = null } = {}) {
    return await this.textModel.initialize({ onProgress, signal });
  }

  async streamResponse(options = {}) {
    const { image, onChunk, onDone } = options;

    // Strict validation: Qwen2.5 1.5B is text-only. If an image is passed, explain clearly.
    if (image) {
      const explanation =
        '⚠️ **Local Image Understanding Unavailable**\n\n' +
        "OmniAI's on-device model (`Qwen2.5 1.5B`) is a text-only language model and does not process image inputs.\n\n" +
        'To analyze images or documents, please switch to a vision-capable cloud model with your connected API key, or remove the image attachment to continue text chat with Qwen2.5 1.5B.';

      if (onChunk) onChunk(explanation);
      const result = {
        content: explanation,
        latencyMs: 15,
        modelId: this.textModel.modelId,
        modelName: this.textModel.modelInfo.name,
        provider: 'local',
      };
      if (onDone) onDone(result);
      return result;
    }

    return await this.textModel.streamResponse(options);
  }

  cancelGeneration() {
    this.textModel.cancelGeneration();
  }

  /**
   * Resets and purges only the local Qwen2.5 1.5B model cache without clearing other browser storage.
   */
  async clearCache(modelId = null) {
    if (this._isMockMode) return true;
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const textModel = getLocalModelById(DEFAULT_LOCAL_TEXT_MODEL_ID);
      const appConfig = buildWebLLMAppConfig(webllm);

      try {
        await webllm.deleteModelAllInfoInCache(textModel.webllmModelId, appConfig);
      } catch (e) {
        console.warn('[LocalModelProvider] WebLLM deleteModelAllInfoInCache warning:', e);
      }

      // Purge only WebLLM cache namespaces in Cache Storage
      if (typeof window !== 'undefined' && 'caches' in window) {
        const webllmCacheNames = ['webllm/model', 'webllm/config', 'webllm/wasm'];
        await Promise.all(
          webllmCacheNames.map(async (name) => {
            try {
              await window.caches.delete(name);
            } catch (_) {}
          })
        );
      }

      await this.unload();
      return true;
    } catch (err) {
      console.error('[LocalModelProvider] Failed to clear model cache:', err);
      throw err;
    }
  }

  async unload() {
    await this.textModel.unload();
  }
}

export const LocalModelProvider = new LocalModelProviderService();
export default LocalModelProvider;

export { LOADING_STATES };
