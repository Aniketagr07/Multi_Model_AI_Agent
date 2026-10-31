import React, { useState, useEffect } from 'react';
import { fetchOAuthUrl, requestPasswordReset } from '../services/api';

export function GoogleLogo({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function GitHubLogo({ className = 'w-4 h-4' }) {
  return (
    <svg className={`${className} fill-current`} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin', // 'signin' | 'register'
  onLogin,
  onRegister,
}) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'register' | 'forgot'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' | 'github' | null

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode === 'register' ? 'register' : 'signin');
      setError('');
      setInfoMessage('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleOAuthClick = async (provider) => {
    setError('');
    setInfoMessage('');
    setOauthLoading(provider);

    try {
      const data = await fetchOAuthUrl(provider, 'login');

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('omniai_oauth_provider', provider);
        sessionStorage.setItem('omniai_oauth_action', 'login');
      }

      if (data && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(`Unable to start ${provider} authorization.`);
      }
    } catch (err) {
      setOauthLoading(null);
      setError(
        err.message ||
        `${provider.toUpperCase()} authentication is currently awaiting configuration. Please use email & password or Guest mode.`
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (mode === 'forgot') {
      if (!email.trim()) {
        setError('Please enter your account email address.');
        return;
      }
      setIsLoading(true);
      try {
        const resp = await requestPasswordReset(email.trim());
        setInfoMessage(
          resp.message ||
          'If an account exists for this email, password recovery instructions and a reset token have been generated.'
        );
      } catch (err) {
        setError(err.message || 'Failed to submit password recovery request.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-6 sm:p-7 relative text-slate-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#151923] text-sm transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          ✕
        </button>

        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 mx-auto mb-3">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h2
            id="auth-modal-title"
            className="text-lg font-black tracking-wider text-white uppercase"
          >
            WELCOME TO OMNIAI
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'forgot'
              ? 'Password Recovery & Reset'
              : mode === 'register'
              ? 'Create your account to sync conversations and custom models'
              : 'Sign in to access your models, skills, and chat history'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
            <span className="text-red-400 font-bold shrink-0">⚠️</span>
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Info / Success Alert */}
        {infoMessage && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-start gap-2">
            <span className="text-emerald-400 font-bold shrink-0">✓</span>
            <span className="leading-relaxed">{infoMessage}</span>
          </div>
        )}

        {/* OAUTH PROVIDERS SECTION (Google & GitHub) */}
        {mode !== 'forgot' && (
          <div className="space-y-2.5 mb-5">
            {/* Google OAuth Button */}
            <button
              type="button"
              disabled={oauthLoading !== null || isLoading}
              onClick={() => handleOAuthClick('google')}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#151923] hover:bg-[#1E2330] text-slate-100 border border-[#282D38] hover:border-slate-600 transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'google' ? (
                <svg className="w-4 h-4 animate-spin text-purple-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <GoogleLogo className="w-4 h-4" />
              )}
              <span>Continue with Google</span>
            </button>

            {/* GitHub OAuth Button */}
            <button
              type="button"
              disabled={oauthLoading !== null || isLoading}
              onClick={() => handleOAuthClick('github')}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#151923] hover:bg-[#1E2330] text-slate-100 border border-[#282D38] hover:border-slate-600 transition-all shadow-xs flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {oauthLoading === 'github' ? (
                <svg className="w-4 h-4 animate-spin text-purple-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <GitHubLogo className="w-4 h-4 text-white" />
              )}
              <span>Continue with GitHub</span>
            </button>

            {/* Visual Divider: ---------------- OR ---------------- */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[#282D38]" />
              <span className="flex-shrink mx-3 text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                OR
              </span>
              <div className="flex-grow border-t border-[#282D38]" />
            </div>

            <div className="text-center">
              <span className="text-[11px] text-slate-400 font-medium">
                Continue with Email and Password
              </span>
            </div>
          </div>
        )}

        {/* Mode Switcher Tabs for Email & Password */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 gap-1 p-1 mb-4 bg-[#0B0D12] rounded-xl border border-[#282D38]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setInfoMessage('');
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
                setInfoMessage('');
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
        )}

        {/* Email/Password / Forgot Form */}
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

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                {mode === 'signin' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setInfoMessage('');
                    }}
                    className="text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                ) : (
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
          )}

          <button
            type="submit"
            disabled={isLoading || oauthLoading !== null}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-md shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-3"
          >
            {isLoading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span>Processing...</span>
              </>
            ) : mode === 'forgot' ? (
              'Send Recovery Instructions'
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Forgot Password Back Link */}
        {mode === 'forgot' && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setInfoMessage('');
              }}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Continue as Guest Button */}
        <div className="mt-5 pt-4 border-t border-[#282D38]/60 text-center space-y-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 px-3 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-transparent hover:bg-[#151923] border border-transparent hover:border-[#282D38] transition-all cursor-pointer"
          >
            Continue as Guest
          </button>
          <p className="text-[10px] text-slate-500">
            Guest sessions persist locally. You can migrate your conversations to an account anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
