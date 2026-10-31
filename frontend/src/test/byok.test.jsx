import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BYOKOnboardingModal from '../components/BYOKOnboardingModal';
import { SettingsView } from '../components/SettingsView';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  getBYOKStatus: vi.fn(),
  validateBYOKKey: vi.fn(),
  saveBYOKKey: vi.fn(),
  deleteBYOKKey: vi.fn(),
  fetchModelRegistry: vi.fn().mockResolvedValue({ models: [] }),
  fetchLinkedProviders: vi.fn().mockResolvedValue({ providers: [] }),
  unlinkProvider: vi.fn(),
  fetchOAuthUrl: vi.fn(),
}));

describe('BYOK Onboarding Modal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getBYOKStatus.mockResolvedValue({
      byok_setup_completed: false,
      has_active_provider: false,
      total_connected: 0,
      providers: [
        { provider: 'gemini', name: 'Google Gemini', is_connected: false, key_fingerprint: null },
        { provider: 'groq', name: 'Groq Cloud', is_connected: false, key_fingerprint: null },
      ],
    });
  });

  it('renders Welcome screen with title, benefits, and action buttons', async () => {
    render(
      <BYOKOnboardingModal
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        isExistingUser={false}
      />
    );

    expect(screen.getAllByText('Welcome to OmniAI').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/AES-256 Authenticated Encryption/i)).toBeInTheDocument();
    expect(screen.getByText(/Personal Quota & Full Speed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i'll do this later/i })).toBeInTheDocument();
  });

  it('advances to Provider Setup Screen on Get Started click', async () => {
    render(
      <BYOKOnboardingModal
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    const getStartedBtn = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(getStartedBtn);

    expect(screen.getByText('How to get your API key:')).toBeInTheDocument();
    expect(screen.getByText(/Google AI Studio/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('AIzaSy...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save api key/i })).toBeInTheDocument();
  });

  it('tests connection and saves key successfully', async () => {
    api.validateBYOKKey.mockResolvedValueOnce({
      success: true,
      status: 'Connected Successfully',
      message: 'Verified 1 models available',
    });
    api.saveBYOKKey.mockResolvedValueOnce({
      success: true,
      provider: 'gemini',
      key_fingerprint: '••••••••••••1234',
      message: 'Gemini connected successfully.',
    });

    render(
      <BYOKOnboardingModal
        isOpen={true}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Advance to setup
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));

    const input = screen.getByPlaceholderText('AIzaSy...');
    fireEvent.change(input, { target: { value: 'AIzaSySampleKey1234' } });

    const testBtn = screen.getByRole('button', { name: /test connection/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(api.validateBYOKKey).toHaveBeenCalledWith('gemini', 'AIzaSySampleKey1234');
      expect(screen.getByText(/Connected Successfully/i)).toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /save api key/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.saveBYOKKey).toHaveBeenCalledWith('gemini', 'AIzaSySampleKey1234');
    });
  });
});

describe('Settings View AI Providers Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getBYOKStatus.mockResolvedValue({
      byok_setup_completed: true,
      has_active_provider: true,
      total_connected: 1,
      providers: [
        {
          provider: 'gemini',
          name: 'Google Gemini',
          is_connected: true,
          key_fingerprint: '••••••••••••9999',
          last_validated_at: '2026-10-31T12:00:00Z',
        },
        {
          provider: 'groq',
          name: 'Groq Cloud',
          is_connected: false,
          key_fingerprint: null,
          last_validated_at: null,
        },
      ],
    });
  });

  it('displays AI Providers tab and loads connected credentials', async () => {
    render(
      <SettingsView
        settings={{}}
        onUpdateSettings={vi.fn()}
        user={{ id: 'user-test', email: 'test@example.com', username: 'TestUser' }}
      />
    );

    const providersTabBtn = screen.getByRole('button', { name: /ai providers \/ api keys/i });
    expect(providersTabBtn).toBeInTheDocument();
    fireEvent.click(providersTabBtn);

    await waitFor(() => {
      expect(api.getBYOKStatus).toHaveBeenCalled();
      expect(screen.getByText(/AI Providers & API Keys \(BYOK\)/i)).toBeInTheDocument();
      expect(screen.getByText(/••••••••••••9999/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disconnect key/i })).toBeInTheDocument();
    });
  });
});
