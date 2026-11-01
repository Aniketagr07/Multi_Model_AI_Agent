import React, { useState, useEffect } from 'react';
import { getBYOKStatus, validateBYOKKey, saveBYOKKey, deleteBYOKKey } from '../services/api';

const PROVIDER_INSTRUCTIONS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Multimodal & Complex Reasoning',
    url: 'https://aistudio.google.com/app/apikey',
    linkText: 'Google AI Studio (aistudio.google.com/app/apikey)',
    placeholder: 'AIzaSy...',
    steps: [
      'Visit Google AI Studio at aistudio.google.com/app/apikey',
      'Sign in with your Google account',
      'Click "Create API key" in the top dashboard',
      'Select a Google Cloud project or create a quick project',
      'Copy your newly generated API key (begins with AIzaSy)',
      'Paste your API key into the secure field below',
      'Click "Test Connection" to verify key validity with Google',
      'Click "Save API Key" to securely encrypt and activate',
    ],
  },
  groq: {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Ultra-Fast Inference (500+ T/s)',
    url: 'https://console.groq.com/keys',
    linkText: 'Groq Console (console.groq.com/keys)',
    placeholder: 'gsk_...',
    steps: [
      'Visit the Groq Console at console.groq.com/keys',
      'Sign in with your GitHub or Google account',
      'Click "Create API Key" in the API Keys dashboard',
      'Provide a label (e.g. "OmniAI") and generate the key',
      'Copy the displayed secret key (begins with gsk_)',
      'Paste your key into the secure field below',
      'Click "Test Connection" to verify ultra-fast Llama models',
      'Click "Save API Key" to securely encrypt and activate',
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    badge: 'GPT-4o & Advanced Reasoning',
    url: 'https://platform.openai.com/api-keys',
    linkText: 'OpenAI Platform (platform.openai.com/api-keys)',
    placeholder: 'sk-...',
    steps: [
      'Visit the OpenAI Platform at platform.openai.com/api-keys',
      'Sign in to your OpenAI account',
      'Navigate to the API Keys section under your organization',
      'Click "Create new secret key"',
      'Provide a name (e.g. "OmniAI") and copy the secret key',
      'Paste your key into the secure field below',
      'Click "Test Connection" to verify access to OpenAI models',
      'Click "Save API Key" to securely encrypt and activate',
    ],
  },
};

