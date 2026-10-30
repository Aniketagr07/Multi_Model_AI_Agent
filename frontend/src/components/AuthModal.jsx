import React, { useState } from 'react';

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin', // 'signin' | 'register'
  onLogin,
  onRegister,
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Sync initialMode when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'register') {
      if (!username.trim()) {
        setError('Please provide a display username.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'register') {
        await onRegister(email.trim(), username.trim(), password);
      } else {
        await onLogin(email.trim(), password);
      }
      setEmail('');
      setUsername('');
      setPassword('');
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-6 relative text-slate-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#151923] text-sm transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          ✕
        </button>

        {/* Brand Icon & Heading */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 id="auth-modal-title" className="text-base font-bold text-white">
              {mode === 'signin' ? 'Sign In to OmniAI' : 'Create OmniAI Account'}
            </h2>
            <p className="text-xs text-slate-400">
              Synchronize your multi-model chats and skills across devices.
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 mb-5 bg-[#0B0D12] rounded-xl border border-[#282D38]">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'signin'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#151923] text-purple-300 border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
            <span className="text-red-400 font-bold">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Display Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. AlexMorgan"
                className="w-full px-3 py-2 rounded-xl bg-[#151923] border border-[#282D38] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full px-3 py-2 rounded-xl bg-[#151923] border border-[#282D38] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              {mode === 'register' && (
                <span className="text-[10px] text-slate-500">Min 8 characters</span>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-xl bg-[#151923] border border-[#282D38] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-md shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Processing...</span>
              </>
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Guest Mode Informational Callout */}
        <div className="mt-5 pt-4 border-t border-[#282D38]/60 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Prefer not to sign in? You can continue using{' '}
            <strong className="text-purple-300">Guest Mode</strong> with local session persistence.
          </p>
        </div>
      </div>
    </div>
  );
}
