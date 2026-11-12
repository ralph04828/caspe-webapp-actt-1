import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { 
  FolderArchive, 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  UserCheck, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  Files
} from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, demoSignIn, error, clearError } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('freelancer');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Please fill in both email and password.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(
          email.trim(),
          password,
          displayName.trim() || email.split('@')[0],
          role
        );
      }
    } catch (err: any) {
      setLocalError(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    clearError();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoSignIn = async (selectedRole: UserRole) => {
    setIsSubmitting(true);
    try {
      await demoSignIn(selectedRole);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-pink-100/60 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8">
      {/* Container */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl shadow-pink-900/5 border border-pink-100 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
        
        {/* Left Side: Dark Pink Brand Showcase */}
        <div className="md:col-span-5 bg-[#831843] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle decorative circles */}
          <div className="absolute -top-16 -right-16 w-52 h-52 bg-[#9d174d] rounded-full opacity-40 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-60 h-60 bg-[#be185d] rounded-full opacity-30 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-400 to-rose-300 flex items-center justify-center shadow-lg shadow-pink-950/30">
                <Files className="w-5 h-5 text-[#831843]" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white">Swoooshz</span>
            </div>
            
            <p className="mt-3 text-pink-200 text-sm font-medium">
              Client File Portal for Freelancers & Designers
            </p>

            {/* Value props */}
            <div className="mt-10 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-pink-700/60 text-pink-200 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Frictionless Uploads</h4>
                  <p className="text-xs text-pink-200/80 leading-relaxed">
                    Clients upload project assets, feedback, and briefs directly to your portal.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-pink-700/60 text-pink-200 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Secure by Default</h4>
                  <p className="text-xs text-pink-200/80 leading-relaxed">
                    Individual security rules ensure files are isolated and protected.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded-full bg-pink-700/60 text-pink-200 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Instant Preview & Manage</h4>
                  <p className="text-xs text-pink-200/80 leading-relaxed">
                    View images, review PDFs, track upload dates and delete files anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Demo Login Helper for easy evaluation */}
          <div className="relative z-10 pt-8 mt-6 border-t border-pink-700/60">
            <p className="text-xs text-pink-200 mb-2 font-medium">Quick Explore (1-Click Demo):</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSignIn('freelancer')}
                className="px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-pink-400/30 text-center"
              >
                Freelancer Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoSignIn('client')}
                className="px-3 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-pink-400/30 text-center"
              >
                Client Demo
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            {/* Mode Switch Tabs */}
            <div className="flex border-b border-pink-100 mb-6">
              <button
                type="button"
                onClick={() => { setMode('signin'); setLocalError(null); }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  mode === 'signin'
                    ? 'border-[#831843] text-[#831843]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setLocalError(null); }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                  mode === 'signup'
                    ? 'border-[#831843] text-[#831843]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                Create an Account
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                {mode === 'signin' ? 'Welcome Back' : 'Get Started with Swoooshz'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {mode === 'signin'
                  ? 'Sign in to access your client portal and uploaded files.'
                  : 'Create your account to start managing and receiving client files.'}
              </p>
            </div>

            {/* Error banner */}
            {(localError || error) && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
                <span className="font-semibold shrink-0">Note:</span>
                <span>{localError || error}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Your Full Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full px-3.5 py-2.5 bg-pink-50/40 border border-pink-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#831843]/30 focus:border-[#831843] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      I am a...
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('freelancer')}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                          role === 'freelancer'
                            ? 'bg-[#831843] text-white border-[#831843]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'
                        }`}
                      >
                        Freelancer / Designer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('client')}
                        className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-all text-center ${
                          role === 'client'
                            ? 'bg-[#831843] text-white border-[#831843]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'
                        }`}
                      >
                        Client
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-pink-50/40 border border-pink-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#831843]/30 focus:border-[#831843] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-pink-50/40 border border-pink-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#831843]/30 focus:border-[#831843] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 bg-[#831843] hover:bg-[#9d174d] text-white font-semibold text-sm rounded-xl shadow-lg shadow-pink-900/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="inline-block animate-spin mr-2">⭮</span>
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {mode === 'signin' ? 'Sign In' : 'Create an Account'}
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-gray-400 font-medium">Or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-white hover:bg-pink-50/50 border border-pink-200 text-gray-700 font-medium text-sm rounded-xl flex items-center justify-center gap-3 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Sign In with Google</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
