import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelSelector, AVAILABLE_MODELS } from '../components/ModelSelector';
import { CompareView } from '../components/CompareView';
import { MessageBubble } from '../components/MessageBubble';
import * as api from '../services/api';

vi.mock('../services/api');

describe('Model Selection, Auto-Routing, and Comparison Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders model selector dropdown and switches active model', () => {
    const handleSelectModel = vi.fn();
    render(
      <ModelSelector
        selectedModelId="auto"
        onSelectModel={handleSelectModel}
        disabled={false}
      />
    );

    // Open dropdown
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Click on Gemini 3.6 Flash
    const geminiOption = screen.getByText('Gemini 3.6 Flash (Active)');
    expect(geminiOption).toBeInTheDocument();
    fireEvent.click(geminiOption);

    expect(handleSelectModel).toHaveBeenCalledWith('gemini-3.6-flash');
  });

  it('displays intelligent auto-routing metadata and rationale badges', () => {
    const routedMessage = {
      id: 'msg-routed',
      sender: 'assistant',
      modelName: 'Llama 3.1 8B',
      provider: 'groq',
      content: 'Here is the Python binary search algorithm...',
      routed: true,
      routingCategory: 'coding',
      routingExplanation: 'Classified prompt as coding task; routed to ultra-fast Groq LPU engine.',
      latencyMs: 140,
      timestamp: new Date().toISOString(),
    };

    render(
      <MessageBubble
        message={routedMessage}
        onRetry={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText(/Auto: coding/i)).toBeInTheDocument();
    expect(screen.getByText(/Classified prompt as coding task/i)).toBeInTheDocument();
  });

  it('renders Model Comparison view and broadcasts prompt to both models', async () => {
    api.sendCompareRequest.mockResolvedValueOnce({
      prompt: 'Compare Fibonacci',
      model_a: {
        model_id: 'gemini-3.6-flash',
        name: 'Gemini 3.6 Flash',
        provider: 'gemini',
        success: true,
        response: 'def fib(n): return n if n <= 1 else fib(n-1) + fib(n-2)',
        latency_ms: 320,
      },
      model_b: {
        model_id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B',
        provider: 'groq',
        success: true,
        response: 'def fibonacci(n): a, b = 0, 1; return a',
        latency_ms: 125,
      },
      timestamp: new Date().toISOString(),
    });

    render(
      <CompareView
        onBackToChat={vi.fn()}
      />
    );

    // Type prompt into textarea
    const textarea = screen.getByPlaceholderText(/Enter a prompt to broadcast/i);
    fireEvent.change(textarea, { target: { value: 'Compare Fibonacci' } });

    // Submit comparison
    const submitBtn = screen.getByRole('button', { name: /Compare Models/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/def fib\(n\):/)).toBeInTheDocument();
      expect(screen.getByText(/def fibonacci\(n\):/)).toBeInTheDocument();
    });

    expect(screen.getByText(/320ms/)).toBeInTheDocument();
    expect(screen.getByText(/125ms/)).toBeInTheDocument();
  });
});
