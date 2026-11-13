import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../context/UserContext';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

export const AuthModal: React.FC = () => {
  const {
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    continueAsGuest
  } = useAuth();
  const { isLimitReached } = useUser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);

  if (!showAuthModal) return null;

  const isSignUp = authMode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConfirmationMsg(null);

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignUp) {
        const res = await signUpWithEmail(email.trim(), password, username.trim());
        if (res.error) {
          setError(res.error);
        } else if (res.needsEmailConfirmation) {
          setConfirmationMsg(
            'Account created! Check your inbox to confirm your email address, then sign in.'
          );
        }
      } else {
        const res = await signInWithEmail(email.trim(), password);
        if (res.error) {
          setError(res.error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setConfirmationMsg(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    if (res.error) {
      setError(res.error);
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#08080D]/85 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
      onClick={continueAsGuest}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[var(--surface-elevated)] border border-[var(--border-color)] shadow-2xl p-6 sm:p-7 relative my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle top neon accent bar */}
        <div className="absolute top-0 left-8 right-8 h-[2px] rounded-full bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-80" />

        <button
          onClick={continueAsGuest}
          aria-label="Close authentication modal"
          className="absolute top-5 right-5 p-2 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#14141F] border border-[var(--accent)]/30 flex items-center justify-center mx-auto mb-3 shadow-lg glow-accent-sm">
            <svg className="w-6 h-6" viewBox="0 0 512 512">
              <rect x="136" y="216" width="28" height="80" rx="14" fill="#C8F542" />
              <rect x="184" y="156" width="28" height="200" rx="14" fill="#C8F542" />
              <rect x="232" y="116" width="28" height="280" rx="14" fill="#C8F542" />
              <rect x="280" y="176" width="28" height="160" rx="14" fill="#C8F542" />
              <rect x="328" y="236" width="28" height="40" rx="14" fill="#C8F542" />
            </svg>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {isLimitReached
              ? 'Unlock Unlimited Moodsonix'
              : isSignUp
              ? 'Create your Moodsonix account'
              : 'Welcome back to Moodsonix'}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-xs mx-auto leading-relaxed">
            {isLimitReached
              ? 'Sign in for unlimited music search and cloud-synced playlists.'
              : 'Sync liked songs, build public or private playlists, and listen across devices.'}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] mb-5">
          <button
            type="button"
            onClick={() => {
              setAuthMode('login');
              setError(null);
              setConfirmationMsg(null);
            }}
            className={cn(
              'py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              !isSignUp
                ? 'bg-[var(--accent)] text-black shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setError(null);
              setConfirmationMsg(null);
            }}
            className={cn(
              'py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              isSignUp
                ? 'bg-[var(--accent)] text-black shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            Create Account
          </button>
        </div>

        {/* Error / Confirmation Feedback */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {confirmationMsg && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--text-primary)] text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[var(--accent)]" />
            <span>{confirmationMsg}</span>
          </div>
        )}

        {/* Email + Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Username
              </label>
              <div className="relative flex items-center">
                <UserIcon className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Alex Rivers"
                  autoComplete="username"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="listener@example.com"
                autoComplete="email"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || googleLoading}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-black font-semibold text-xs hover:bg-[var(--accent-hover)] transition-all shadow-md glow-accent-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-[var(--border-color)]" />
          <span className="text-[11px] text-[var(--text-muted)]">or</span>
          <div className="h-px flex-1 bg-[var(--border-color)]" />
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || googleLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
          ) : (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 5c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.31 0 3.25 2.69 1.27 6.61l3.66 2.84C5.8 6.84 8.64 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-2 3.72-4.94 3.72-8.69z"
              />
              <path
                fill="#FBBC05"
                d="M4.93 14.55c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09L1.27 7.53C.46 9.15 0 10.97 0 12.46s.46 3.31 1.27 4.93l3.66-2.84z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.36 0-6.2-1.84-7.07-4.45l-3.66 2.84C3.25 21.31 7.31 24 12 24z"
              />
            </svg>
          )}
          <span>Continue with Google</span>
        </button>

        {/* Continue as Guest */}
        <button
          type="button"
          onClick={continueAsGuest}
          className="w-full mt-3 py-2.5 px-4 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--surface)]/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>Continue as guest</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
