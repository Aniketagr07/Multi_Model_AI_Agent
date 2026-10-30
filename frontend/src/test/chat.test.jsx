import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatWindow } from '../components/ChatWindow';
import { MessageComposer } from '../components/MessageComposer';
import { MessageBubble } from '../components/MessageBubble';
import { AVAILABLE_MODELS } from '../components/ModelSelector';

describe('Chat Interface & Message Submission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders WelcomeScreen when no messages are present in active chat', () => {
    const handleSelectPrompt = vi.fn();
    render(
      <ChatWindow
        messages={[]}
        isLoading={false}
        onSelectPrompt={handleSelectPrompt}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText(/Your AI workspace, all in one place/i)).toBeInTheDocument();
    expect(screen.getByText(/Ask a question, explore ideas/i)).toBeInTheDocument();
  });

  it('renders conversational messages properly for both user and assistant', () => {
    const messages = [
      {
        id: 'msg-1',
        sender: 'user',
        content: 'Hello OmniAI!',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        sender: 'assistant',
        modelName: 'Gemini 3.6 Flash',
        provider: 'gemini',
        content: 'Hello! How can I help you today?',
        latencyMs: 250,
        timestamp: new Date().toISOString(),
      },
    ];

    render(
      <ChatWindow
        messages={messages}
        isLoading={false}
        onSelectPrompt={vi.fn()}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Hello OmniAI!')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('Gemini 3.6 Flash')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('250ms'))).toBeInTheDocument();
  });

  it('submits message on Enter key without shift', () => {
    const handleSend = vi.fn();
    const setInput = vi.fn();

    render(
      <MessageComposer
        input="Tell me about algorithms"
        setInput={setInput}
        onSend={handleSend}
        isLoading={false}
        selectedModelId="auto"
        selectedModel={AVAILABLE_MODELS[0]}
        onSelectModel={vi.fn()}
        effort="medium"
        onSelectEffort={vi.fn()}
        attachedDocument={null}
        onRemoveDocument={vi.fn()}
        onAttachFile={vi.fn()}
        isUploadingDocument={false}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handleSend).toHaveBeenCalledTimes(1);
  });

  it('does NOT submit message on Shift + Enter but allows multiline', () => {
    const handleSend = vi.fn();
    const setInput = vi.fn();

    render(
      <MessageComposer
        input="Line 1"
        setInput={setInput}
        onSend={handleSend}
        isLoading={false}
        selectedModelId="auto"
        selectedModel={AVAILABLE_MODELS[0]}
        onSelectModel={vi.fn()}
        effort="medium"
        onSelectEffort={vi.fn()}
        attachedDocument={null}
        onRemoveDocument={vi.fn()}
        onAttachFile={vi.fn()}
        isUploadingDocument={false}
      />
    );

    const textarea = screen.getByPlaceholderText(/Ask anything/i);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(handleSend).not.toHaveBeenCalled();
  });

  it('displays loading streaming pulse and error retry states', () => {
    const streamingMessage = {
      id: 'msg-stream',
      sender: 'assistant',
      modelName: 'Gemini 3.6 Flash',
      provider: 'gemini',
      content: 'Generating content progressively...',
      isStreaming: true,
      timestamp: new Date().toISOString(),
    };

    const { rerender } = render(
      <MessageBubble
        message={streamingMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Generating content progressively...')).toBeInTheDocument();

    // Test error state
    const handleRetry = vi.fn();
    const errorMessage = {
      id: 'msg-err',
      sender: 'assistant',
      modelName: 'Llama 3.1 8B',
      modelId: 'llama-3.1-8b-instant',
      effort: 'medium',
      originalUserMessage: 'Original prompt',
      provider: 'groq',
      content: 'Provider timeout error occurred.',
      isError: true,
      timestamp: new Date().toISOString(),
    };

    rerender(
      <MessageBubble
        message={errorMessage}
        onRetry={handleRetry}
        onRegenerate={vi.fn()}
      />
    );

    const retryBtn = screen.getByText('Retry Message');
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledWith('Original prompt', 'llama-3.1-8b-instant', 'medium');
  });
});
