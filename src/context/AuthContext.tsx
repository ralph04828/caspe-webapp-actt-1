import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import { createUserProfile, getUserProfile } from '../services/firestoreService';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string, role: UserRole) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  demoSignIn: (role?: UserRole) => Promise<void>;
  isDemoUser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(false);

  const clearError = () => setError(null);

  useEffect(() => {
    // Check if demo user was saved in localStorage
    const savedDemo = localStorage.getItem('swoooshz_demo_user');
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo);
        setUserProfile(parsed);
        setIsDemoUser(true);
        setLoading(false);
        return;
      } catch {
        localStorage.removeItem('swoooshz_demo_user');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsDemoUser(false);
        try {
          let profile = await getUserProfile(user.uid);
          if (!profile) {
            profile = {
              uid: user.uid,
              email: user.email || 'user@swoooshz.com',
              displayName: user.displayName || user.email?.split('@')[0] || 'Creative Designer',
              photoURL: user.photoURL || undefined,
              role: 'freelancer',
              createdAt: new Date().toISOString(),
            };
            await createUserProfile(profile);
          }
          setUserProfile(profile);
        } catch (err) {
          console.warn('Could not fetch or create profile in Firestore:', err);
          // Fallback profile from auth object
          setUserProfile({
            uid: user.uid,
            email: user.email || 'user@swoooshz.com',
            displayName: user.displayName || 'Creative Designer',
            photoURL: user.photoURL || undefined,
            role: 'freelancer',
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        if (!localStorage.getItem('swoooshz_demo_user')) {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password. Please verify and try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not yet enabled in this Firebase project. You can sign in with Google or use the 1-Click Demo Freelancer mode.';
      case 'auth/popup-closed-by-user':
        return 'The Google sign-in window was closed before completion. Please try again.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setError(null);
    try {
      localStorage.removeItem('swoooshz_demo_user');
      setIsDemoUser(false);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName: string, role: UserRole) => {
    setError(null);
    try {
      localStorage.removeItem('swoooshz_demo_user');
      setIsDemoUser(false);
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email || email,
        displayName: displayName || email.split('@')[0],
        role,
        createdAt: new Date().toISOString(),
      };
      await createUserProfile(profile);
      setUserProfile(profile);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      localStorage.removeItem('swoooshz_demo_user');
      setIsDemoUser(false);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      let profile = await getUserProfile(cred.user.uid);
      if (!profile) {
        profile = {
          uid: cred.user.uid,
          email: cred.user.email || 'user@swoooshz.com',
          displayName: cred.user.displayName || 'Creative Designer',
          photoURL: cred.user.photoURL || undefined,
          role: 'freelancer',
          createdAt: new Date().toISOString(),
        };
        await createUserProfile(profile);
      }
      setUserProfile(profile);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const demoSignIn = async (role: UserRole = 'freelancer') => {
    setError(null);
    const demoProfile: UserProfile = {
      uid: 'demo_user_swoooshz_123',
      email: role === 'client' ? 'client@acme.com' : 'elena.design@swoooshz.studio',
      displayName: role === 'client' ? 'Alex Rivera (Client)' : 'Elena Vance (Lead Designer)',
      role,
      createdAt: '2026-01-15T10:00:00.000Z',
    };
    localStorage.setItem('swoooshz_demo_user', JSON.stringify(demoProfile));
    setUserProfile(demoProfile);
    setIsDemoUser(true);
  };

  const signOutUser = async () => {
    setError(null);
    localStorage.removeItem('swoooshz_demo_user');
    setIsDemoUser(false);
    setUserProfile(null);
    setCurrentUser(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        error,
        clearError,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOutUser,
        demoSignIn,
        isDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
