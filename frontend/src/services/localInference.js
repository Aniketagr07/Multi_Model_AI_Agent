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
 * Polyfills Cache.prototype.add and window.fetch in browser environments:
 * 1. Strips the Referer header on requests to Hugging Face (huggingface.co / hf.co) because
 *    Hugging Face's edge gateway explicitly returns HTTP 404 to requests originating from *.workers.dev.
 * 2. Safely handles cross-origin redirects (HTTP 302/307/308 from huggingface.co to CDN storage).
 */
export function installCacheAddPolyfill() {
  if (typeof window === 'undefined') return;

  // Intercept fetch calls to Hugging Face and ensure no workers.dev Referer header is sent
  if (window.fetch && !window.__omni_fetch_patched) {
    window.__omni_fetch_patched = true;
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
      if (url.includes('huggingface.co') || url.includes('hf.co')) {
        if (input instanceof Request) {
          const clonedReq = new Request(input, { referrer: '', referrerPolicy: 'no-referrer' });
          return originalFetch.call(this, clonedReq);
        }
        const updatedInit = { ...init, referrer: '', referrerPolicy: 'no-referrer' };
        return originalFetch.call(this, input, updatedInit);
      }
      return originalFetch.call(this, input, init);
    };
  }

  if (!window.Cache || window.__omni_cache_patched) return;
  window.__omni_cache_patched = true;

  const originalAdd = window.Cache.prototype.add;
  window.Cache.prototype.add = async function (request) {
    try {
      return await originalAdd.call(this, request);
    } catch (err) {
      const reqUrl = typeof request === 'string' ? request : request?.url;
      console.info(
        `[WebLLM Cache Recovery] Cache.add redirected/failed for ${reqUrl} (${err?.message}). Fetching via CORS and caching...`
      );

      const signal = request instanceof Request ? request.signal : undefined;
      const fetchReq = new Request(reqUrl, {
        mode: 'cors',
        credentials: 'omit',
        referrer: '',
        referrerPolicy: 'no-referrer',
        signal,
      });

      const response = await fetch(fetchReq);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText} while downloading ${reqUrl}`);
      }

      // If the response underwent an HTTP redirect, response.redirected === true.
      // The WHATWG Cache API specification requires browsers to reject put() with a TypeError
      // when storing redirected responses. Wrapping in new Response(response.body) clears response.redirected.
      const cleanResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // cache.put accepts (Request | URL string, Response)
      // Passing reqUrl guarantees exact match with cache.match(new Request(url))
      return await this.put(reqUrl, cleanResponse);
    }
  };
}

/**
 * Classifies model download failures into clear, actionable categories.
 */
export function categorizeDownloadError(err, url = null) {
  const msg = err?.message || String(err);
  const name = err?.name || 'Error';
  const statusMatch = msg.match(/HTTP\s+(\d{3})/i) || msg.match(/status\s*[:=]\s*(\d{3})/i);
  const httpStatus = statusMatch ? statusMatch[1] : null;

  if (
    msg.includes('QuotaExceeded') ||
    msg.includes('quota') ||
    name === 'QuotaExceededError'
  ) {
    return {
      category: 'Insufficient Browser Storage',
      userMessage: `Disk storage quota exceeded while caching model files. Free up at least ~850MB and retry. (${msg})`,
      technicalDetails: `Exception: [${name}] ${msg}${url ? ` | Target: ${url}` : ''}`,
      httpStatus,
      url,
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
      userMessage: `WebGPU acceleration constraint: ${msg}. Close other GPU-heavy tabs/apps and retry.`,
      technicalDetails: `Exception: [${name}] ${msg}${url ? ` | Target: ${url}` : ''}`,
      httpStatus,
      url,
    };
  }

  if (name === 'AbortError' || msg.includes('cancelled') || msg.includes('aborted')) {
    return {
      category: 'Download Cancelled',
      userMessage: 'Model download was cancelled by the user.',
      technicalDetails: `Exception: [${name}] ${msg}`,
      httpStatus,
      url,
    };
  }

  if (msg.includes('404') || msg.includes('Not Found') || msg.includes('Cannot locate') || httpStatus === '404') {
    return {
      category: 'Model File Not Found (HTTP 404)',
      userMessage: `File not found on repository: ${msg}.${url ? ` Failed URL: ${url}.` : ''}`,
      technicalDetails: `Exception: [${name}] ${msg} | HTTP 404${url ? ` | Target: ${url}` : ''}`,
      httpStatus: '404',
      url,
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
      userMessage: `Cross-origin request blocked: ${msg}.${url ? ` Failed URL: ${url}.` : ''} Check browser ad-blockers or security extensions.`,
      technicalDetails: `Exception: [${name}] ${msg}${url ? ` | Target: ${url}` : ''}`,
      httpStatus,
      url,
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
      userMessage: `Unable to download model files: ${msg}.${url ? ` Failed URL: ${url}.` : ''} Click "Reset Cache & Retry" to clear partial downloads and reconnect.`,
      technicalDetails: `Exception: [${name}] ${msg}${httpStatus ? ` | HTTP ${httpStatus}` : ''}${url ? ` | Target: ${url}` : ''}`,
      httpStatus,
      url,
    };
  }

  return {
    category: 'Initialization Failed',
    userMessage: `Failed to initialize Qwen2.5-1.5B: ${msg}.${url ? ` Target URL: ${url}.` : ''}`,
    technicalDetails: `Exception: [${name}] ${msg}${url ? ` | Target: ${url}` : ''}`,
    httpStatus,
    url,
  };
}

/**
 * Builds a reliable WebLLM AppConfig with CDN mirrors and fallbacks for Qwen2.5 1.5B.
 * Primary wasm library points to jsDelivr (global CDN with CORS wildcard *),
 * avoiding the frequent connection timeouts associated with raw.githubusercontent.com.
 */
export function buildWebLLMAppConfig(webllm, options = {}) {
  const { wasmIndex = 0, modelIndex = 0, cacheBackend = 'indexeddb' } = options;
  const wasmList = QWEN_CDN_MIRRORS?.wasm || [];
  const modelList = QWEN_CDN_MIRRORS?.model || [];

  const wasmUrl = wasmList[wasmIndex % wasmList.length] || wasmList[0];
  const modelUrl = modelList[modelIndex % modelList.length] || modelList[0];

  const targetId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  const baseConfig = webllm.prebuiltAppConfig || { model_list: [] };
  let found = false;
  const customModelList = (baseConfig.model_list || []).map((m) => {
    if (m.model_id === targetId) {
      found = true;
      return {
        ...m,
        model: modelUrl,
        model_lib: wasmUrl,
      };
    }
    return m;
  });

  if (!found) {
    customModelList.push({
      model_id: targetId,
      model: modelUrl,
      model_lib: wasmUrl,
      low_resource_required: true,
      vram_required_MB: 1629.75,
      overrides: {
        context_window_size: 4096,
      },
    });
  }

  return {
    ...baseConfig,
    cacheBackend,
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

          // Attempt 1 & 2 use IndexedDB (zero Cache API redirect issues), cycling jsDelivr mirrors
          // Attempt 3 uses Cache Storage with clean-response redirect polyfill
          const appConfig = buildWebLLMAppConfig(webllm, {
            wasmIndex: attempt - 1,
            modelIndex: 0,
            cacheBackend: attempt <= 2 ? 'indexeddb' : 'cache',
          });

          const currentModelRecord = appConfig.model_list.find((m) => m.model_id === targetWebLLMId);
          console.info(
            `[WebLLM Diagnostics] (Attempt ${attempt}/${maxAttempts}) Loading ${targetWebLLMId} using backend: ${appConfig.cacheBackend}`
          );
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

            console.error(`[WebLLM Diagnostics] Attempt ${attempt}/${maxAttempts} failed:`, {
              message: err?.message,
              name: err?.name,
              stack: err?.stack,
              url: lastFailingUrl,
              backend: appConfig.cacheBackend,
            });

            // Clean up potentially corrupted cached shards before the final attempt
            if (attempt === 2) {
              try {
                await webllm.deleteModelAllInfoInCache(targetWebLLMId, appConfig);
              } catch (_) {}
            }
          }
        }

        // All attempts failed: produce detailed, actionable message
        const classified = categorizeDownloadError(lastError, lastFailingUrl);
        const detailedMsg = `${classified.category}: ${classified.userMessage}`;
        console.error('[WebLLM Final Failure Diagnostic Info]', {
          lastError,
          lastFailingUrl,
          classified,
        });

        if (tracker.state === LOADING_STATES.DOWNLOADING || tracker.state === LOADING_STATES.PREPARING) {
          tracker.setDownloadFailed(new Error(detailedMsg));
        } else {
          tracker.setInitFailed(new Error(detailedMsg));
        }
        throw new Error(`Failed to initialize Qwen2.5-1.5B: ${detailedMsg}`);
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

      // 1. Purge WebLLM and TVM IndexedDB databases
      if (typeof window !== 'undefined' && 'indexedDB' in window) {
        const dbNames = ['webllm/model', 'webllm/config', 'webllm/wasm', 'tvmjs'];
        for (const name of dbNames) {
          try {
            window.indexedDB.deleteDatabase(name);
          } catch (_) {}
        }
      }

      // 2. Purge only WebLLM and TVM cache namespaces in Cache Storage
      if (typeof window !== 'undefined' && 'caches' in window) {
        const webllmCacheNames = ['webllm/model', 'webllm/config', 'webllm/wasm', 'tvmjs'];
        await Promise.all(
          webllmCacheNames.map(async (name) => {
            try {
              await window.caches.delete(name);
            } catch (_) {}
          })
        );
        try {
          const keys = await window.caches.keys();
          for (const key of keys) {
            if (key.startsWith('webllm/') || key.startsWith('tvmjs')) {
              await window.caches.delete(key);
            }
          }
        } catch (_) {}
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
