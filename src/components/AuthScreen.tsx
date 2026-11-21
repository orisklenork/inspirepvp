import { useEffect, useState } from 'react';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowRight, X } from 'lucide-react';
import {
  checkUsernameAvailability,
  loginAccount,
  registerAccount,
} from '../lib/api.ts';
import type { PlayerAccountBundle } from '../types/game.ts';

interface AuthScreenProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
  onAuthenticated: (bundle: PlayerAccountBundle, welcomeMessage?: string) => void;
}

export function AuthScreen({
  isOpen,
  initialMode,
  onClose,
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [availability, setAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    setError(null);
  }, [mode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || mode !== 'register') {
      setAvailability({ checking: false, available: null, message: '' });
      return;
    }
    const trimmed = username.trim();
    if (!trimmed) {
      setAvailability({ checking: false, available: null, message: '' });
      return;
    }
    if (trimmed.length < 3) {
      setAvailability({
        checking: false,
        available: false,
        message: 'Username must be at least 3 characters.',
      });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setAvailability({
        checking: false,
        available: false,
        message: 'Use only letters, numbers, and underscores.',
      });
      return;
    }

    let cancelled = false;
    setAvailability({ checking: true, available: null, message: 'Checking availability...' });
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed);
        if (!cancelled) {
          setAvailability({
            checking: false,
            available: res.available,
            message: res.message,
          });
        }
      } catch {
        if (!cancelled) {
          setAvailability({ checking: false, available: null, message: '' });
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, mode, isOpen]);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (trimmedUsername.length < 3 || trimmedUsername.length > 20) {
        setError('Username must be 3 to 20 characters.');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        setError('Username can only contain letters, numbers, and underscores.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (availability.available === false) {
        setError(availability.message || 'Please choose an available username.');
        return;
      }

      setSubmitting(true);
      try {
        const res = await registerAccount(trimmedUsername, password, confirmPassword);
        onAuthenticated(res.account, res.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Account creation failed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await loginAccount(trimmedUsername, password, rememberMe);
      onAuthenticated(res.account);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-heading"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#151C28] border border-white/10 p-6 sm:p-8 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <span className="font-display text-xl font-bold tracking-wider text-slate-100">
            InspiredPVP
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to home page"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0B0F17] border border-white/5 mb-6">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'login'
                ? 'bg-[#1C2536] text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2.5 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'register'
                ? 'bg-[#1C2536] text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="mb-5">
          <h2 id="auth-modal-heading" className="text-2xl font-bold text-slate-100">
            {mode === 'login' ? 'Sign In to InspiredPVP' : 'Create InspiredPVP Account'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'login'
              ? 'Enter your username and password to enter the lobby.'
              : 'No email or phone required. Pick a username and enter the lobby immediately.'}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Username
            </label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. ApexStriker_01"
              className="w-full rounded-xl bg-[#0B0F17] border border-white/10 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            {mode === 'register' && username.trim().length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {availability.checking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                    <span className="text-slate-400">{availability.message}</span>
                  </>
                ) : availability.available === true ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">{availability.message}</span>
                  </>
                ) : availability.available === false ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-rose-400">{availability.message}</span>
                  </>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-sm font-medium text-slate-200 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter password'}
                className="w-full rounded-xl bg-[#0B0F17] border border-white/10 pl-4 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-sm font-medium text-slate-200 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl bg-[#0B0F17] border border-white/10 pl-4 pr-11 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-[#0B0F17] accent-amber-500"
                />
                <span>Remember login session</span>
              </label>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/25 px-3.5 py-2.5 text-sm text-rose-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm py-3 px-4 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Log In to Lobby' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-xs text-center text-slate-400">
          {mode === 'login' ? (
            <>
              New operative?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-amber-400 hover:underline font-medium cursor-pointer"
              >
                Create an account instantly
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-amber-400 hover:underline font-medium cursor-pointer"
              >
                Sign in here
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
