import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsView } from '../components/SettingsView';

describe('Settings & Theme Switching Tests', () => {
  const initialSettings = {
    theme: 'dark',
    default_model: 'gemini-3.8-flash',
    default_routing_mode: 'auto',
    streaming_enabled: true,
    default_effort: 'medium',
    custom_instructions: 'Explain concepts simply with code.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders settings navigation and switches themes under Appearance tab', () => {
    const handleUpdateSettings = vi.fn();
    render(
      <SettingsView
        settings={initialSettings}
        onUpdateSettings={handleUpdateSettings}
        onClose={vi.fn()}
        saveStatus="idle"
        saveError={null}
      />
    );

    // Verify main tabs are present
    expect(screen.getByRole('button', { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Appearance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI Preferences/i })).toBeInTheDocument();

    // Switch to Appearance tab
    const appearanceTab = screen.getByRole('button', { name: /Appearance/i });
    fireEvent.click(appearanceTab);

    // Click Light Theme button
    const lightBtn = screen.getByRole('button', { name: /Light Theme/i });
    fireEvent.click(lightBtn);

    expect(handleUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'light' })
    );
  });

  it('allows applying custom instructions presets under Personalization tab', () => {
    const handleUpdateSettings = vi.fn();
    render(
      <SettingsView
        settings={initialSettings}
        onUpdateSettings={handleUpdateSettings}
        onClose={vi.fn()}
        saveStatus="idle"
        saveError={null}
      />
    );

    // Switch to Personalization tab
    const personalizationTab = screen.getByRole('button', { name: /Personalization/i });
    fireEvent.click(personalizationTab);

    // Click on preset
    const presetBtn = screen.getByText(/Include code examples/i);
    fireEvent.click(presetBtn);

    // Click Save button
    const saveBtn = screen.getByRole('button', { name: /Save Instructions/i });
    fireEvent.click(saveBtn);

    expect(handleUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_instructions: expect.stringContaining('Include code examples'),
      })
    );
  });
});
