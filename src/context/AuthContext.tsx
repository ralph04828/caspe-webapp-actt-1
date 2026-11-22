import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  claimUsernameAndSaveProfile,
  deleteAllUserData,
  getUserProfile,
  isUsernameAvailable,
  savePrivateUserBirthday,
  updateUserPresence,
  updateUserProfileDoc,
} from '../services/firestoreService';
import { DEMO_USER_PROFILE } from '../data/demoData';
import { ThemeMode, UserProfile } from '../types';
import { useTheme } from './ThemeContext';
import { normalizeUsername, validateUsername } from '../utils/formatters';
import { clearMediaCache, deleteImageAsset } from '../services/storageService';

export type OnboardingStep = 1 | 2 | 3 | 'reaction' | 'friends';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  needsOnboarding: boolean;
  isLegacyStep1Only: boolean;
  inviteUsername: string | null;
  clearInviteUsername: () => void;
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
  saveOnboardingStep1: (params: {
    displayName: string;
    username: string;
    bio: string;
    styleTags: string[];
    pronouns?: string;
    location?: string;
    birthday?: string;
    photoURL?: string;
    mediaId?: string;
    isAdultConfirmed: boolean;
  }) => Promise<void>;
  advanceOnboardingStep: (step: OnboardingStep, markCompleted?: boolean) => Promise<void>;
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
  const [isLegacyStep1Only, setIsLegacyStep1Only] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUsername, setInviteUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const u = params.get('u') || params.get('join');
    return u ? normalizeUsername(u) : null;
  });

  const pendingSignupRef = useRef<{ displayName: string; usernameLower: string } | null>(null);

  const clearError = () => setError(null);

  const clearInviteUsername = () => {
    setInviteUsername(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('u');
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const buildFreshDraftProfile = (user: User): UserProfile => {
    const now = new Date().toISOString();
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      username: '',
      usernameLower: '',
      bio: '',
      photoURL: user.photoURL || undefined,
      theme: 'dark',
      stylePreference: 'Streetwear',
      styleTags: ['Streetwear'],
      isPublic: true,
      defaultItemVisibility: 'public',
      defaultOutfitVisibility: 'public',
      autoDirtyOnWear: false,
      isAdultConfirmed: false,
      onboardingCompleted: false,
      onboardingStep: 1,
      checklistDismissed: false,
      showOnlineStatus: true,
      onlineStatus: true,
      lastSeenAt: now,
      notificationPrefs: { likes: true, comments: true, follows: true, friends: true, messages: true, remixes: true },
      friendsCount: 0,
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      createdAt: now,
    };
  };

  useEffect(() => {
    const demoFlag = localStorage.getItem(DEMO_SESSION_KEY);
    if (demoFlag === 'true') {
      setIsDemoMode(true);
      setIsLegacyStep1Only(false);
      setUserProfile({ ...DEMO_USER_PROFILE, onboardingCompleted: true, showOnlineStatus: true, onlineStatus: true });
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.removeItem(DEMO_SESSION_KEY);
        setIsDemoMode(false);
        setCurrentUser(user);

        try {
          if (pendingSignupRef.current) {
            return;
          }
          const profile = await getUserProfile(user.uid);
          if (!profile) {
            // Brand-new account (e.g. first-time Google Sign-In): keep unsaved draft on Step 1
            // until they pick a unique @username and complete Step 1 transactionally.
            setIsLegacyStep1Only(false);
            setUserProfile(buildFreshDraftProfile(user));
            setLoading(false);
            return;
          }

          const missingCoreFields = !profile.usernameLower?.trim() || !profile.displayName?.trim();
          const hasExplicitFlag = typeof profile.onboardingCompleted === 'boolean';
          const legacyNeedsStep1Only = missingCoreFields && (profile.onboardingCompleted === true || !hasExplicitFlag);
          setIsLegacyStep1Only(legacyNeedsStep1Only);

          const effectiveCompleted = missingCoreFields
            ? false
            : hasExplicitFlag
            ? profile.onboardingCompleted
            : true;

          const effectiveStep: OnboardingStep = missingCoreFields
            ? 1
            : profile.onboardingStep || (effectiveCompleted ? 1 : 2);

          const hydrated: UserProfile = {
            ...profile,
            email: user.email || profile.email || '',
            styleTags: profile.styleTags || ['Streetwear'],
            defaultItemVisibility: profile.defaultItemVisibility || 'public',
            defaultOutfitVisibility: profile.defaultOutfitVisibility || 'public',
            isPublic: profile.isPublic !== false,
            autoDirtyOnWear: Boolean(profile.autoDirtyOnWear),
            onboardingCompleted: effectiveCompleted,
            onboardingStep: effectiveStep,
            showOnlineStatus: profile.showOnlineStatus !== false,
            friendsCount: profile.friendsCount || 0,
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
          setIsLegacyStep1Only(false);
          setUserProfile(buildFreshDraftProfile(user));
        }
        setLoading(false);
      } else {
        setCurrentUser(null);
        setIsLegacyStep1Only(false);
        if (localStorage.getItem(DEMO_SESSION_KEY) !== 'true') {
          setUserProfile(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Presence heartbeat for live online / last-seen dot (only once profile exists in Firestore)
  useEffect(() => {
    if (isDemoMode || !userProfile?.uid || !userProfile.usernameLower) return;
    const show = userProfile.showOnlineStatus !== false;
    updateUserPresence(userProfile.uid, show, show);

    const interval = setInterval(() => {
      updateUserPresence(userProfile.uid, show, show);
    }, 60_000);

    const handleBeforeUnload = () => {
      updateUserPresence(userProfile.uid, false, show);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userProfile?.uid, userProfile?.usernameLower, userProfile?.showOnlineStatus, isDemoMode]);

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
        return 'Email/Password sign-in is disabled in Firebase Console. Use Google Sign-In or enable Email/Password under Authentication → Sign-in method.';
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase Authentication settings yet. Add it under Authentication → Settings → Authorized domains in Firebase Console.';
      case 'auth/network-request-failed':
        return 'Network error while contacting authentication service. Please check your connection and try again.';
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

    pendingSignupRef.current = {
      displayName: params.fullName.trim() || usernameLower,
      usernameLower,
    };

    try {
      await setPersistence(auth, browserLocalPersistence);
      localStorage.removeItem(DEMO_SESSION_KEY);
      setIsDemoMode(false);
      const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
      if (cred.user && params.fullName.trim()) {
        await updateProfile(cred.user, { displayName: params.fullName.trim() });
      }
      const now = new Date().toISOString();
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
        onboardingCompleted: false,
        onboardingStep: 1,
        checklistDismissed: false,
        showOnlineStatus: true,
        onlineStatus: true,
        lastSeenAt: now,
        notificationPrefs: { likes: true, comments: true, follows: true, friends: true, messages: true, remixes: true },
        friendsCount: 0,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: now,
      };
      await claimUsernameAndSaveProfile({
        uid: cred.user.uid,
        newUsernameLower: usernameLower,
        profileCreatePayload: profile,
      });
      setIsLegacyStep1Only(false);
      setUserProfile({ ...profile, email: cred.user.email || params.email.trim() });
    } catch (err: any) {
      const msg = mapAuthError(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      pendingSignupRef.current = null;
    }
  };

  const saveOnboardingStep1: AuthContextType['saveOnboardingStep1'] = async (params) => {
    if (!userProfile) return;
    if (!params.isAdultConfirmed) {
      throw new Error('You must confirm you are 13 or older to continue.');
    }
    const cleanName = params.displayName.trim();
    if (!cleanName) throw new Error('Please enter a display name.');

    const usernameErr = validateUsername(params.username);
    if (usernameErr) throw new Error(usernameErr);
    const lower = normalizeUsername(params.username);

    const nextCompleted = isLegacyStep1Only ? true : false;
    const nextStep: OnboardingStep = isLegacyStep1Only ? 1 : 2;
    const now = new Date().toISOString();

    const cleanTags = params.styleTags.length > 0 ? params.styleTags : ['Streetwear'];
    const cleanPronouns = params.pronouns?.trim().slice(0, 32) || undefined;
    const cleanLocation = params.location?.trim().slice(0, 60) || undefined;

    const createPayload: UserProfile = {
      ...userProfile,
      email: '',
      displayName: cleanName,
      username: lower,
      usernameLower: lower,
      bio: params.bio.trim().slice(0, 160),
      styleTags: cleanTags,
      stylePreference: cleanTags[0],
      ...(cleanPronouns ? { pronouns: cleanPronouns } : {}),
      ...(cleanLocation ? { location: cleanLocation } : {}),
      ...(params.photoURL !== undefined ? { photoURL: params.photoURL } : {}),
      ...(params.mediaId !== undefined ? { mediaId: params.mediaId } : {}),
      isAdultConfirmed: true,
      onboardingCompleted: nextCompleted,
      onboardingStep: nextStep,
      updatedAt: now,
    };

    const updatePayload: Partial<UserProfile> = {
      displayName: cleanName,
      username: lower,
      usernameLower: lower,
      bio: params.bio.trim().slice(0, 160),
      styleTags: cleanTags,
      stylePreference: cleanTags[0],
      ...(cleanPronouns !== undefined ? { pronouns: cleanPronouns } : {}),
      ...(cleanLocation !== undefined ? { location: cleanLocation } : {}),
      ...(params.photoURL !== undefined ? { photoURL: params.photoURL } : {}),
      ...(params.mediaId !== undefined ? { mediaId: params.mediaId } : {}),
      isAdultConfirmed: true,
      onboardingCompleted: nextCompleted,
      onboardingStep: nextStep,
    };

    if (!isDemoMode) {
      await claimUsernameAndSaveProfile({
        uid: userProfile.uid,
        newUsernameLower: lower,
        oldUsernameLower: userProfile.usernameLower || undefined,
        profileCreatePayload: createPayload,
        profileUpdatePayload: updatePayload,
      });

      if (params.birthday) {
        await savePrivateUserBirthday(userProfile.uid, params.birthday);
      }

      if (auth.currentUser) {
        const nextHttpPhoto =
          params.photoURL && /^https?:\/\//i.test(params.photoURL)
            ? params.photoURL
            : auth.currentUser.photoURL ?? undefined;
        await updateProfile(auth.currentUser, {
          displayName: cleanName,
          photoURL: nextHttpPhoto,
        }).catch(() => {});
      }
    }

    if (params.mediaId && userProfile.mediaId && params.mediaId !== userProfile.mediaId) {
      deleteImageAsset(userProfile.mediaId).catch(() => {});
    }

    setUserProfile((prev) =>
      prev
        ? {
            ...prev,
            ...updatePayload,
          }
        : prev
    );
    if (nextCompleted) {
      setIsLegacyStep1Only(false);
    }
  };

  const advanceOnboardingStep = async (step: OnboardingStep, markCompleted = false) => {
    if (!userProfile) return;
    const updates: Partial<UserProfile> = {
      onboardingStep: step,
      ...(markCompleted ? { onboardingCompleted: true } : {}),
    };
    if (!isDemoMode && userProfile.usernameLower) {
      await updateUserProfileDoc(userProfile.uid, updates);
    }
    setUserProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    if (markCompleted) {
      setIsLegacyStep1Only(false);
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
    setIsLegacyStep1Only(false);
    setUserProfile({
      ...DEMO_USER_PROFILE,
      onboardingCompleted: true,
      showOnlineStatus: true,
      onlineStatus: true,
      friendsCount: 1,
    });
  };

  const signOutUser = async () => {
    setError(null);
    if (!isDemoMode && userProfile?.uid && userProfile.usernameLower) {
      await updateUserPresence(userProfile.uid, false, false).catch(() => {});
    }
    clearMediaCache();
    localStorage.removeItem(DEMO_SESSION_KEY);
    setIsDemoMode(false);
    setIsLegacyStep1Only(false);
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
    let usernameChanged = false;
    let nextUsernameLower = userProfile.usernameLower;

    if (cleanUpdates.username !== undefined) {
      const err = validateUsername(cleanUpdates.username);
      if (err) throw new Error(err);
      const lower = normalizeUsername(cleanUpdates.username);
      if (lower !== userProfile.usernameLower) {
        usernameChanged = true;
        nextUsernameLower = lower;
        cleanUpdates.username = lower;
        cleanUpdates.usernameLower = lower;
      }
    }

    if (isDemoMode) {
      if (cleanUpdates.mediaId && userProfile.mediaId && cleanUpdates.mediaId !== userProfile.mediaId) {
        deleteImageAsset(userProfile.mediaId).catch(() => {});
      }
      setUserProfile((prev) => (prev ? { ...prev, ...cleanUpdates } : prev));
      if (cleanUpdates.theme) setTheme(cleanUpdates.theme);
      return;
    }

    if (auth.currentUser && (cleanUpdates.displayName !== undefined || cleanUpdates.photoURL !== undefined)) {
      const nextHttpPhoto =
        cleanUpdates.photoURL && /^https?:\/\//i.test(cleanUpdates.photoURL)
          ? cleanUpdates.photoURL
          : auth.currentUser.photoURL ?? undefined;
      await updateProfile(auth.currentUser, {
        displayName: cleanUpdates.displayName ?? auth.currentUser.displayName ?? undefined,
        photoURL: nextHttpPhoto,
      }).catch(() => {});
    }

    const firestorePayload = { ...cleanUpdates };
    delete firestorePayload.email;

    if (usernameChanged) {
      await claimUsernameAndSaveProfile({
        uid: userProfile.uid,
        newUsernameLower: nextUsernameLower,
        oldUsernameLower: userProfile.usernameLower || undefined,
        profileUpdatePayload: firestorePayload,
      });
    } else {
      await updateUserProfileDoc(userProfile.uid, firestorePayload);
    }

    if (cleanUpdates.mediaId && userProfile.mediaId && cleanUpdates.mediaId !== userProfile.mediaId) {
      deleteImageAsset(userProfile.mediaId).catch(() => {});
    }
    setUserProfile((prev) => (prev ? { ...prev, ...cleanUpdates } : prev));
    if (cleanUpdates.theme) setTheme(cleanUpdates.theme);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (isDemoMode) {
      throw new Error('Password cannot be changed in Demo Mode.');
    }
    const hasPasswordProvider = auth.currentUser?.providerData?.some((p) => p.providerId === 'password');
    if (!auth.currentUser || !auth.currentUser.email || !hasPasswordProvider) {
      throw new Error('Password changes only apply to Email/Password accounts.');
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
      localStorage.removeItem('swooosh_demo_social_v3');
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

  const needsOnboarding = Boolean(
    userProfile &&
      !isDemoMode &&
      (userProfile.onboardingCompleted !== true ||
        !userProfile.usernameLower?.trim() ||
        !userProfile.displayName?.trim())
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isDemoMode,
        needsOnboarding,
        isLegacyStep1Only,
        inviteUsername,
        clearInviteUsername,
        error,
        clearError,
        signIn,
        signInWithGoogle,
        signUp,
        saveOnboardingStep1,
        advanceOnboardingStep,
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
