import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { HERO_EDITORIAL_IMG } from '../data/demoData';
import { Eye, EyeOff, ArrowRight, Sun, Moon, Compass, KeyRound, CheckCircle2 } from 'lucide-react';

type AuthView = 'login' | 'signup' | 'forgot';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, resetPassword, enterDemoMode, error, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [view, setView] = useState<AuthView>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const switchView = (next: AuthView) => {
    setView(next);
    setLocalError(null);
    setResetSent(false);
    clearError();
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
        setLocalError('Please enter your full name.');
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
    }

    setSubmitting(true);
    try {
      if (view === 'login') {
        await signIn(email, password, rememberMe);
      } else {
        await signUp(fullName, email, password);
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
      <header className="w-full px-6 md:px-10 py-5 flex items-center justify-between border-b border-[#d8d4ca] dark:border-[#404040]">
        <div className="flex items-baseline gap-4">
          <span className="font-display text-2xl font-extrabold tracking-tight uppercase whitespace-nowrap">
            SWOOOSH
          </span>
          <span className="hidden sm:inline text-xs tracking-[0.18em] uppercase text-[#5c5a54] dark:text-[#b0b0b0]">
            PLAN. ORGANIZE. WEAR.
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-[#d8d4ca] dark:border-[#404040] bg-white dark:bg-[#303030] hover:bg-[#eae7e0] dark:hover:bg-[#404040] transition-colors cursor-pointer"
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
        <section className="hidden lg:flex lg:col-span-6 relative bg-[#171717] border-r border-[#d8d4ca] dark:border-[#404040] overflow-hidden">
          <img
            src={HERO_EDITORIAL_IMG}
            alt="SWOOOSH Concrete Streetwear Editorial"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover grayscale contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#171717] via-[#171717]/35 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-[#e5e1da] space-y-3">
            <p className="text-xs tracking-[0.22em] uppercase text-[#b0b0b0]">
              SWOOOSH AI · YOUR PERSONAL AI FASHION STYLIST
            </p>
            <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08] max-w-lg text-balance">
              Concrete precision for your daily rotation.
            </h1>
            <p className="text-sm text-[#b0b0b0] max-w-md leading-relaxed">
              Catalog every garment, compose looks in Fit Builder, schedule your week, and receive tailored recommendations from SWOOOSH AI.
            </p>
          </div>
        </section>

        {/* Right Auth Form Column */}
        <section className="lg:col-span-6 flex flex-col justify-center px-6 py-10 sm:px-12 md:px-16">
          <div className="w-full max-w-md mx-auto space-y-7">
            {/* Heading */}
            <div>
              <p className="text-xs tracking-[0.18em] uppercase text-[#5c5a54] dark:text-[#b0b0b0] mb-2">
                {view === 'login'
                  ? 'Member Access'
                  : view === 'signup'
                  ? 'New Wardrobe'
                  : 'Account Recovery'}
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight">
                {view === 'login'
                  ? 'Sign in to SWOOOSH'
                  : view === 'signup'
                  ? 'Create your account'
                  : 'Reset your password'}
              </h2>
              <p className="text-sm text-[#5c5a54] dark:text-[#b0b0b0] mt-1.5">
                {view === 'login'
                  ? 'Access your personal wardrobe, lookbook, and stylist.'
                  : view === 'signup'
                  ? 'Build your digital closet and style rotation.'
                  : 'Enter your email address and we will send a reset link.'}
              </p>
            </div>

            {displayError && (
              <div className="p-3.5 border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs leading-relaxed">
                {displayError}
              </div>
            )}

            {resetSent && (
              <div className="p-3.5 border border-[#404040] bg-white dark:bg-[#303030] text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Password reset instructions have been sent to <strong>{email}</strong>. Check your inbox and return to sign in.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Blake"
                    className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none focus:border-[#171717] dark:focus:border-[#e5e1da] transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none focus:border-[#171717] dark:focus:border-[#e5e1da] transition-colors"
                />
              </div>

              {view !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0]">
                      Password
                    </label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchView('forgot')}
                        className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] underline underline-offset-4 cursor-pointer"
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
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none focus:border-[#171717] dark:focus:border-[#e5e1da] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-2.5 text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {view === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040] focus:outline-none focus:border-[#171717] dark:focus:border-[#e5e1da] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      className="absolute right-3 top-2.5 text-[#5c5a54] dark:text-[#b0b0b0] hover:text-[#171717] dark:hover:text-[#e5e1da] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {view === 'login' && (
                <label className="flex items-center gap-2.5 text-xs text-[#5c5a54] dark:text-[#b0b0b0] cursor-pointer select-none">
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
                className="w-full py-3 px-4 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
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
            </form>

            {/* Navigation Switch Links */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#d8d4ca] dark:border-[#404040]">
              {view === 'login' ? (
                <>
                  <span className="text-[#5c5a54] dark:text-[#b0b0b0]">New to SWOOOSH?</span>
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
                  <span className="text-[#5c5a54] dark:text-[#b0b0b0]">Already have an account?</span>
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
            <div className="p-4 border border-[#d8d4ca] dark:border-[#404040] bg-white dark:bg-[#303030] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Instant Preview
                </span>
                <span className="text-[11px] font-mono-num text-[#5c5a54] dark:text-[#b0b0b0]">
                  Isolated Demo Environment
                </span>
              </div>
              <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0] leading-relaxed">
                Explore Fit Builder, My Wardrobe, Lookbook, Planner, and SWOOOSH AI immediately with curated streetwear sample data.
              </p>
              <button
                type="button"
                onClick={enterDemoMode}
                className="w-full py-2.5 px-4 border border-[#171717] dark:border-[#e5e1da] text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#171717] hover:text-[#f5f4f0] dark:hover:bg-[#e5e1da] dark:hover:text-[#171717] transition-colors cursor-pointer"
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
