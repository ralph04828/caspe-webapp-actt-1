import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import {
  deleteAllUserData,
  getUserProfile,
  isUsernameAvailable,
  reserveUsername,
  saveUserProfile,
  updateUserProfileDoc,
} from '../services/firestoreService';
import { DEMO_USER_ID, DEMO_USER_PROFILE } from '../data/demoData';
import { ThemeMode, UserProfile } from '../types';
import { useTheme } from './ThemeContext';
import { normalizeUsername, validateUsername } from '../utils/formatters';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (params: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    isAdultConfirmed: boolean;
  }) => Promise<void>;
  checkUsernameFree: (username: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<void>;
  enterDemoMode: () => void;
  signOutUser: () => Promise<void>;
  updateAccountProfile: (updates: Partial<UserProfile> & { theme?: ThemeMode }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
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

  const buildDefaultProfile = (user: User, preferredUsername?: string): UserProfile => {
    const baseName = user.displayName || user.email?.split('@')[0] || 'Member';
    const rawUser = preferredUsername || `${normalizeUsername(baseName) || 'member'}_${user.uid.slice(0, 4)}`;
    const usernameLower = normalizeUsername(rawUser).padEnd(3, 's');
    return {
      uid: user.uid,
      email: '', // Keep PII email out of shared profile documents; read from auth.currentUser
      displayName: baseName,
      username: usernameLower,
      usernameLower,
      bio: '',
      photoURL: user.photoURL || undefined,
      theme: 'dark',
      stylePreference: 'Streetwear',
      styleTags: ['Streetwear', 'Minimalist'],
      isPublic: true,
      defaultItemVisibility: 'public',
      defaultOutfitVisibility: 'public',
      autoDirtyOnWear: false,
      isAdultConfirmed: true,
      notificationPrefs: { likes: true, comments: true, follows: true, remixes: true },
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const demoFlag = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoFlag === 'true') {
      setIsDemoMode(true);
      setUserProfile(DEMO_USER_PROFILE);
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
            profile = buildDefaultProfile(user);
            await reserveUsername(profile.usernameLower, user.uid).catch(() => {});
            await saveUserProfile(profile);
          }
          const hydrated: UserProfile = {
            ...profile,
            email: user.email || profile.email || '',
            styleTags: profile.styleTags || ['Streetwear'],
            defaultItemVisibility: profile.defaultItemVisibility || 'public',
            defaultOutfitVisibility: profile.defaultOutfitVisibility || 'public',
            isPublic: profile.isPublic !== false,
            autoDirtyOnWear: Boolean(profile.autoDirtyOnWear),
            followersCount: profile.followersCount || 0,
            followingCount: profile.followingCount || 0,
            postsCount: profile.postsCount || 0,
          };
          setUserProfile(hydrated);
          if (hydrated.theme === 'light' || hydrated.theme === 'dark') {
            setTheme(hydrated.theme);
          }
        } catch (err) {
          console.warn('Could not load Firestore user profile:', err);
          setUserProfile(buildDefaultProfile(user));
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
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed before completing. Please try again.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled in Firebase Console yet. Use Google Sign-In or Explore Demo.';
      case 'auth/requires-recent-login':
        return 'For security, please sign out and sign back in before completing this action.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  };

  const checkUsernameFree = async (username: string): Promise<boolean> => {
    const lower = normalizeUsername(username);
    if (validateUsername(lower)) return false;
    if (isDemoMode) return lower !== DEMO_USER_PROFILE.usernameLower;
    return isUsernameAvailable(lower, currentUser?.uid);
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

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await setPersistence(auth, browserLocalPersistence);
      localStorage.removeItem(DEMO_SESSION_KEY);
      setIsDemoMode(false);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUp = async (params: {
    fullName: string;
    username: string;
    email: string;
    password: string;
    isAdultConfirmed: boolean;
  }) => {
    setError(null);
    if (!params.isAdultConfirmed) {
      const msg = 'You must confirm you are 13 or older to create a SWOOOSH account.';
      setError(msg);
      throw new Error(msg);
    }
    const usernameErr = validateUsername(params.username);
    if (usernameErr) {
      setError(usernameErr);
      throw new Error(usernameErr);
    }
    const usernameLower = normalizeUsername(params.username);
    const available = await isUsernameAvailable(usernameLower);
    if (!available) {
      const msg = `@${usernameLower} is already taken. Try another username.`;
      setError(msg);
      throw new Error(msg);
    }

    try {
      await setPersistence(auth, browserLocalPersistence);
      localStorage.removeItem(DEMO_SESSION_KEY);
      setIsDemoMode(false);
      const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      if (cred.user && params.fullName.trim()) {
        await updateProfile(cred.user, { displayName: params.fullName.trim() });
      }
      await reserveUsername(usernameLower, cred.user.uid);
      const profile: UserProfile = {
        uid: cred.user.uid,
        email: '',
        displayName: params.fullName.trim() || usernameLower,
        username: usernameLower,
        usernameLower,
        bio: '',
        theme: 'dark',
        stylePreference: 'Streetwear',
        styleTags: ['Streetwear'],
        isPublic: true,
        defaultItemVisibility: 'public',
        defaultOutfitVisibility: 'public',
        autoDirtyOnWear: false,
        isAdultConfirmed: true,
        notificationPrefs: { likes: true, comments: true, follows: true, remixes: true },
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: new Date().toISOString(),
      };
      await saveUserProfile(profile);
      setUserProfile({ ...profile, email: cred.user.email || params.email.trim() });
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
    setUserProfile(DEMO_USER_PROFILE);
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
      // ignore
    }
  };

  const updateAccountProfile = async (updates: Partial<UserProfile> & { theme?: ThemeMode }) => {
    if (!userProfile) return;

    const cleanUpdates = { ...updates };
    if (cleanUpdates.username) {
      const err = validateUsername(cleanUpdates.username);
      if (err) throw new Error(err);
      const lower = normalizeUsername(cleanUpdates.username);
      if (lower !== userProfile.usernameLower) {
        const free = await checkUsernameFree(lower);
        if (!free) throw new Error(`@${lower} is already taken.`);
        if (!isDemoMode) {
          await reserveUsername(lower, userProfile.uid);
        }
        cleanUpdates.username = lower;
        cleanUpdates.usernameLower = lower;
      }
    }

    if (isDemoMode) {
      setUserProfile((prev) => (prev ? { ...prev, ...cleanUpdates } : prev));
      if (cleanUpdates.theme) setTheme(cleanUpdates.theme);
      return;
    }

    if (auth.currentUser && (cleanUpdates.displayName !== undefined || cleanUpdates.photoURL !== undefined)) {
      await updateProfile(auth.currentUser, {
        displayName: cleanUpdates.displayName ?? auth.currentUser.displayName ?? undefined,
        photoURL:
          cleanUpdates.photoURL && !cleanUpdates.photoURL.startsWith('data:')
            ? cleanUpdates.photoURL
            : auth.currentUser.photoURL ?? undefined,
      }).catch(() => {});
    }

    // Never persist email field into Firestore /users doc to prevent PII leakage
    const firestorePayload = { ...cleanUpdates };
    delete firestorePayload.email;

    await updateUserProfileDoc(userProfile.uid, firestorePayload);
    setUserProfile((prev) => (prev ? { ...prev, ...cleanUpdates } : prev));
    if (cleanUpdates.theme) setTheme(cleanUpdates.theme);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (isDemoMode) {
      throw new Error('Password cannot be changed in Demo Mode.');
    }
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Password changes apply to email/password accounts.');
    }
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
    } catch (err: any) {
      throw new Error(mapAuthError(err));
    }
  };

  const deleteAccount = async () => {
    if (isDemoMode) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      localStorage.removeItem('swooosh_demo_data_v2');
      localStorage.removeItem('swooosh_demo_social_v2');
      setIsDemoMode(false);
      setUserProfile(null);
      return;
    }
    if (!auth.currentUser || !userProfile) {
      throw new Error('No signed-in user to delete.');
    }
    const uid = auth.currentUser.uid;
    const uname = userProfile.usernameLower;
    await deleteAllUserData(uid, uname);
    await deleteUser(auth.currentUser);
    setUserProfile(null);
    setCurrentUser(null);
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
        signInWithGoogle,
        signUp,
        checkUsernameFree,
        resetPassword,
        enterDemoMode,
        signOutUser,
        updateAccountProfile,
        changePassword,
        deleteAccount,
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
