/**
 * Local Browser Model Registry for OmniAI
 * Defines the sole on-device text model powered by WebLLM / WebGPU.
 *
 * Model:
 * Qwen2.5-1.5B-Instruct: Text generation, programming, reasoning, everyday chat.
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
    capabilities: ['text', 'code', 'reasoning', 'chat', 'math', 'summarization'],
    isLocal: true,
    isVision: false,
    isOperational: true,
    approxSizeMB: 850,
    vramMB: 1630,
    contextWindow: '4k tokens',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    iconColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    description: 'Lightweight local AI model for conversations, programming and everyday assistance.',
    license: 'Apache-2.0',
    publisher: 'Alibaba Cloud (Qwen Team)',
  },
];

export const DEFAULT_LOCAL_TEXT_MODEL_ID = 'qwen2.5-1.5b';
export const DEFAULT_LOCAL_MODEL_ID = DEFAULT_LOCAL_TEXT_MODEL_ID;
export const DEFAULT_LOCAL_VISION_MODEL_ID = null;

export function getLocalModelById(id) {
  if (!id) return LOCAL_MODELS[0];
  return (
    LOCAL_MODELS.find(
      (m) =>
        m.id === id ||
        m.webllmModelId === id ||
        m.shortName === id
    ) || LOCAL_MODELS[0]
  );
}

export function isLocalModelId(id) {
  if (!id) return false;
  return (
    id === 'qwen2.5-1.5b' ||
    id === 'local' ||
    LOCAL_MODELS.some(
      (m) =>
        m.id === id ||
        m.webllmModelId === id ||
        m.shortName === id
    )
  );
}

export function isLocalVisionModelId(id) {
  return false;
}
