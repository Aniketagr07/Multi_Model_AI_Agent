import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalModelProvider } from '../services/localInference';
import {
  LOCAL_MODELS,
  DEFAULT_LOCAL_TEXT_MODEL_ID,
  isLocalVisionModelId,
  isLocalModelId,
} from '../core/localModelRegistry';

describe('Qwen2.5-1.5B Single Local Model & Multimodal Constraint Verification', () => {
  beforeEach(async () => {
    LocalModelProvider.setMockMode(true);
    await LocalModelProvider.unload();
  });

  afterEach(async () => {
    await LocalModelProvider.unload();
    LocalModelProvider.setMockMode(false);
  });

  it('Verifies Qwen2.5 1.5B is the sole registered local model', () => {
    expect(LOCAL_MODELS.length).toBe(1);
    expect(LOCAL_MODELS[0].id).toBe('qwen2.5-1.5b');
    expect(LOCAL_MODELS[0].name).toBe('Qwen2.5 1.5B');
    expect(LOCAL_MODELS[0].badge).toBe('Text / On-device');
    expect(LOCAL_MODELS[0].isVision).toBe(false);

    expect(isLocalVisionModelId('qwen2.5-1.5b')).toBe(false);
    expect(isLocalVisionModelId('qwen2.5-vl-3b')).toBe(false);
    expect(isLocalVisionModelId('florence-2')).toBe(false);

    expect(isLocalModelId('qwen2.5-1.5b')).toBe(true);
  });

  it('Task 1: General Conversation and Text Assistance', async () => {
    const chunks = [];
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Introduce yourself and describe what you can do.' }],
      modelId: 'qwen2.5-1.5b',
      onChunk: (delta) => chunks.push(delta),
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(result.content).toContain('Introduce yourself and describe what you can do');
    expect(result.provider).toBe('local');
  });

  it('Task 2: Programming and Code Explanations', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Write a Python function to reverse a linked list with explanation.' }],
      modelId: 'qwen2.5-1.5b',
    });

    expect(result.content).toContain('Write a Python function to reverse a linked list');
    expect(result.provider).toBe('local');
  });

  it('Task 3: Mathematics and Logical Reasoning', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Solve for x: 3x + 15 = 45. Explain step-by-step.' }],
      modelId: 'qwen2.5-1.5b',
    });

    expect(result.content).toContain('Solve for x: 3x + 15 = 45');
    expect(result.provider).toBe('local');
  });

  it('Task 4: Summarization and General Writing', async () => {
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'Summarize the core benefits of on-device WebGPU inference in 3 bullet points.' }],
      modelId: 'qwen2.5-1.5b',
    });

    expect(result.content).toContain('Summarize the core benefits of on-device WebGPU inference');
  });

  it('Task 5: Refuses image understanding without hallucination or technical error', async () => {
    const testImage = {
      name: 'invoice.png',
      size: 45000,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'What is the total balance on this invoice?' }],
      modelId: 'qwen2.5-1.5b',
      image: testImage,
    });

    expect(result.content).toContain('Local Image Understanding Unavailable');
    expect(result.content).toContain('Qwen2.5 1.5B');
    expect(result.content).toContain('text-only');
    expect(result.content).not.toContain('undefined is not iterable');
    expect(result.content).not.toContain('[Florence-2]');
  });
});
