import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble, formatRespondingModelName, resolveProviderForModel } from '../components/MessageBubble';

describe('Responding Model Attribution in MessageBubble', () => {
  it('1. formats and displays Gemini response attribution with logo and clean name', () => {
    const geminiMessage = {
      id: 'msg-gemini',
      sender: 'assistant',
      modelId: 'gemini-3.8-flash',
      modelName: 'Gemini 3.8 Flash (Latest)',
      provider: 'gemini',
      content: 'Hello! How can I help you today?',
    };

    render(
      <MessageBubble
        message={geminiMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    // Displays clean shortened model name
    expect(screen.getByText('Gemini 3.8 Flash')).toBeInTheDocument();
    // Message content is rendered
    expect(screen.getByText('Hello! How can I help you today?')).toBeInTheDocument();
    // Does NOT display technical badges or noise
    expect(screen.queryByText(/Latest/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Auto:/i)).not.toBeInTheDocument();
  });

  it('2. formats and displays Groq response attribution with clean Llama 3.1 name', () => {
    const groqMessage = {
      id: 'msg-groq',
      sender: 'assistant',
      modelId: 'llama-3.1-8b-instant',
      modelName: 'Llama 3.1 8B (Groq LPU Free Tier)',
      provider: 'groq',
      content: 'Here is the solution to your coding question...',
    };

    render(
      <MessageBubble
        message={groqMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Llama 3.1')).toBeInTheDocument();
    expect(screen.getByText('Here is the solution to your coding question...')).toBeInTheDocument();
    expect(screen.queryByText(/Groq LPU/i)).not.toBeInTheDocument();
  });

  it('3. handles auto-routing by displaying the actual model selected by the router', () => {
    const autoRoutedMessage = {
      id: 'msg-auto',
      sender: 'assistant',
      modelId: 'llama-3.1-8b-instant',
      modelName: 'Llama 3.1',
      provider: 'groq',
      routed: true,
      routingCategory: 'coding',
      content: 'def binary_search(arr, target): ...',
    };

    render(
      <MessageBubble
        message={autoRoutedMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    // Displays actual selected model, NOT "Auto"
    expect(screen.getByText('Llama 3.1')).toBeInTheDocument();
    expect(screen.queryByText(/Auto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/coding/i)).not.toBeInTheDocument();
  });

  it('4. displays fallback model when primary model failed and fallback was used', () => {
    const fallbackMessage = {
      id: 'msg-fallback',
      sender: 'assistant',
      modelId: 'llama-3.3-70b-versatile',
      modelName: 'Llama 3.3',
      provider: 'groq',
      fallbackUsed: true,
      content: 'Response generated via fallback engine.',
    };

    render(
      <MessageBubble
        message={fallbackMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    // Shows actual fallback model name
    expect(screen.getByText('Llama 3.3')).toBeInTheDocument();
    expect(screen.queryByText(/Fallback Model/i)).not.toBeInTheDocument();
  });

  it('5. omits model attribution when model information is completely unavailable', () => {
    const unannotatedMessage = {
      id: 'msg-unknown',
      sender: 'assistant',
      content: 'Response with unknown model origin',
    };

    const { container } = render(
      <MessageBubble
        message={unannotatedMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Response with unknown model origin')).toBeInTheDocument();
    // Attribution container should not render guessing text
    expect(container.querySelector('.text-slate-300.font-medium')).toBeNull();
  });

  it('6. shows subtle resolving loading indicator during streaming before model is confirmed', () => {
    const streamingResolvingMessage = {
      id: 'msg-streaming',
      sender: 'assistant',
      content: '',
      isStreaming: true,
      modelId: null,
      modelName: null,
    };

    render(
      <MessageBubble
        message={streamingResolvingMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Resolving model...')).toBeInTheDocument();
  });

  it('7. renders clean user message with no model attribution and no You header', () => {
    const userMessage = {
      id: 'msg-user',
      sender: 'user',
      content: 'Can you explain Dijkstra algorithm?',
    };

    render(
      <MessageBubble
        message={userMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText('Can you explain Dijkstra algorithm?')).toBeInTheDocument();
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolving model...')).not.toBeInTheDocument();
  });
});
