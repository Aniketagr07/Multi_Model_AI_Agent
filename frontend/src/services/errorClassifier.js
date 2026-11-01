/**
 * errorClassifier.js: Structured, user-friendly error classification
 * for browser-based WebGPU and on-device inference.
 */

export const ERROR_CATEGORIES = {
  MODEL_CONFIG: 'Model Configuration Error',
  TOKENIZER_INIT: 'Tokenizer Initialization Error',
  VISION_PROCESSOR: 'Vision Processor Error',
  INVALID_IMAGE: 'Invalid Image Input',
  WEBGPU_INIT: 'WebGPU Initialization Error',
  INSUFFICIENT_MEMORY: 'Insufficient GPU Memory',
  MODEL_RUNTIME: 'Model Runtime Error',
  GENERATION: 'Generation Error',
};

/**
 * Categorize a runtime or inference error into a user-friendly classification.
 *
 * @param {Error|any} err - The caught error
 * @returns {{ category: string, message: string, details?: string, suggestion?: string }}
 */
export function categorizeInferenceError(err) {
  if (!err) {
    return {
      category: ERROR_CATEGORIES.MODEL_RUNTIME,
      message: 'An unknown runtime error occurred during local inference.',
    };
  }

  const rawMessage = typeof err === 'string' ? err : err.message || '';
  const lowerMsg = rawMessage.toLowerCase();
  const stack = err.stack ? String(err.stack).toLowerCase() : '';

  // 1. Out of Memory / Insufficient GPU Memory (check before general WebGPU device errors)
  if (
    lowerMsg.includes('out of memory') ||
    lowerMsg.includes('oom') ||
    lowerMsg.includes('allocation failed') ||
    lowerMsg.includes('buffer allocation') ||
    lowerMsg.includes('exceeded memory') ||
    lowerMsg.includes('device memory') ||
    (lowerMsg.includes('device lost') && lowerMsg.includes('memory'))
  ) {
    return {
      category: ERROR_CATEGORIES.INSUFFICIENT_MEMORY,
      message: 'The model requires more GPU memory (VRAM) than is currently available on your device.',
      details: rawMessage,
      suggestion: 'Close other GPU-intensive browser tabs or software to free up VRAM, or use a smaller quantized model.',
    };
  }

  // 2. WebGPU Initialization / Device / Adapter errors
  if (
    lowerMsg.includes('webgpu') ||
    lowerMsg.includes('requestdevice') ||
    lowerMsg.includes('requestadapter') ||
    lowerMsg.includes('gpuadapter') ||
    lowerMsg.includes('navigator.gpu') ||
    (lowerMsg.includes('device lost') && !lowerMsg.includes('memory'))
  ) {
    return {
      category: ERROR_CATEGORIES.WEBGPU_INIT,
      message: 'WebGPU hardware acceleration is not supported or could not be initialized on your graphics card.',
      details: rawMessage,
      suggestion: 'Ensure WebGPU is enabled in your browser settings (e.g. chrome://flags or about:config) and your graphics drivers are up to date.',
    };
  }

  // 3. Vision Processor / Preprocessing Errors
  if (
    lowerMsg.includes('image.size') ||
    lowerMsg.includes('symbol(symbol.iterator)') ||
    lowerMsg.includes('image_processor') ||
    lowerMsg.includes('smart_resize') ||
    lowerMsg.includes('preprocess') ||
    stack.includes('image_processing') ||
    stack.includes('processing_qwen')
  ) {
    return {
      category: ERROR_CATEGORIES.VISION_PROCESSOR,
      message: 'The vision processor encountered an issue preparing the image pixels for the model.',
      details: rawMessage,
      suggestion: 'Ensure the image is in a standard format (PNG, JPEG, WebP) with valid pixel dimensions.',
    };
  }

  // 4. Invalid Image Input
  if (
    lowerMsg.includes('no image provided') ||
    lowerMsg.includes('invalid image') ||
    lowerMsg.includes('rawimage') ||
    lowerMsg.includes('failed to load image') ||
    lowerMsg.includes('image data')
  ) {
    return {
      category: ERROR_CATEGORIES.INVALID_IMAGE,
      message: 'The attached image could not be decoded or was missing.',
      details: rawMessage,
      suggestion: 'Please try re-uploading the image file or using a different image.',
    };
  }

  // 5. Tokenizer Initialization / Tokenizer Errors
  if (
    lowerMsg.includes('tokenizer') ||
    lowerMsg.includes('tokenize') ||
    lowerMsg.includes('vocab') ||
    lowerMsg.includes('merges')
  ) {
    return {
      category: ERROR_CATEGORIES.TOKENIZER_INIT,
      message: 'Failed to process input prompt tokens with the model tokenizer.',
      details: rawMessage,
      suggestion: 'Verify that the tokenizer files are cached or available in browser storage.',
    };
  }

  // 6. Model Configuration Error
  if (
    lowerMsg.includes('config.json') ||
    lowerMsg.includes('autoconfig') ||
    lowerMsg.includes('unsupported model') ||
    lowerMsg.includes('modelfilenotfound')
  ) {
    return {
      category: ERROR_CATEGORIES.MODEL_CONFIG,
      message: 'Failed to load model configuration files from browser cache or repository.',
      details: rawMessage,
      suggestion: 'Clear the model cache from the Local Models menu and redownload the model files.',
    };
  }

  // 7. Generation Error
  if (
    lowerMsg.includes('generate') ||
    lowerMsg.includes('forward pass') ||
    lowerMsg.includes('session.run') ||
    lowerMsg.includes('inference failed')
  ) {
    return {
      category: ERROR_CATEGORIES.GENERATION,
      message: 'An error occurred during local token generation on WebGPU.',
      details: rawMessage,
      suggestion: 'Try regenerating the response with a shorter input or prompt.',
    };
  }

  // 8. General Model Runtime Error
  return {
    category: ERROR_CATEGORIES.MODEL_RUNTIME,
    message: rawMessage || 'An unexpected runtime error occurred during local inference.',
    details: rawMessage,
  };
}
