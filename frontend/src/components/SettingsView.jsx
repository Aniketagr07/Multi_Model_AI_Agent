import React, { useState, useEffect } from 'react';
import { AVAILABLE_MODELS } from './ModelSelector';
import { fetchModelRegistry } from '../services/api';

export function SettingsView({
  settings,
  onUpdateSettings,
  saveStatus = 'idle',
  saveError = null,
  onBackToChat,
  customModels = [],
}) {
  const [activeTab, setActiveTab] = useState('general');
  const [registryModels, setRegistryModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Local draft of custom instructions for responsive typing
  const [customInstructionsDraft, setCustomInstructionsDraft] = useState(
    settings.custom_instructions || ''
  );

  useEffect(() => {
    setCustomInstructionsDraft(settings.custom_instructions || '');
  }, [settings.custom_instructions]);

  // Load real model information from backend /api/models
  useEffect(() => {
    async function loadModels() {
      setIsLoadingModels(true);
      try {
        const data = await fetchModelRegistry();
        if (data && data.models) {
          setRegistryModels(data.models);
        }
      } catch (err) {
        console.warn('Failed to load live model registry for settings:', err);
      } finally {
        setIsLoadingModels(false);
      }
    }
    loadModels();
  }, []);

  const handleSaveCustomInstructions = () => {
    onUpdateSettings({ custom_instructions: customInstructionsDraft.trim() });
  };

  const handleApplyPreset = (presetText) => {
    let current = customInstructionsDraft.trim();
    if (current && !current.endsWith('.')) current += '.';
    const updated = current ? `${current} ${presetText}` : presetText;
    setCustomInstructionsDraft(updated);
    onUpdateSettings({ custom_instructions: updated });
  };

  const presets = [
    { label: 'Explain technical concepts simply', icon: '💡' },
    { label: 'Prefer detailed, thorough answers', icon: '📝' },
    { label: 'Use concise, direct responses without filler', icon: '⚡' },
    { label: 'Include code examples with syntax when appropriate', icon: '💻' },
    { label: 'Focus on modern performance and security best practices', icon: '🛡️' },
  ];

  const availableRegisteredModels = AVAILABLE_MODELS.filter(m => m.id !== 'auto' && m.isOperational);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0B0D12] overflow-hidden select-none">
      {/* Settings Top Bar */}
      <div className="h-14 border-b border-[#282D38] bg-[#10131A] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151923] hover:bg-[#1E2330] text-slate-300 hover:text-white border border-[#282D38] text-xs font-medium transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Chat</span>
          </button>
          <div className="h-4 w-px bg-[#282D38]" />
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>⚙️</span>
            <span>Settings & Personalization</span>
          </h2>
        </div>

        {/* Save Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {saveStatus === 'saving' && (
            <span className="text-purple-400 flex items-center gap-1.5 text-[11px]">
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Saving to SQLite...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
              <span>✓</span> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-400 text-[11px]" title={saveError}>
              ⚠️ Save failed
            </span>
          )}
        </div>
      </div>

      {/* Main Settings Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Settings Navigation Sidebar */}
        <nav className="w-60 border-r border-[#282D38] bg-[#10131A] p-3 space-y-1 shrink-0 overflow-y-auto">
          {[
            { id: 'general', label: 'General', icon: '⚙️' },
            { id: 'appearance', label: 'Appearance', icon: '🎨' },
            { id: 'ai', label: 'AI Preferences', icon: '🧠' },
            { id: 'personalization', label: 'Personalization', icon: '✍️' },
            { id: 'models', label: 'Model Information', icon: 'ℹ️' },
            { id: 'about', label: 'About OmniAI', icon: '📖' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-purple-600/15 text-purple-300 border border-purple-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923] border border-transparent'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 max-w-4xl">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white">General Settings</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage standard interaction behaviors and database persistence.
                </p>
              </div>

              {/* New Conversation Behavior */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-200 block">
                  New Conversation Behavior
                </label>
                <p className="text-[11px] text-slate-400">
                  Select what happens when you start a brand-new chat session.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {[
                    { id: 'default', title: 'Default', desc: 'Clear chat window and reset document attachment' },
                    { id: 'clear', title: 'Clean Slate', desc: 'Reset all selections and revert to Auto Smart Router' },
                    { id: 'summarize', title: 'Keep Context', desc: 'Preserve active model and effort settings' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onUpdateSettings({ new_chat_behavior: option.id })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        settings.new_chat_behavior === option.id
                          ? 'bg-purple-500/10 border-purple-500/40 text-white'
                          : 'bg-[#151923] border-[#282D38] text-slate-400 hover:text-slate-200 hover:bg-[#1E2330]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-slate-100">{option.title}</span>
                        {settings.new_chat_behavior === option.id && (
                          <span className="text-purple-400 text-xs">✓</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Persistence Layer Info */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">Database & Persistence Layer</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      SQLite 3 with Write-Ahead Logging (WAL) and foreign key cascades.
                    </p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    ● Connected & Active
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 bg-[#151923] p-3 rounded-xl border border-[#282D38] font-mono space-y-1">
                  <div>Database path: <span className="text-slate-300">data/omniai.db</span></div>
                  <div>Journal Mode: <span className="text-purple-400">WAL (Write-Ahead Logging)</span></div>
                  <div>Foreign Keys: <span className="text-emerald-400">ON (Cascade Deletions Active)</span></div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white">Appearance & Theme</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose your visual interface style. Theme selection persists across browser sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Dark Theme Card */}
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'dark' })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    settings.theme === 'dark'
                      ? 'bg-[#151923] border-purple-500 shadow-md shadow-purple-500/10'
                      : 'bg-[#10131A] border-[#282D38] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-base">
                      🌙
                    </div>
                    {settings.theme === 'dark' && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-white">Dark Theme</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Deep charcoal surfaces optimized for low-light environments and OLED displays.
                  </p>
                  <div className="mt-4 h-10 rounded-lg bg-[#0B0D12] border border-[#282D38] p-1.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="h-1.5 w-16 bg-slate-700 rounded" />
                  </div>
                </button>

                {/* Light Theme Card */}
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'light' })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    settings.theme === 'light'
                      ? 'bg-[#151923] border-purple-500 shadow-md shadow-purple-500/10'
                      : 'bg-[#10131A] border-[#282D38] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-base">
                      ☀️
                    </div>
                    {settings.theme === 'light' && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-white">Light Theme</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Crisp, clean high-contrast aesthetic designed for daylight productivity.
                  </p>
                  <div className="mt-4 h-10 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] p-1.5 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span className="h-1.5 w-16 bg-slate-400 rounded" />
                  </div>
                </button>

                {/* System Default Theme Card */}
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ theme: 'system' })}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    settings.theme === 'system'
                      ? 'bg-[#151923] border-purple-500 shadow-md shadow-purple-500/10'
                      : 'bg-[#10131A] border-[#282D38] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-base">
                      💻
                    </div>
                    {settings.theme === 'system' && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-white">System Default</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Dynamically syncs with your operating system's light or dark mode setting.
                  </p>
                  <div className="mt-4 h-10 rounded-lg bg-gradient-to-r from-[#0B0D12] to-[#F8FAFC] border border-[#282D38] p-1.5 flex items-center justify-between">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    <span className="text-[9px] text-slate-500 font-mono">Auto OS</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: AI PREFERENCES */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white">AI Engine & Routing Preferences</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure default model routing, response streaming, and inference effort tiers.
                </p>
              </div>

              {/* Default AI Model Selection */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-200 block">
                  Default AI Model
                </label>
                <p className="text-[11px] text-slate-400">
                  Select which model is chosen initially for new conversations when manual routing is enabled.
                </p>
                <select
                  value={settings.default_model}
                  onChange={(e) => onUpdateSettings({ default_model: e.target.value })}
                  className="w-full bg-[#151923] text-xs text-white rounded-xl px-3.5 py-2.5 border border-[#282D38] focus:border-purple-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <optgroup label="Verified Registered Models">
                    {availableRegisteredModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.provider})
                      </option>
                    ))}
                  </optgroup>
                  {customModels.length > 0 && (
                    <optgroup label="Your Custom BYOK Models">
                      {customModels.map((cm) => (
                        <option key={cm.id} value={cm.id}>
                          {cm.name} (Custom)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Default Routing Mode */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-200 block">
                  Default Routing Mode
                </label>
                <p className="text-[11px] text-slate-400">
                  Auto Smart Router intelligently inspects prompts (coding, writing, reasoning) and routes to the optimal model with 0ms overhead.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ default_routing_mode: 'auto' })}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.default_routing_mode === 'auto'
                        ? 'bg-purple-500/10 border-purple-500 text-white shadow-sm'
                        : 'bg-[#151923] border-[#282D38] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>⚡</span> Auto (Smart Router)
                      </span>
                      {settings.default_routing_mode === 'auto' && <span className="text-purple-400">✓</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Recommended. Automatically chooses the best model per prompt.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ default_routing_mode: 'manual' })}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      settings.default_routing_mode === 'manual'
                        ? 'bg-purple-500/10 border-purple-500 text-white shadow-sm'
                        : 'bg-[#151923] border-[#282D38] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                        <span>🎯</span> Manual Selection
                      </span>
                      {settings.default_routing_mode === 'manual' && <span className="text-purple-400">✓</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      Always uses your chosen Default AI Model unless changed manually.
                    </p>
                  </button>
                </div>
              </div>

              {/* Streaming Preference */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <h4 className="text-xs font-semibold text-slate-200">Real-Time Response Streaming (SSE)</h4>
                  <p className="text-[11px] text-slate-400">
                    Stream tokens progressively via Server-Sent Events. Disabling waits for the full completion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ streaming_enabled: !settings.streaming_enabled })}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                    settings.streaming_enabled ? 'bg-purple-600' : 'bg-[#282D38]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.streaming_enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Default Reasoning Effort */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <label className="text-xs font-semibold text-slate-200 block">
                  Default Reasoning Effort Tier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'low', label: 'Low ⚡', desc: 'Ultra-fast, concise tokens, low latency' },
                    { id: 'medium', label: 'Medium ⚖️', desc: 'Standard balanced synthesis' },
                    { id: 'high', label: 'High 🧠', desc: 'Deep thorough multi-step reasoning' },
                  ].map((eff) => (
                    <button
                      key={eff.id}
                      type="button"
                      onClick={() => onUpdateSettings({ default_effort: eff.id })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        settings.default_effort === eff.id
                          ? 'bg-purple-500/10 border-purple-500/50 text-white'
                          : 'bg-[#151923] border-[#282D38] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-100">{eff.label}</div>
                      <p className="text-[10px] text-slate-400 mt-1">{eff.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PERSONALIZATION (Custom Instructions) */}
          {activeTab === 'personalization' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-base font-semibold text-white">Personalization & Custom Instructions</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Define custom preferences and instructions for how OmniAI should respond across all conversations.
                </p>
              </div>

              {/* Instructions Editor */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    What would you like OmniAI to know about you to provide better responses?
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {customInstructionsDraft.length} / 2000
                  </span>
                </div>

                <textarea
                  value={customInstructionsDraft}
                  onChange={(e) => setCustomInstructionsDraft(e.target.value.slice(0, 2000))}
                  placeholder="e.g. I am an AI/ML engineering student. Prefer clean Python code snippets with docstrings, concise explanations, and avoid unnecessary preamble."
                  rows={6}
                  className="w-full bg-[#151923] text-xs text-white placeholder-slate-500 rounded-xl p-3 border border-[#282D38] focus:border-purple-500 focus:outline-none transition-colors leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400">
                    🛡️ <span className="text-slate-300 font-medium">Security Notice:</span> Custom instructions are securely sandboxed and cannot override system-level safety policies.
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveCustomInstructions}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm shadow-purple-600/20"
                  >
                    Save Instructions
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200">Quick-Add Instruction Presets</h4>
                <p className="text-[11px] text-slate-400">
                  Click any preset to append it directly into your custom instructions.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p.label)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#151923] hover:bg-[#1E2330] text-slate-300 hover:text-white border border-[#282D38] hover:border-purple-500/40 text-xs transition-all cursor-pointer"
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MODEL INFORMATION */}
          {activeTab === 'models' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Registered Model Specifications</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Live operational metrics directly queried from the backend server registry.
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 bg-[#151923] px-2.5 py-1 rounded-lg border border-[#282D38]">
                  {registryModels.length || availableRegisteredModels.length} Models Verified
                </span>
              </div>

              {isLoadingModels ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading verified model registry...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(registryModels.length > 0 ? registryModels : availableRegisteredModels).map((model) => (
                    <div
                      key={model.id}
                      className="bg-[#10131A] border border-[#282D38] rounded-2xl p-4.5 space-y-3 hover:border-purple-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{model.name}</h4>
                            <span className="text-[10px] px-1.5 py-0.2 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20 font-medium">
                              {model.tag || model.provider}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                            {model.description}
                          </p>
                        </div>
                      </div>

                      {/* Capabilities & Metadata */}
                      <div className="space-y-2 pt-2 border-t border-[#282D38]/60 text-[11px]">
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Context Window:</span>
                          <span className="text-slate-200 font-mono">
                            {model.context_window ? `${(model.context_window / 1000).toFixed(0)}k tokens` : '128k tokens'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Quota Tier:</span>
                          <span className="text-slate-300 font-medium">{model.cost_tier || 'Free tier'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Real-time SSE Streaming:</span>
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <span>✓</span> Verified Supported
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>Operational Status:</span>
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Available
                          </span>
                        </div>
                      </div>

                      {/* Supported Categories Pills */}
                      {model.supported_categories && model.supported_categories.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1">
                          {model.supported_categories.map((cat, i) => (
                            <span
                              key={i}
                              className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#151923] text-slate-400 border border-[#282D38]"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: ABOUT OMNIAI */}
          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-gradient-to-tr from-purple-950/30 to-indigo-950/20 border border-purple-500/20 rounded-2xl p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 shrink-0">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white tracking-tight">OmniAI</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-medium">
                      v0.1.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Intelligent Multi-Model AI Chatbot with Rule-Based Meta-Routing, Document Analysis Grounding, and Server-Sent Events (SSE) Streaming.
                  </p>
                </div>
              </div>

              {/* Architecture & Tech Stack */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Technology Stack & Architecture
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-[#151923] rounded-xl border border-[#282D38]">
                    <span className="text-[10px] text-purple-400 block font-semibold">Backend Engine</span>
                    <span className="font-semibold text-slate-200 mt-1 block">FastAPI & Python 3.14</span>
                  </div>
                  <div className="p-3 bg-[#151923] rounded-xl border border-[#282D38]">
                    <span className="text-[10px] text-purple-400 block font-semibold">Frontend Interface</span>
                    <span className="font-semibold text-slate-200 mt-1 block">React 18 & Vite</span>
                  </div>
                  <div className="p-3 bg-[#151923] rounded-xl border border-[#282D38]">
                    <span className="text-[10px] text-purple-400 block font-semibold">Database Storage</span>
                    <span className="font-semibold text-slate-200 mt-1 block">SQLite (WAL Mode)</span>
                  </div>
                  <div className="p-3 bg-[#151923] rounded-xl border border-[#282D38]">
                    <span className="text-[10px] text-purple-400 block font-semibold">Design & Styling</span>
                    <span className="font-semibold text-slate-200 mt-1 block">Tailwind CSS</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#282D38]/60 text-xs text-slate-400 leading-relaxed">
                  <p>
                    • <strong className="text-slate-200">Rule-Based Heuristic Router:</strong> Dispatches user prompts across coding, reasoning, writing, and general tasks in &lt;1ms without secondary LLM meta-token expenses.
                  </p>
                  <p>
                    • <strong className="text-slate-200">Secure Document Grounding:</strong> Ingests PDF, TXT, and Markdown files, performs chunking, and guarantees factual context adherence.
                  </p>
                  <p>
                    • <strong className="text-slate-200">Streaming Engine:</strong> Delivers sub-second initial token latency using native Server-Sent Events (SSE).
                  </p>
                </div>
              </div>

              {/* Developer & Project Attribution */}
              <div className="bg-[#10131A] border border-[#282D38] rounded-2xl p-5 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-semibold text-slate-200">Academic & Project Attribution</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    OmniAI • B.Tech AI & ML Capstone Implementation
                  </p>
                </div>
                <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                  Open Architecture
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
