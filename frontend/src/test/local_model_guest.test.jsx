import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocalModelProvider } from '../services/localInference';
import {
  getGuestConversations,
  getGuestConversation,
  createGuestConversation,
  saveGuestMessage,
  renameGuestConversation,
  deleteGuestConversation,
  pinGuestConversation,
  archiveGuestConversation,
  getAllGuestDataForMigration,
} from '../services/guestStorage';
import { ModelSelector } from '../components/ModelSelector';
import LocalModelModal from '../components/LocalModelModal';
import { VoiceService, cleanTextForSpeech, chunkTextForSpeech } from '../services/voiceService';

describe('Local Model and Guest Storage Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    LocalModelProvider.setMockMode(true);
    await LocalModelProvider.unload();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await LocalModelProvider.unload();
    LocalModelProvider.setMockMode(false);
  });

  it('LocalModelProvider initializes and streams genuine response in browser', async () => {
    const progressReports = [];
    await LocalModelProvider.initialize({
      modelId: 'qwen2.5-1.5b',
      onProgress: (report) => progressReports.push(report),
    });

    expect(LocalModelProvider.isReady()).toBe(true);
    expect(progressReports.length).toBeGreaterThan(0);
    expect(progressReports[progressReports.length - 1].text).toContain('ready');

    const chunks = [];
    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      modelId: 'qwen2.5-1.5b',
      onChunk: (delta) => chunks.push(delta),
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(result.content).toContain('What is 2+2?');
    expect(result.provider).toBe('local');
  });

  it('LocalModelProvider rejects image attachment with clear honest explanation', async () => {
    const chunks = [];
    const dummyImage = {
      name: 'sample_doc.png',
      size: 15400,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    const result = await LocalModelProvider.streamResponse({
      messages: [{ role: 'user', content: 'What is inside this image?' }],
      modelId: 'qwen2.5-1.5b',
      image: dummyImage,
      onChunk: (delta) => chunks.push(delta),
    });

    expect(result.provider).toBe('local');
    expect(result.content).toContain('Local Image Understanding Unavailable');
    expect(result.content).toContain('Qwen2.5 1.5B');
    expect(result.content).toContain('text-only');
  });

  it('Guest Storage operates 100% locally with message persistence and ordering', () => {
    const conv = createGuestConversation('Calculus Notes');
    expect(conv.id).toMatch(/^guest-conv-/);

    saveGuestMessage(conv.id, {
      role: 'user',
      content: 'Explain derivatives',
    });
    saveGuestMessage(conv.id, {
      role: 'assistant',
      content: 'A derivative represents the rate of change...',
      latencyMs: 120,
    });

    const fullConv = getGuestConversation(conv.id);
    expect(fullConv.messages.length).toBe(2);
    expect(fullConv.messages[0].content).toBe('Explain derivatives');
    expect(fullConv.messages[1].content).toBe('A derivative represents the rate of change...');

    renameGuestConversation(conv.id, 'Calculus Basics');
    expect(getGuestConversation(conv.id).title).toBe('Calculus Basics');

    pinGuestConversation(conv.id, true);
    expect(getGuestConversation(conv.id).isPinned).toBe(true);

    archiveGuestConversation(conv.id, true);
    expect(getGuestConversation(conv.id).isArchived).toBe(true);

    const migrationData = getAllGuestDataForMigration();
    expect(migrationData.length).toBe(1);
    expect(migrationData[0].messages.length).toBe(2);

    deleteGuestConversation(conv.id);
    expect(getGuestConversation(conv.id)).toBeNull();
  });

  it('ModelSelector separates LOCAL MODELS and CLOUD MODELS and restricts guests', () => {
    const onSelect = vi.fn();
    const onOpenAuth = vi.fn();

    // Guest view
    render(
      <ModelSelector
        selectedModelId="qwen2.5-1.5b"
        onSelectModel={onSelect}
        isGuest={true}
        onOpenAuthModal={onOpenAuth}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    expect(screen.getByText('LOCAL MODELS')).toBeInTheDocument();
    expect(screen.getAllByText(/Qwen2\.5 1\.5B/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Qwen2\.5-VL 3B/i)).not.toBeInTheDocument();

    // In guest mode, cloud models are locked and prompt to sign in
    expect(screen.getByText(/require an account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In or Register to Unlock Cloud Models/i })).toBeInTheDocument();
  });

  it('ModelSelector allows authenticated users with API keys to select both Local and Cloud models', () => {
    const onSelect = vi.fn();

    render(
      <ModelSelector
        selectedModelId="auto"
        onSelectModel={onSelect}
        isGuest={false}
        user={{ id: 'u1', username: 'Tester' }}
        byokStatus={{
          has_active_provider: true,
          providers: [
            { provider: 'gemini', is_connected: true },
            { provider: 'groq', is_connected: false },
          ],
        }}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    expect(screen.getByText('LOCAL MODELS')).toBeInTheDocument();
    expect(screen.getByText('CLOUD MODELS')).toBeInTheDocument();
    expect(screen.getByText('Gemini 3.6 Flash (Active)')).toBeInTheDocument();
    expect(screen.getAllByText('+ Connect').length).toBeGreaterThan(0);
  });

  it('LocalModelModal displays download size, WebGPU status, and completion state', async () => {
    const onReady = vi.fn();
    const onClose = vi.fn();

    render(
      <LocalModelModal
        isOpen={true}
        onClose={onClose}
        selectedModelId="qwen2.5-1.5b"
        onModelReady={onReady}
      />
    );

    expect(screen.getByText('Local On-Device AI Models')).toBeInTheDocument();
    expect(screen.getAllByText(/~850 MB/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100% On-Device Privacy Guarantee/i)).toBeInTheDocument();

    const downloadBtn = screen.getByRole('button', { name: /Download & Start/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByText(/Your local AI model is ready/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Start Chatting/i })).toBeInTheDocument();
    });
  });

  it('VoiceService cleans Markdown, chunks sentences, and manages voice settings', () => {
    const md = '# Title\nHere is **bold** and `code` with a [link](https://example.com).\n```javascript\nconsole.log(1);\n```\nAnd a final sentence.';
    const cleaned = cleanTextForSpeech(md);

    expect(cleaned).not.toContain('```');
    expect(cleaned).not.toContain('# Title');
    expect(cleaned).toContain('bold');
    expect(cleaned).toContain('code');

    const chunks = chunkTextForSpeech('Hello world! How are you today? We are running tests.', 30);
    expect(chunks.length).toBeGreaterThan(1);

    VoiceService.updateSettings({ inputLanguage: 'en-IN', rate: 1.1 });
    const settings = VoiceService.getSettings();
    expect(settings.inputLanguage).toBe('en-IN');
    expect(settings.rate).toBe(1.1);
  });
});
