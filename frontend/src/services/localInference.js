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
} from '../core/localModelRegistry';

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

        const webllm = await import('@mlc-ai/web-llm');
        const targetWebLLMId = this.modelInfo.webllmModelId;

        const initProgressCallback = (report) => {
          if (signal?.aborted) return;
          tracker.handleWebLLMEvent(report);
        };

        const engine = await webllm.CreateMLCEngine(targetWebLLMId, {
          initProgressCallback,
          appConfig: webllm.prebuiltAppConfig,
        });

        if (signal?.aborted) {
          await engine.unload();
          tracker.abort();
          throw new Error('Model loading cancelled by user.');
        }

        this.engine = engine;
        tracker.setReady('Your local text model is ready.');
        return this.engine;
      } catch (err) {
        this.engine = null;
        if (err.name === 'AbortError' || signal?.aborted || err.message?.includes('cancelled')) {
          tracker.abort('Model loading cancelled by user.');
          throw new Error('Model loading cancelled by user.');
        }
        if (tracker.state === LOADING_STATES.DOWNLOADING || tracker.state === LOADING_STATES.PREPARING) {
          tracker.setDownloadFailed(err);
        } else {
          tracker.setInitFailed(err);
        }
        throw new Error(`Failed to initialize Qwen2.5-1.5B: ${err.message}`);
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
      return await webllm.hasModelInCache(target.webllmModelId, webllm.prebuiltAppConfig);
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

  async clearCache(modelId = null) {
    if (this._isMockMode) return true;
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const textModel = getLocalModelById(DEFAULT_LOCAL_TEXT_MODEL_ID);
      await webllm.deleteModelAllInfoInCache(textModel.webllmModelId, webllm.prebuiltAppConfig);
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