export default function BYOKOnboardingModal({ isOpen, onClose, onComplete, isExistingUser = false }) {
  const [step, setStep] = useState('welcome'); // 'welcome' | 'providers' | 'complete'
  const [activeTab, setActiveTab] = useState('gemini'); // 'gemini' | 'groq' | 'openai'
  const [keysInput, setKeysInput] = useState({ gemini: '', groq: '', openai: '' });
  const [showKey, setShowKey] = useState({ gemini: false, groq: false, openai: false });
  const [testStatus, setTestStatus] = useState({}); // { [prov]: { loading, success, message } }
  const [saveLoading, setSaveLoading] = useState({});
  const [byokStatus, setByokStatus] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch current status on open
  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const data = await getBYOKStatus();
      setByokStatus(data);
      if (isExistingUser && data?.has_active_provider && step === 'welcome') {
        setStep(data.total_connected >= 1 ? 'complete' : 'providers');
      }
    } catch (err) {
      console.error('Failed to load BYOK status:', err);
    }
  };

  if (!isOpen) return null;

  const handleTestKey = async (provider) => {
    const key = (keysInput[provider] || '').trim();
    if (!key) {
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { loading: false, success: false, message: 'Please enter an API key first.' },
      }));
      return;
    }

    setTestStatus((prev) => ({
      ...prev,
      [provider]: { loading: true, success: null, message: 'Testing upstream API...' },
    }));

    try {
      const res = await validateBYOKKey(provider, key);
      setTestStatus((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: res.success,
          message: res.status + (res.message ? `: ${res.message}` : ''),
        },
      }));
    } catch (err) {
      setTestStatus((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: false,
          message: err.message || 'Validation request failed',
        },
      }));
    }
  };

  const handleSaveKey = async (provider) => {
    const key = (keysInput[provider] || '').trim();
    if (!key) return;

    setSaveLoading((prev) => ({ ...prev, [provider]: true }));
    setErrorMsg('');

    try {
      await saveBYOKKey(provider, key);
      setKeysInput((prev) => ({ ...prev, [provider]: '' }));
      setTestStatus((prev) => ({
        ...prev,
        [provider]: { loading: false, success: true, message: 'Saved and verified successfully!' },
      }));
      await loadStatus();
      // Automatically advance to updated Setup Complete screen
      setStep('complete');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save API key');
    } finally {
      setSaveLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleDeleteKey = async (provider) => {
    try {
      await deleteBYOKKey(provider);
      setTestStatus((prev) => ({ ...prev, [provider]: null }));
      await loadStatus();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete key');
    }
  };

  const handleAddAnotherProvider = () => {
    setErrorMsg('');
    // Find the first disconnected provider among implemented providers
    const allProviders = Object.keys(PROVIDER_INSTRUCTIONS);
    const connectedSet = new Set(
      byokStatus?.providers?.filter((p) => p.is_connected).map((p) => p.provider) || []
    );
    const firstDisconnected = allProviders.find((p) => !connectedSet.has(p));
    setActiveTab(firstDisconnected || allProviders[0]);
    setStep('providers');
  };

  const handleManageProvider = (provId) => {
    setErrorMsg('');
    setActiveTab(provId);
    setStep('providers');
  };

  const activeProviderStatus = byokStatus?.providers?.find((p) => p.provider === activeTab);
  const connectedProviders = byokStatus?.providers?.filter((p) => p.is_connected) || [];
  const hasAnyConnected = connectedProviders.length > 0;
  const currentProviderInfo = PROVIDER_INSTRUCTIONS[activeTab] || PROVIDER_INSTRUCTIONS.gemini;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#10131A] border border-[#2D3748] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2430] bg-[#151923]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {step === 'welcome'
                  ? isExistingUser
                    ? 'Upgrade Your AI Connections'
                    : 'Welcome to OmniAI'
                  : step === 'providers'
                  ? 'Connect AI Providers (BYOK)'
                  : 'Setup Complete'}
              </h2>
              <p className="text-xs text-gray-400">Bring Your Own API Key System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-sm text-red-400">
              <span className="font-bold">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: WELCOME SCREEN */}
          {step === 'welcome' && (
            <div className="space-y-6 py-2">
              <div className="text-center space-y-3">
                <div className="inline-flex p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-2">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  {isExistingUser ? 'OmniAI Connection Upgrade' : 'Welcome to OmniAI'}
                </h3>
                <p className="text-sm text-gray-300 max-w-lg mx-auto leading-relaxed">
                  Connect your personal AI provider API keys to start using OmniAI. Bring your own keys to access{' '}
                  <span className="text-purple-400 font-medium">Google Gemini</span>,{' '}
                  <span className="text-purple-400 font-medium">Groq</span>, and{' '}
                  <span className="text-purple-400 font-medium">OpenAI</span> with complete privacy and zero shared
                  rate limits.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="p-4 bg-[#151923] border border-[#1F2430] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-400 font-medium text-sm">
                    <span>🛡️</span>
                    <span>AES-256 Authenticated Encryption</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Your keys are encrypted at rest with Fernet. Plaintext keys are never stored, logged, or exposed.
                  </p>
                </div>

                <div className="p-4 bg-[#151923] border border-[#1F2430] rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm">
                    <span>⚡</span>
                    <span>Personal Quota & Full Speed</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Execute prompts directly against your own provider quotas without developer rate-limits or throttles.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1F2430]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                  I'll Do This Later
                </button>
                <button
                  type="button"
                  onClick={() => setStep('providers')}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg shadow-purple-600/25 flex items-center gap-2 cursor-pointer"
                >
                  <span>Get Started</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROVIDER CONNECTION WIZARD */}
          {step === 'providers' && (
            <div className="space-y-6">
              {/* Provider Selector Tabs */}
              <div className="flex items-center gap-2 p-1 bg-[#151923] border border-[#1F2430] rounded-xl overflow-x-auto">
                {Object.keys(PROVIDER_INSTRUCTIONS).map((prov) => {
                  const info = PROVIDER_INSTRUCTIONS[prov];
                  const isConn = byokStatus?.providers?.find((p) => p.provider === prov)?.is_connected;
                  const isActive = activeTab === prov;
                  return (
                    <button
                      key={prov}
                      onClick={() => {
                        setActiveTab(prov);
                        setErrorMsg('');
                      }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{info.name}</span>
                      {isConn && (
                        <span className={`text-xs ${isActive ? 'text-white' : 'text-emerald-400 font-bold'}`}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active Provider Card */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-white">
                      {currentProviderInfo.name}
                    </h4>
                    <span className="text-xs text-purple-400 font-medium">
                      {currentProviderInfo.badge}
                    </span>
                  </div>

                  <a
                    href={currentProviderInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-medium px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 transition-colors"
                  >
                    <span>Get Key ↗</span>
                  </a>
                </div>

                {/* Instructions Accordion / Steps */}
                <div className="p-4 bg-[#151923] border border-[#1F2430] rounded-xl space-y-2.5">
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    How to get your API key:
                  </p>
                  <ol className="space-y-1.5 text-xs text-gray-400 list-decimal list-inside leading-relaxed">
                    {currentProviderInfo.steps.map((st, idx) => (
                      <li key={idx} className="hover:text-gray-200 transition-colors">
                        <span className="ml-1">{st}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Connection Status Indicator */}
                {activeProviderStatus?.is_connected ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 text-lg font-bold">✓</span>
                      <div>
                        <div className="text-sm font-semibold text-white">Connected</div>
                        <div className="text-xs text-gray-400 font-mono">
                          Key: {activeProviderStatus.key_fingerprint}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(activeTab)}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                {/* API Key Input Field */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-300">
                    {activeProviderStatus?.is_connected ? 'Replace API Key' : 'Enter API Key'}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey[activeTab] ? 'text' : 'password'}
                      value={keysInput[activeTab] || ''}
                      onChange={(e) =>
                        setKeysInput((prev) => ({ ...prev, [activeTab]: e.target.value }))
                      }
                      placeholder={currentProviderInfo.placeholder}
                      className="w-full bg-[#151923] border border-[#2D3748] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors pr-12 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKey((prev) => ({ ...prev, [activeTab]: !prev[activeTab] }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors text-xs font-medium px-1 cursor-pointer"
                      title={showKey[activeTab] ? 'Hide' : 'Show'}
                    >
                      {showKey[activeTab] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {/* Test Feedback Message */}
                {testStatus[activeTab]?.message && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testStatus[activeTab].success
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        : testStatus[activeTab].loading
                        ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}
                  >
                    <span>
                      {testStatus[activeTab].loading
                        ? '⏳'
                        : testStatus[activeTab].success
                        ? '✓'
                        : '⚠️'}
                    </span>
                    <span>{testStatus[activeTab].message}</span>
                  </div>
                )}

                {/* Key Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={
                      testStatus[activeTab]?.loading || !(keysInput[activeTab] || '').trim()
                    }
                    onClick={() => handleTestKey(activeTab)}
                    className="flex-1 px-4 py-2.5 text-xs font-semibold text-gray-200 bg-[#1A1F2C] hover:bg-[#252B3B] border border-[#2D3748] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {testStatus[activeTab]?.loading ? 'Testing...' : 'Test Connection'}
                  </button>

                  <button
                    type="button"
                    disabled={
                      saveLoading[activeTab] || !(keysInput[activeTab] || '').trim()
                    }
                    onClick={() => handleSaveKey(activeTab)}
                    className="flex-1 px-4 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {saveLoading[activeTab] && (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span>{saveLoading[activeTab] ? 'Saving...' : 'Save API Key'}</span>
                  </button>
                </div>
              </div>

              {/* Footer navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-[#1F2430]">
                {hasAnyConnected ? (
                  <button
                    type="button"
                    onClick={() => setStep('complete')}
                    className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>←</span>
                    <span>View Connected Providers</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    I'll Do This Later
                  </button>
                )}

                <button
                  type="button"
                  disabled={!hasAnyConnected}
                  onClick={() => setStep('complete')}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg shadow-purple-600/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: COMPLETION SCREEN */}
          {step === 'complete' && (
            <div className="space-y-6 py-2 text-center animate-in fade-in duration-200">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 text-3xl font-bold">
                ✓
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  You're all set!
                </h3>
                <p className="text-sm text-gray-300 max-w-md mx-auto">
                  Your AI workspace is ready. Your keys are verified and safely encrypted.
                </p>
              </div>

              {/* Connected Providers List */}
              <div className="space-y-2.5 max-w-md mx-auto text-left">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
                  Connected Providers ({connectedProviders.length})
                </div>
                {connectedProviders.map((p) => (
                  <div
                    key={p.provider}
                    className="p-3.5 bg-[#151923] border border-[#1F2430] hover:border-[#2D3748] rounded-xl flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-emerald-400 font-bold shrink-0">✓</span>
                      <div className="truncate">
                        <div className="font-semibold text-white truncate">{p.name}</div>
                        <div className="font-mono text-[11px] text-gray-400 truncate">
                          {p.key_fingerprint}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Connected
                      </span>
                      <button
                        type="button"
                        onClick={() => handleManageProvider(p.provider)}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-[#1A1F2C] hover:bg-[#252B3B] border border-[#2D3748] rounded-lg transition-colors cursor-pointer"
                        title={`Manage or replace ${p.name} key`}
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Add Another Provider + Start Chatting */}
              <div className="pt-4 border-t border-[#1F2430] max-w-md mx-auto space-y-3">
                <button
                  type="button"
                  onClick={handleAddAnotherProvider}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 hover:border-purple-500/50 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span className="text-sm font-bold leading-none">+</span>{' '}
                  <span>Add Another Provider</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onComplete) onComplete();
                    onClose();
                  }}
                  className="w-full py-3 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Start Chatting</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
