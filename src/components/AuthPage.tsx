import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HERO_EDITORIAL_IMG } from '../data/demoData';
import { normalizeUsername, validateUsername } from '../utils/formatters';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  Compass,
  KeyRound,
  CheckCircle2,
  AtSign,
  Loader2,
} from 'lucide-react';

type AuthView = 'login' | 'signup' | 'forgot';

export const AuthPage: React.FC = () => {
  const {
    signIn,
    signInWithGoogle,
    signUp,
    checkUsernameFree,
    resetPassword,
    enterDemoMode,
    error,
    clearError,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [view, setView] = useState<AuthView>('login');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (view !== 'signup' || !username.trim()) {
      setUsernameStatus('idle');
      return;
    }
    const clean = normalizeUsername(username);
    if (validateUsername(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const free = await checkUsernameFree(clean);
        setUsernameStatus(free ? 'free' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 380);
    return () => clearTimeout(t);
  }, [username, view]);

  const switchView = (next: AuthView) => {
    setView(next);
    setLocalError(null);
    setResetSent(false);
    clearError();
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }

    if (view === 'forgot') {
      setSubmitting(true);
      try {
        await resetPassword(email);
        setResetSent(true);
      } catch (err: any) {
        setLocalError(err.message);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    if (view === 'signup') {
      if (!fullName.trim()) {
        setLocalError('Please enter your display name.');
        return;
      }
      const uErr = validateUsername(username);
      if (uErr) {
        setLocalError(uErr);
        return;
      }
      if (usernameStatus === 'taken') {
        setLocalError('This username is already taken.');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      if (!isAdultConfirmed) {
        setLocalError('Please confirm you are 13 or older to create an account.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (view === 'login') {
        await signIn(email, password, rememberMe);
      } else {
        await signUp({
          fullName,
          username: normalizeUsername(username),
          email,
          password,
          isAdultConfirmed,
        });
      }
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex flex-col">
      {/* Top Bar */}
      <header className="w-full px-6 md:px-10 py-4 flex items-center justify-between border-b border-[#d4cfc5] dark:border-[#404040] mica-surface">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl font-extrabold tracking-tight uppercase whitespace-nowrap">
            SWOOOSH
          </span>
          <span className="hidden sm:inline text-xs tracking-[0.18em] uppercase text-[#4e4c46] dark:text-[#c2bfb8]">
            PLAN. ORGANIZE. WEAR. · SHARE YOUR FIT.
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="flex items-center gap-2 px-3.5 py-2 rounded-control text-xs font-medium border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Split Editorial Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Editorial Photography Column */}
        <section className="hidden lg:flex lg:col-span-6 relative bg-[#171717] border-r border-[#d4cfc5] dark:border-[#404040] overflow-hidden">
          <img
            src={HERO_EDITORIAL_IMG}
            alt="SWOOOSH Concrete Streetwear Editorial"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover grayscale contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#171717] via-[#171717]/40 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-[#e5e1da] space-y-3">
            <p className="text-xs tracking-[0.22em] uppercase text-[#c2bfb8]">
              CONCRETE EDITION · OPEN STYLE COMMUNITY
            </p>
            <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08] max-w-lg text-balance">
              Share your rotation. Plan every fit.
            </h1>
            <p className="text-sm text-[#c2bfb8] max-w-md leading-relaxed">
              SWOOOSH is a fashion social network: share your fits, build your wardrobe, plan your outfits, post 24h MyDay stories, and connect with friends.
            </p>
          </div>
        </section>

        {/* Right Auth Form Column */}
        <section className="lg:col-span-6 flex flex-col justify-center px-6 py-10 sm:px-12 md:px-16">
          <div className="w-full max-w-md mx-auto space-y-6">
            <div>
              <p className="text-xs tracking-[0.18em] uppercase text-[#4e4c46] dark:text-[#c2bfb8] mb-2">
                {view === 'login'
                  ? 'Member Access'
                  : view === 'signup'
                  ? 'Join SWOOOSH'
                  : 'Account Recovery'}
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {view === 'login'
                  ? 'Sign in to SWOOOSH'
                  : view === 'signup'
                  ? 'Create your profile'
                  : 'Reset your password'}
              </h2>
              <p className="text-sm text-[#4e4c46] dark:text-[#c2bfb8] mt-1.5">
                {view === 'login'
                  ? 'Connect with style creators and manage your wardrobe.'
                  : view === 'signup'
                  ? 'Claim your @handle, build your lookbook, and share your fit.'
                  : 'Enter your email address and we will send a reset link.'}
              </p>
            </div>

            {displayError && (
              <div
                role="alert"
                className="p-3.5 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs leading-relaxed"
              >
                {displayError}
              </div>
            )}

            {resetSent && (
              <div className="p-3.5 rounded-control border border-[#404040] bg-white dark:bg-[#242424] text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Password reset instructions have been sent to <strong>{email}</strong>.
                </span>
              </div>
            )}

            {view !== 'forgot' && (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] hover:bg-[#eae7e0] dark:hover:bg-[#303030] text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <span className="font-display font-extrabold text-base">G</span>
                <span>Continue with Google</span>
              </button>
            )}

            {view !== 'forgot' && (
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#d4cfc5] dark:border-[#404040]" />
                <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                  or with email
                </span>
                <div className="flex-grow border-t border-[#d4cfc5] dark:border-[#404040]" />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jordan Blake"
                      className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040] focus:border-[#171717] dark:focus:border-[#e5e1da]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                        Username
                      </label>
                      {usernameStatus === 'checking' && (
                        <span className="text-[11px] flex items-center gap-1 text-[#4e4c46] dark:text-[#c2bfb8]">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                        </span>
                      )}
                      {usernameStatus === 'free' && (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                          Available
                        </span>
                      )}
                      {usernameStatus === 'taken' && (
                        <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                          Already taken
                        </span>
                      )}
                      {usernameStatus === 'invalid' && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                          3–24 chars (a-z, 0-9, ., _)
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <AtSign className="w-4 h-4 absolute left-3 top-3 text-[#4e4c46] dark:text-[#c2bfb8]" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                        placeholder="jordan.fits"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-3.5 py-2.5 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              {view !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                      Password
                    </label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchView('forgot')}
                        className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] hover:text-[#171717] dark:hover:text-[#e5e1da] underline underline-offset-4 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {view === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-control text-sm bg-white dark:bg-[#242424] border border-[#d4cfc5] dark:border-[#404040]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-3 top-2.5 text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 text-xs text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAdultConfirmed}
                      onChange={(e) => setIsAdultConfirmed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-[#171717] dark:accent-[#e5e1da]"
                    />
                    <span>I confirm I am 13 or older and agree to follow respectful community standards.</span>
                  </label>
                </>
              )}

              {view === 'login' && (
                <label className="flex items-center gap-2.5 text-xs text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 accent-[#171717] dark:accent-[#e5e1da]"
                  />
                  <span>Remember session across browser restarts</span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-full bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {view === 'forgot' ? (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{submitting ? 'Sending...' : 'Send Reset Link'}</span>
                  </>
                ) : (
                  <>
                    <span>
                      {submitting
                        ? 'Please wait...'
                        : view === 'login'
                        ? 'Sign In'
                        : 'Create Account'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {view === 'signup' && (
                <p className="text-[11px] text-center text-[#4e4c46] dark:text-[#c2bfb8]">
                  We&apos;ll send a quick verification link to your inbox after sign-up.
                </p>
              )}
            </form>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
              {view === 'login' ? (
                <>
                  <span className="text-[#4e4c46] dark:text-[#c2bfb8]">New to SWOOOSH?</span>
                  <button
                    type="button"
                    onClick={() => switchView('signup')}
                    className="font-semibold underline underline-offset-4 hover:opacity-75 cursor-pointer"
                  >
                    Create an Account
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[#4e4c46] dark:text-[#c2bfb8]">Already have an account?</span>
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="font-semibold underline underline-offset-4 hover:opacity-75 cursor-pointer"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>

            {/* Explore Demo Option */}
            <div className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Instant Preview
                </span>
                <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                  Isolated Demo
                </span>
              </div>
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] leading-relaxed">
                Preview the social feed, creator profiles, MyDay stories, Messages, My Wardrobe, Fit Builder, Lookbook, and Planner with sample outfits.
              </p>
              <button
                type="button"
                onClick={enterDemoMode}
                className="w-full py-2.5 px-4 rounded-full border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Demo</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
