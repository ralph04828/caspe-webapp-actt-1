import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '../firebase';
import {
  getUserProfile,
  saveUserProfile,
  updateUserProfileDoc,
} from '../services/firestoreService';
import { DEMO_USER_ID } from '../data/demoData';
import { ThemeMode, UserProfile } from '../types';
import { useTheme } from './ThemeContext';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  enterDemoMode: () => void;
  signOutUser: () => Promise<void>;
  updateAccountProfile: (updates: { displayName?: string; photoURL?: string; stylePreference?: string; theme?: ThemeMode }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_SESSION_KEY = 'swooosh_demo_active';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  useEffect(() => {
    const demoFlag = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoFlag === 'true') {
      setIsDemoMode(true);
      setUserProfile({
        uid: DEMO_USER_ID,
        email: 'demo@swooosh.style',
        displayName: 'Marcus Vance',
        stylePreference: 'Streetwear',
        createdAt: '2026-08-01T10:00:00.000Z',
      });
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.removeItem(DEMO_SESSION_KEY);
        setIsDemoMode(false);
        setCurrentUser(user);

        try {
          let profile = await getUserProfile(user.uid);
          if (!profile) {
            profile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || user.email?.split('@')[0] || 'Member',
              photoURL: user.photoURL || undefined,
              theme: 'dark',
              stylePreference: 'Streetwear',
              createdAt: new Date().toISOString(),
            };
            await saveUserProfile(profile);
          }
          setUserProfile(profile);
          if (profile.theme === 'light' || profile.theme === 'dark') {
            setTheme(profile.theme);
          }
        } catch (err) {
          console.warn('Could not load Firestore user profile:', err);
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'Member',
            photoURL: user.photoURL || undefined,
            createdAt: new Date().toISOString(),
          });
        }
        setLoading(false);
      } else {
        setCurrentUser(null);
        if (localStorage.getItem(DEMO_SESSION_KEY) !== 'true') {
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const mapAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). You can enable it there or use Explore Demo right now.';
      case 'auth/requires-recent-login':
        return 'For security, please sign out and sign back in before changing your password.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  };

  const signIn = async (email: string, password: string, rememberMe = true) => {
    setError(null);
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      localStorage.removeItem(DEMO_SESSION_KEY);
      setIsDemoMode(false);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    setError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      localStorage.removeItem(DEMO_SESSION_KEY);
      setIsDemoMode(false);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user && fullName.trim()) {
        await updateProfile(cred.user, { displayName: fullName.trim() });
      }
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email || email.trim(),
        displayName: fullName.trim() || email.split('@')[0],
        theme: 'dark',
        stylePreference: 'Streetwear',
        createdAt: new Date().toISOString(),
      };
      await saveUserProfile(profile);
      setUserProfile(profile);
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const enterDemoMode = () => {
    setError(null);
    localStorage.setItem(DEMO_SESSION_KEY, 'true');
    setIsDemoMode(true);
    setUserProfile({
      uid: DEMO_USER_ID,
      email: 'demo@swooosh.style',
      displayName: 'Marcus Vance',
      stylePreference: 'Streetwear',
      createdAt: '2026-08-01T10:00:00.000Z',
    });
  };

  const signOutUser = async () => {
    setError(null);
    localStorage.removeItem(DEMO_SESSION_KEY);
    setIsDemoMode(false);
    setUserProfile(null);
    setCurrentUser(null);
    try {
      await signOut(auth);
    } catch {
      // ignore if already signed out
    }
  };

  const updateAccountProfile = async (updates: {
    displayName?: string;
    photoURL?: string;
    stylePreference?: string;
    theme?: ThemeMode;
  }) => {
    if (!userProfile) return;

    if (isDemoMode) {
      setUserProfile((prev) => (prev ? { ...prev, ...updates } : prev));
      if (updates.theme) setTheme(updates.theme);
      return;
    }

    if (auth.currentUser && (updates.displayName !== undefined || updates.photoURL !== undefined)) {
      await updateProfile(auth.currentUser, {
        displayName: updates.displayName ?? auth.currentUser.displayName ?? undefined,
        photoURL:
          updates.photoURL && !updates.photoURL.startsWith('data:')
            ? updates.photoURL
            : auth.currentUser.photoURL ?? undefined,
      });
    }

    await updateUserProfileDoc(userProfile.uid, updates);
    setUserProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    if (updates.theme) setTheme(updates.theme);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (isDemoMode) {
      throw new Error('Password cannot be changed in Demo Mode. Create a personal account to manage credentials.');
    }
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('You must be signed in to update your password.');
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
    } catch (err: any) {
      throw new Error(mapAuthError(err));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isDemoMode,
        error,
        clearError,
        signIn,
        signUp,
        resetPassword,
        enterDemoMode,
        signOutUser,
        updateAccountProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
