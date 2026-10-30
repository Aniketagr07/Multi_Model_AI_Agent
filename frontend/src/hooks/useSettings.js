import { useState, useEffect, useCallback } from 'react';
import { fetchUserSettings, saveUserSettings } from '../services/api';

const STORAGE_KEY = 'omniai_user_settings';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  default_model: 'gemini-3.6-flash',
  default_routing_mode: 'auto',
  streaming_enabled: true,
  default_effort: 'medium',
  new_chat_behavior: 'default',
  custom_instructions: '',
};

function getLocalSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('[useSettings] LocalStorage read failed:', err);
  }
  return DEFAULT_SETTINGS;
}

export function useSettings() {
  const [settings, setSettings] = useState(getLocalSettings);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState(null);

  // Apply theme to DOM documentElement
  const applyTheme = useCallback((themeMode) => {
    const root = document.documentElement;
    let effectiveTheme = themeMode;

    if (themeMode === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effectiveTheme = prefersDark ? 'dark' : 'light';
    }

    if (effectiveTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Synchronize system media query when theme is 'system'
  useEffect(() => {
    applyTheme(settings.theme);

    if (settings.theme === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme, applyTheme]);

  // Fetch settings from backend SQLite on mount
  useEffect(() => {
    async function syncBackendSettings() {
      try {
        const backendData = await fetchUserSettings();
        if (backendData) {
          setSettings(prev => {
            const merged = { ...prev, ...backendData };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('[useSettings] Backend sync note:', err.message);
      }
    }
    syncBackendSettings();
  }, []);

  // Update one or more settings
  const updateSettings = useCallback(async (partial) => {
    setSaveStatus('saving');
    setSaveError(null);

    const updated = { ...settings, ...partial };
    setSettings(updated);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      await saveUserSettings(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('[useSettings] Failed to save settings to backend:', err);
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save settings');
    }
  }, [settings]);

  // Convenience helper to toggle or set theme directly
  const setTheme = useCallback((theme) => {
    updateSettings({ theme });
  }, [updateSettings]);

  return {
    settings,
    updateSettings,
    setTheme,
    saveStatus,
    saveError,
  };
}

