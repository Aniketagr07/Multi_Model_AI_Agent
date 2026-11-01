/**
 * Local Browser Model Registry for OmniAI
 * Defines lightweight, instruction-tuned on-device models powered by WebLLM and Transformers.js.
 *
 * Models:
 * 1. Qwen2.5-1.5B: Text generation, programming, reasoning, everyday chat (WebLLM / WebGPU).
 * 2. Qwen2.5-VL-3B: Primary conversational vision-language model for image problem solving, math, diagrams, code, and visual reasoning (Transformers.js / WebGPU).
 */

export const LOCAL_MODELS = [
  {
    id: 'qwen2.5-1.5b',
    name: 'Qwen2.5 1.5B',
    shortName: 'Qwen2.5 1.5B',
    webllmModelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    provider: 'local',
    providerGroup: 'local',
    providerGroupLabel: 'LOCAL MODELS',
    tag: 'Text / On-device',
    badge: 'Text / On-device',
    capabilities: ['text', 'code', 'reasoning', 'chat'],
    isLocal: true,
    isVision: false,
    isOperational: true,
    approxSizeMB: 850,
    vramMB: 1630,
    contextWindow: '4k tokens',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description: 'Lightweight instruction-tuned text model for everyday conversations, reasoning, and code.',
    license: 'Apache-2.0',
    publisher: 'Alibaba Cloud (Qwen Team)',
  },
  {
    id: 'qwen2.5-vl-3b',
    name: 'Qwen2.5-VL 3B',
    shortName: 'Qwen2.5-VL 3B',
    hfModelId: 'onnx-community/Qwen2.5-VL-3B-Instruct-ONNX',
    provider: 'local',
    providerGroup: 'local',
    providerGroupLabel: 'LOCAL MODELS',
    tag: 'Vision + Text / On-device',
    badge: 'Vision + Text / On-device',
    capabilities: [
      'vision',
      'visual-qa',
      'math-solving',
      'programming-from-image',
      'diagram-analysis',
      'chart-interpretation',
      'document-analysis',
      'visual-insights',
    ],
    isLocal: true,
    isVision: true,
    isOperational: true,
    approxSizeMB: 2200,
    vramMB: 3200,
    contextWindow: '4k tokens',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    iconColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    description: 'Primary conversational vision-language model for image understanding, math problem solving, and diagram reasoning.',
    license: 'Apache-2.0',
    publisher: 'Alibaba Cloud (Qwen Team)',
  },
];

export const DEFAULT_LOCAL_TEXT_MODEL_ID = 'qwen2.5-1.5b';
export const DEFAULT_LOCAL_VISION_MODEL_ID = 'qwen2.5-vl-3b';
export const DEFAULT_LOCAL_MODEL_ID = DEFAULT_LOCAL_TEXT_MODEL_ID;

export function getLocalModelById(id) {
  if (!id) return LOCAL_MODELS[0];
  // Support legacy and alias IDs
  if (
    id === 'qwen2.5-vl-3b' ||
    id === 'qwen2.5-vl' ||
    id === 'florence-2-base' ||
    id === 'florence-2' ||
    id === 'qwen3.5-0.8b'
  ) {
    return LOCAL_MODELS[1];
  }
  return (
    LOCAL_MODELS.find(
      (m) =>
        m.id === id ||
        m.webllmModelId === id ||
        m.hfModelId === id ||
        m.shortName === id
    ) || LOCAL_MODELS[0]
  );
}

export function isLocalModelId(id) {
  if (!id) return false;
  if (
    id === 'qwen2.5-vl-3b' ||
    id === 'qwen2.5-vl' ||
    id === 'florence-2-base' ||
    id === 'florence-2' ||
    id === 'qwen3.5-0.8b'
  ) {
    return true;
  }
  return LOCAL_MODELS.some(
    (m) =>
      m.id === id ||
      m.webllmModelId === id ||
      m.hfModelId === id ||
      m.shortName === id ||
      id === 'local'
  );
}

export function isLocalVisionModelId(id) {
  if (
    id === 'qwen2.5-vl-3b' ||
    id === 'qwen2.5-vl' ||
    id === 'florence-2-base' ||
    id === 'florence-2' ||
    id === 'qwen3.5-0.8b'
  ) {
    return true;
  }
  const model = getLocalModelById(id);
  return Boolean(model && model.isVision);
}
