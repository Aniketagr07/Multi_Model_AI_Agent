import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEYS_KEY = 'omniai_custom_api_keys';
const STORAGE_MODELS_KEY = 'omniai_custom_discovered_models';

export function useCustomKeys() {
  const [customKeys, setCustomKeys] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [customModels, setCustomModels] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MODELS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(customKeys));
    } catch (e) {
      console.warn('Failed to save custom keys to localStorage', e);
    }
  }, [customKeys]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MODELS_KEY, JSON.stringify(customModels));
    } catch (e) {
      console.warn('Failed to save custom models to localStorage', e);
    }
  }, [customModels]);

  const saveKeyAndModels = useCallback((provider, apiKey, baseUrl, discoveredModels = []) => {
    // 1. Update keys state
    setCustomKeys(prev => ({
      ...prev,
      [provider]: {
        apiKey,
        baseUrl: baseUrl || null,
        updatedAt: new Date().toISOString(),
      },
    }));

    // 2. Format discovered models for OmniAI UI
    const formatted = discoveredModels.map(m => {
      let badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      let iconColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';

      if (provider === 'gemini') {
        badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
        iconColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      } else if (provider === 'groq') {
        badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        iconColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      }

      return {
        id: m.id,
        name: m.name,
        provider: m.provider,
        provider_model_id: m.provider_model_id,
        description: m.description,
        tag: 'User API Key',
        isOperational: true,
        isCustom: true,
        customApiKey: apiKey,
        customProvider: provider,
        customBaseUrl: baseUrl || null,
        badgeColor,
        iconColor,
      };
    });

    // 3. Merge models, replacing any previous models from this provider
    setCustomModels(prev => {
      const remaining = prev.filter(m => m.customProvider !== provider);
      return [...remaining, ...formatted];
    });
  }, []);

  const removeKey = useCallback((provider) => {
    setCustomKeys(prev => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });

    setCustomModels(prev => prev.filter(m => m.customProvider !== provider));
  }, []);

  const clearAllCustomKeys = useCallback(() => {
    setCustomKeys({});
    setCustomModels([]);
    try {
      localStorage.removeItem(STORAGE_KEYS_KEY);
      localStorage.removeItem(STORAGE_MODELS_KEY);
    } catch {}
  }, []);

  return {
    customKeys,
    customModels,
    saveKeyAndModels,
    removeKey,
    clearAllCustomKeys,
  };
}

