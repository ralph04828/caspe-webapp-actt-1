import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import {
  CLOTHING_CATEGORIES,
  ClothingCategory,
  FIT_VIBE_TAGS,
  NavSection,
  Visibility,
} from '../types';
import { deleteImageAsset, preparePreviewDataUrl, revokeTempUrl, uploadImageAsset } from '../services/storageService';
import { calculateAgeFromBirthday, normalizeUsername, validateUsername } from '../utils/formatters';
import { formatAspectRatioFromDimensions, resolveDisplayAspectRatio } from '../utils/aspectRatio';
import { pickFitReaction } from '../data/fitReactions';
import { AvatarImage } from './AvatarImage';
import { AvatarCropModal } from './AvatarCropModal';
import { GarmentImage } from './GarmentImage';
import { PhotoPickerButton } from './PhotoPickerButton';
import {
  ArrowRight,
  AtSign,
  Bookmark,
  Check,
  CheckCircle2,
  Circle,
  Compass,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  RefreshCw,
  Send,
  Sparkles,
  Sun,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

interface OnboardingFlowProps {
  onNavigate?: (sec: NavSection) => void;
  onToast?: (msg: string, type?: 'success' | 'error') => void;
}

interface Step1Draft {
  displayName?: string;
  username?: string;
  bio?: string;
  styleTags?: string[];
  pronouns?: string;
  location?: string;
  birthday?: string;
  photoURL?: string;
  mediaId?: string;
  isAdultConfirmed?: boolean;
}

interface FitDraft {
  imageUrl?: string;
  thumbUrl?: string;
  mediaId?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  vibes?: string[];
  notSure?: boolean;
  reactionLine?: string;
  reactionTemplate?: string;
}

const CONFETTI_PARTICLES = Array.from({ length: 18 }, (_, idx) => ({
  id: idx,
  left: `${5 + ((idx * 19) % 90)}%`,
  delay: `${(idx % 6) * 80}ms`,
  size: idx % 3 === 0 ? 'w-2.5 h-2.5' : 'w-2 h-2',
}));

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onNavigate, onToast }) => {
  const {
    userProfile,
    isDemoMode,
    isLegacyStep1Only,
    checkUsernameFree,
    saveOnboardingStep1,
    advanceOnboardingStep,
    signOutUser,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addClothing } = useWardrobe();
  const { publishPost, discoverProfiles } = useSocial();

  const uid = userProfile?.uid || 'anon';
  const step1StorageKey = `swooosh_onboarding_step1_${uid}`;
  const fitStorageKey = `swooosh_onboarding_fit_${uid}`;

  // Step 1 form state (hydrated from localStorage draft or userProfile)
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState('');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [photoURL, setPhotoURL] = useState<string | undefined>(undefined);
  const [mediaId, setMediaId] = useState<string | undefined>(undefined);
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingStep1, setSavingStep1] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 3 & Reaction state
  const [fitImageUrl, setFitImageUrl] = useState<string | undefined>(undefined);
  const [fitThumbUrl, setFitThumbUrl] = useState<string | undefined>(undefined);
  const [fitMediaId, setFitMediaId] = useState<string | undefined>(undefined);
  const [fitAspectRatio, setFitAspectRatio] = useState<string | undefined>(undefined);
  const [fitWidth, setFitWidth] = useState<number | undefined>(undefined);
  const [fitHeight, setFitHeight] = useState<number | undefined>(undefined);
  const [fitVibes, setFitVibes] = useState<string[]>([]);
  const [fitNotSure, setFitNotSure] = useState(false);
  const [uploadingFit, setUploadingFit] = useState(false);
  const [fitError, setFitError] = useState<string | null>(null);

  const [reactionLine, setReactionLine] = useState('');
  const [reactionTemplate, setReactionTemplate] = useState<string | undefined>(undefined);
  const [showSparkles, setShowSparkles] = useState(false);

  // Post-reaction inline panels
  const [postMode, setPostMode] = useState<'none' | 'post' | 'wardrobe'>('none');
  const [postVisibility, setPostVisibility] = useState<Visibility>('public');
  const [postCaption, setPostCaption] = useState('');
  const [wardrobeName, setWardrobeName] = useState('');
  const [wardrobeCategory, setWardrobeCategory] = useState<ClothingCategory>('Other');
  const [submittingAction, setSubmittingAction] = useState(false);

  const hydratedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userProfile || hydratedUidRef.current === userProfile.uid) return;
    hydratedUidRef.current = userProfile.uid;

    let draft1: Step1Draft = {};
    try {
      const raw1 = localStorage.getItem(step1StorageKey);
      if (raw1) draft1 = JSON.parse(raw1) as Step1Draft;
    } catch {
      // ignore
    }

    setDisplayName(draft1.displayName ?? userProfile.displayName ?? '');
    setUsername(draft1.username ?? userProfile.username ?? '');
    setBio(draft1.bio ?? userProfile.bio ?? '');
    setStyleTags(draft1.styleTags ?? userProfile.styleTags ?? []);
    setPronouns(draft1.pronouns ?? userProfile.pronouns ?? '');
    setLocation(draft1.location ?? userProfile.location ?? '');
    setBirthday(draft1.birthday ?? '');
    setPhotoURL(draft1.photoURL ?? userProfile.photoURL);
    setMediaId(draft1.mediaId ?? userProfile.mediaId);
    setIsAdultConfirmed(draft1.isAdultConfirmed ?? Boolean(userProfile.isAdultConfirmed));

    try {
      const rawFit = localStorage.getItem(fitStorageKey);
      if (rawFit) {
        const parsedFit = JSON.parse(rawFit) as FitDraft;
        setFitImageUrl(parsedFit.imageUrl);
        setFitThumbUrl(parsedFit.thumbUrl);
        setFitMediaId(parsedFit.mediaId);
        setFitAspectRatio(parsedFit.aspectRatio);
        setFitWidth(parsedFit.width);
        setFitHeight(parsedFit.height);
        setFitVibes(parsedFit.vibes || []);
        setFitNotSure(Boolean(parsedFit.notSure));
        setReactionLine(parsedFit.reactionLine || '');
        setReactionTemplate(parsedFit.reactionTemplate);
      }
    } catch {
      // ignore
    }
  }, [userProfile?.uid]);

  // Persist Step 1 form draft locally so refresh resumes cleanly
  useEffect(() => {
    if (!userProfile || userProfile.onboardingStep !== 1) return;
    try {
      const draft: Step1Draft = {
        displayName,
        username,
        bio,
        styleTags,
        pronouns,
        location,
        birthday,
        photoURL,
        mediaId,
        isAdultConfirmed,
      };
      localStorage.setItem(step1StorageKey, JSON.stringify(draft));
    } catch {
      // ignore quota
    }
  }, [
    userProfile?.uid,
    userProfile?.onboardingStep,
    displayName,
    username,
    bio,
    styleTags,
    pronouns,
    location,
    birthday,
    photoURL,
    mediaId,
    isAdultConfirmed,
  ]);

  // Persist Fit & Reaction draft locally so refresh mid-step-3 or mid-reaction resumes cleanly
  useEffect(() => {
    if (!userProfile) return;
    try {
      const draft: FitDraft = {
        imageUrl: fitImageUrl,
        thumbUrl: fitThumbUrl,
        mediaId: fitMediaId,
        aspectRatio: fitAspectRatio,
        width: fitWidth,
        height: fitHeight,
        vibes: fitVibes,
        notSure: fitNotSure,
        reactionLine,
        reactionTemplate,
      };
      localStorage.setItem(fitStorageKey, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [
    userProfile?.uid,
    fitImageUrl,
    fitThumbUrl,
    fitMediaId,
    fitAspectRatio,
    fitWidth,
    fitHeight,
    fitVibes,
    fitNotSure,
    reactionLine,
    reactionTemplate,
  ]);

  // Live username availability check
  useEffect(() => {
    const clean = normalizeUsername(username);
    if (!clean) {
      setUsernameStatus('idle');
      return;
    }
    if (validateUsername(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    if (userProfile?.usernameLower && clean === userProfile.usernameLower) {
      setUsernameStatus('free');
      return;
    }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const free = await checkUsernameFree(clean);
        setUsernameStatus(free ? 'free' : 'taken');
      } catch {
        setUsernameStatus('idle');
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [username, userProfile?.usernameLower]);

  // Stop reaction sparkles automatically after ~1.8s
  useEffect(() => {
    if (userProfile?.onboardingStep === 'reaction') {
      setShowSparkles(true);
      const t = setTimeout(() => setShowSparkles(false), 1850);
      return () => clearTimeout(t);
    }
    setShowSparkles(false);
  }, [userProfile?.onboardingStep]);

  const birthdayAge = useMemo(() => (birthday ? calculateAgeFromBirthday(birthday) : null), [birthday]);
  const birthdayTooYoung = birthday !== '' && birthdayAge !== null && birthdayAge < 13;
  const ageConfirmed = birthday !== '' ? birthdayAge !== null && birthdayAge >= 13 : isAdultConfirmed;

  const isStep1Valid = useMemo(() => {
    const cleanName = displayName.trim();
    const cleanUser = normalizeUsername(username);
    return (
      cleanName.length >= 1 &&
      !validateUsername(cleanUser) &&
      usernameStatus === 'free' &&
      ageConfirmed &&
      !birthdayTooYoung
    );
  }, [displayName, username, usernameStatus, ageConfirmed, birthdayTooYoung]);

  if (!userProfile) return null;

  const currentStep = userProfile.onboardingStep || 1;
  const stepNumber = currentStep === 1 ? 1 : currentStep === 2 ? 2 : 3;

  const clearOnboardingDrafts = () => {
    try {
      localStorage.removeItem(step1StorageKey);
      localStorage.removeItem(fitStorageKey);
    } catch {
      // ignore
    }
  };

  const finishAndGo = async (target: NavSection) => {
    clearOnboardingDrafts();
    await advanceOnboardingStep('friends', true);
    onNavigate?.(target);
    onToast?.('Welcome to SWOOOSH! Your profile is live.');
  };

  const handleAvatarFilePicked = async (file: File) => {
    setStep1Error(null);
    const previewUrl = await preparePreviewDataUrl(file);
    setCropSourceUrl(previewUrl);
  };

  const handleCropConfirmed = async (croppedDataUrl: string) => {
    setUploadingAvatar(true);
    setStep1Error(null);
    try {
      const uploaded = await uploadImageAsset(croppedDataUrl, userProfile.uid, 'public', isDemoMode);
      if (mediaId && mediaId !== uploaded.mediaId) {
        deleteImageAsset(mediaId).catch(() => {});
      }
      setPhotoURL(uploaded.thumbUrl);
      setMediaId(uploaded.mediaId);
      setCropSourceUrl(null);
    } catch (err: any) {
      setStep1Error(err?.message || 'Could not save cropped profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    if (birthdayTooYoung) {
      setStep1Error('You must be at least 13 years old to join SWOOOSH.');
      return;
    }
    if (!ageConfirmed) {
      setStep1Error('Please confirm you are 13 or older (or enter your birthday).');
      return;
    }
    if (usernameStatus === 'taken') {
      setStep1Error(`@${normalizeUsername(username)} is already taken.`);
      return;
    }
    if (!isStep1Valid) {
      setStep1Error('Please complete your display name and a valid available @username.');
      return;
    }

    setSavingStep1(true);
    try {
      await saveOnboardingStep1({
        displayName,
        username,
        bio,
        styleTags,
        pronouns,
        location,
        birthday: birthday || undefined,
        photoURL,
        mediaId,
        isAdultConfirmed: ageConfirmed,
      });
      if (isLegacyStep1Only) {
        clearOnboardingDrafts();
        onToast?.('Profile updated! Welcome back.');
      }
    } catch (err: any) {
      setStep1Error(err?.message || 'Could not save your profile. Please try again.');
    } finally {
      setSavingStep1(false);
    }
  };

  const handleFitPhotoPicked = async (file: File) => {
    setFitError(null);
    setUploadingFit(true);
    try {
      const uploaded = await uploadImageAsset(file, userProfile.uid, 'public', isDemoMode);
      if (fitMediaId && fitMediaId !== uploaded.mediaId) {
        deleteImageAsset(fitMediaId).catch(() => {});
      }
      setFitImageUrl(uploaded.imageUrl);
      setFitThumbUrl(uploaded.thumbUrl);
      setFitMediaId(uploaded.mediaId);
      setFitWidth(uploaded.width);
      setFitHeight(uploaded.height);
      setFitAspectRatio(
        formatAspectRatioFromDimensions(uploaded.width, uploaded.height, { clampToFeed: true })
      );
    } finally {
      setUploadingFit(false);
    }
  };

  const toggleFitVibe = (tag: string) => {
    setFitNotSure(false);
    setFitVibes((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 2) return [prev[1], tag];
      return [...prev, tag];
    });
  };

  const handleShowMyFit = async () => {
    if (!fitImageUrl) return;
    const chosenVibes = fitNotSure ? [] : fitVibes;
    const picked = pickFitReaction(chosenVibes, userProfile.displayName || displayName, reactionTemplate);
    setReactionLine(picked.line);
    setReactionTemplate(picked.template);
    setPostMode('none');
    await advanceOnboardingStep('reaction', false);
  };

  const handlePublishFirstFit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fitImageUrl) return;
    setSubmittingAction(true);
    setFitError(null);
    try {
      const tagsToUse = fitNotSure || fitVibes.length === 0 ? ['OOTD'] : fitVibes;
      const defaultCap =
        postCaption.trim() ||
        (fitVibes.length > 0 ? `First fit check — ${fitVibes.join(' · ')}` : 'First fit check on SWOOOSH.');
      await publishPost({
        postType: 'ootd',
        caption: defaultCap,
        visibility: postVisibility,
        allowRemix: true,
        commentPolicy: 'everyone',
        wardrobe: [],
        mediaUrl: fitImageUrl,
        thumbUrl: fitThumbUrl,
        mediaId: fitMediaId,
        aspectRatio: fitAspectRatio,
        width: fitWidth,
        height: fitHeight,
        altText: `${userProfile.displayName}'s first fit on SWOOOSH`,
        styleTags: tagsToUse,
      });
      await advanceOnboardingStep('friends', false);
      onToast?.('Your first OOTD fit is live!');
    } catch (err: any) {
      setFitError(err?.message || 'Could not post your fit.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveFitToWardrobe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fitImageUrl) return;
    const cleanItemName = wardrobeName.trim() || 'First SWOOOSH Fit';
    setSubmittingAction(true);
    setFitError(null);
    try {
      await addClothing({
        name: cleanItemName,
        category: wardrobeCategory,
        brand: '',
        color: '',
        size: '',
        seasons: ['All-Season'],
        styleTags: fitVibes.length > 0 ? fitVibes : ['Casual'],
        altText: cleanItemName,
        visibility: 'private',
        laundryStatus: 'clean',
        wearCount: 0,
        imageUrl: fitImageUrl,
        thumbUrl: fitThumbUrl,
        mediaId: fitMediaId,
      });
      await advanceOnboardingStep('friends', false);
      onToast?.(`Saved "${cleanItemName}" privately to your wardrobe!`);
    } catch (err: any) {
      setFitError(err?.message || 'Could not save fit to wardrobe.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const suggestedCreators = discoverProfiles
    .filter((p) => p.uid !== userProfile.uid && p.isPublic !== false)
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] flex flex-col">
      {/* Top Onboarding Header */}
      <header className="w-full px-5 sm:px-8 py-4 border-b border-[#d4cfc5] dark:border-[#404040] mica-surface flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight uppercase">
            SWOOOSH
          </span>
          {!isLegacyStep1Only && currentStep !== 'friends' && (
            <span className="px-2.5 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-[11px] font-mono-num font-semibold">
              Step {stepNumber} of 3
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle dark and light mode"
            className="min-h-[42px] px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <button
            type="button"
            onClick={signOutUser}
            className="min-h-[42px] px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-medium flex items-center gap-1.5 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* 3-Step Progress Bar */}
      {!isLegacyStep1Only && currentStep !== 'friends' && (
        <div className="w-full max-w-5xl mx-auto px-5 sm:px-8 pt-4">
          <div className="grid grid-cols-3 gap-2" aria-label={`Onboarding progress: Step ${stepNumber} of 3`}>
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-colors ${
                  step <= stepNumber
                    ? 'bg-[#171717] dark:bg-[#e5e1da]'
                    : 'bg-[#d4cfc5] dark:bg-[#303030]'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-8 py-6 sm:py-10 flex flex-col justify-center">
        {/* ==================== STEP 1 OF 3: PROFILE SETUP ==================== */}
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            <form
              onSubmit={handleStep1Submit}
              className="lg:col-span-7 p-5 sm:p-7 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm space-y-5"
            >
              <div>
                <p className="text-[11px] font-mono-num uppercase tracking-[0.18em] text-[#4e4c46] dark:text-[#c2bfb8]">
                  {isLegacyStep1Only ? 'Complete Your Profile' : 'Step 1 of 3 · Set up your profile'}
                </p>
                <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight mt-1">
                  Claim your SWOOOSH identity
                </h1>
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] mt-1">
                  Set your display name, unique @username, and style vibes so friends can recognize you.
                </p>
              </div>

              {step1Error && (
                <div
                  role="alert"
                  className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs"
                >
                  {step1Error}
                </div>
              )}

              {/* Profile Photo Upload + Circle Crop */}
              <div className="flex flex-wrap items-center gap-4">
                <AvatarImage
                  src={photoURL}
                  mediaId={mediaId}
                  name={displayName || username || 'S'}
                  sizeClass="w-20 h-20"
                  textSizeClass="text-2xl"
                />
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
                    Profile Picture (Optional)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <PhotoPickerButton
                      label="Choose Photo"
                      busyLabel="Saving..."
                      busy={uploadingAvatar}
                      className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
                      onFileSelected={handleAvatarFilePicked}
                      onError={(msg) => setStep1Error(msg)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="onboard-display-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1"
                  >
                    Display Name *
                  </label>
                  <input
                    id="onboard-display-name"
                    type="text"
                    required
                    maxLength={80}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Jordan Blake"
                    className="w-full px-3.5 py-2.5 min-h-[44px] rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                  {displayName.trim().length === 0 && (
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] mt-1">
                      Required — shown on your profile and posts.
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="onboard-username"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]"
                    >
                      @Username *
                    </label>
                    {usernameStatus === 'checking' && (
                      <span className="text-[11px] flex items-center gap-1 text-[#4e4c46] dark:text-[#c2bfb8]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking
                      </span>
                    )}
                    {usernameStatus === 'free' && (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Available
                      </span>
                    )}
                    {usernameStatus === 'taken' && (
                      <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                        Already taken
                      </span>
                    )}
                    {usernameStatus === 'invalid' && (
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                        Invalid format
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <AtSign className="w-4 h-4 absolute left-3 top-3.5 text-[#4e4c46] dark:text-[#c2bfb8]" />
                    <input
                      id="onboard-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                      placeholder="jordan.fits"
                      className="w-full pl-9 pr-3.5 py-2.5 min-h-[44px] rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                    />
                  </div>
                  <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] mt-1">
                    Allowed: 3–24 chars (a–z, 0–9, dots ., underscores _)
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="onboard-bio"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]"
                  >
                    Bio (Optional)
                  </label>
                  <span className="text-[11px] font-mono-num text-[#4e4c46] dark:text-[#c2bfb8]">
                    {bio.length}/160
                  </span>
                </div>
                <textarea
                  id="onboard-bio"
                  rows={2}
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Oversized hoodies, vintage denim, and weekend thrifts."
                  className="w-full px-3.5 py-2.5 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-2">
                  Style Tags (Optional)
                </p>
                <div className="flex flex-wrap gap-2">
                  {FIT_VIBE_TAGS.map((tag) => {
                    const active = styleTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setStyleTags((prev) =>
                            prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
                          )
                        }
                        className={`px-3 py-2 min-h-[40px] rounded-chip text-xs font-semibold border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                            : 'border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
                <div>
                  <label
                    htmlFor="onboard-pronouns"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1"
                  >
                    Pronouns (Optional)
                  </label>
                  <input
                    id="onboard-pronouns"
                    type="text"
                    maxLength={32}
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    placeholder="they/them"
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="onboard-location"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1"
                  >
                    City or Country (Optional)
                  </label>
                  <input
                    id="onboard-location"
                    type="text"
                    maxLength={60}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Manila, PH"
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="onboard-birthday"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1"
                  >
                    Birthday (Optional · Private)
                  </label>
                  <input
                    id="onboard-birthday"
                    type="date"
                    value={birthday}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
                  />
                </div>
              </div>

              {birthdayTooYoung ? (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-semibold">
                  You must be at least 13 years old to create a SWOOOSH account.
                </p>
              ) : birthday ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  13+ verified from your birthday. Your birthday is private and never shown publicly.
                </p>
              ) : (
                <label className="flex items-start gap-2.5 text-xs text-[#4e4c46] dark:text-[#c2bfb8] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAdultConfirmed}
                    onChange={(e) => setIsAdultConfirmed(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-[#171717] dark:accent-[#e5e1da]"
                  />
                  <span>
                    I confirm I am 13 or older. (Or enter your birthday above — it stays strictly private.)
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={!isStep1Valid || savingStep1 || uploadingAvatar}
                className="w-full py-3 min-h-[48px] px-5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                {savingStep1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>
                  {savingStep1
                    ? 'Saving profile...'
                    : isLegacyStep1Only
                    ? 'Save & Enter SWOOOSH'
                    : 'Continue'}
                </span>
              </button>
            </form>

            {/* Live Profile Card Preview */}
            <aside className="lg:col-span-5 space-y-3 lg:sticky lg:top-8">
              <p className="text-[11px] font-mono-num uppercase tracking-[0.18em] text-[#4e4c46] dark:text-[#c2bfb8]">
                Live Profile Preview
              </p>
              <div className="p-6 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-lg space-y-4">
                <div className="flex items-center gap-4">
                  <AvatarImage
                    src={photoURL}
                    mediaId={mediaId}
                    name={displayName || username || 'S'}
                    sizeClass="w-16 h-16"
                    textSizeClass="text-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display font-bold text-xl truncate">
                      {displayName.trim() || 'Your Name'}
                    </h2>
                    <p className="text-xs font-mono-num text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                      @{normalizeUsername(username) || 'your.handle'}
                      {pronouns.trim() ? ` · ${pronouns.trim()}` : ''}
                    </p>
                    {location.trim() && (
                      <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8] inline-flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span>{location.trim()}</span>
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#171717] dark:text-[#e5e1da] leading-relaxed min-h-[2.25rem]">
                  {bio.trim() || 'Your style bio appears here as you type.'}
                </p>

                {styleTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {styleTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-[11px] font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#d4cfc5] dark:border-[#404040] text-center text-xs">
                  <div>
                    <p className="font-mono-num font-bold">0</p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">Fits</p>
                  </div>
                  <div>
                    <p className="font-mono-num font-bold">0</p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">Friends</p>
                  </div>
                  <div>
                    <p className="font-mono-num font-bold">0</p>
                    <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">Followers</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ==================== STEP 2 OF 3: WELCOME SCREEN ==================== */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto w-full p-7 sm:p-10 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-xl space-y-6 text-center">
            <p className="text-[11px] font-mono-num uppercase tracking-[0.2em] text-[#4e4c46] dark:text-[#c2bfb8]">
              Step 2 of 3 · Welcome
            </p>
            <h1 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight leading-[1.08] text-balance">
              Welcome to SWOOOSH, {userProfile.displayName}.
            </h1>
            <p className="font-display font-bold text-lg sm:text-xl text-[#4e4c46] dark:text-[#c2bfb8]">
              Your wardrobe. Your style. Your people.
            </p>
            <p className="text-sm text-[#4e4c46] dark:text-[#c2bfb8] max-w-md mx-auto leading-relaxed">
              Share fits, build a digital wardrobe, plan outfits ahead, and add friends.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => advanceOnboardingStep(3, false)}
                className="w-full sm:w-auto px-7 py-3.5 min-h-[48px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
              >
                <span>Show us your fit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => advanceOnboardingStep('friends', false)}
                className="w-full sm:w-auto px-5 py-3.5 min-h-[48px] rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ==================== STEP 3 OF 3: SHOW US YOUR FIT ==================== */}
        {currentStep === 3 && (
          <div className="max-w-xl mx-auto w-full p-6 sm:p-8 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-xl space-y-5">
            <div>
              <p className="text-[11px] font-mono-num uppercase tracking-[0.18em] text-[#4e4c46] dark:text-[#c2bfb8]">
                Step 3 of 3 · Show us your fit
              </p>
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight mt-1">
                Drop a fit photo
              </h1>
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] mt-1">
                Snap a mirror fit or pick one from your gallery, pick the vibe, and get started.
              </p>
            </div>

            {fitError && (
              <div
                role="alert"
                className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs"
              >
                {fitError}
              </div>
            )}

            {fitImageUrl ? (
              <div className="space-y-3">
                <div
                  className="relative w-full mx-auto rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#171717]"
                  style={
                    resolveDisplayAspectRatio({
                      aspectRatio: fitAspectRatio,
                      width: fitWidth,
                      height: fitHeight,
                      fallbackRatio: 4 / 5,
                      maxHeightCss: '24rem',
                    }).frameStyle
                  }
                >
                  <GarmentImage
                    src={fitImageUrl}
                    mediaId={fitMediaId}
                    alt="Uploaded fit preview"
                    className="w-full h-full object-cover"
                    onImageLoad={(dims) => {
                      if (!fitWidth || !fitHeight) {
                        setFitWidth(dims.naturalWidth);
                        setFitHeight(dims.naturalHeight);
                        setFitAspectRatio(
                          formatAspectRatioFromDimensions(dims.naturalWidth, dims.naturalHeight, { clampToFeed: true })
                        );
                      }
                    }}
                  />
                </div>
                <div className="flex justify-center gap-2">
                  <PhotoPickerButton
                    label="Replace Photo"
                    busyLabel="Uploading..."
                    busy={uploadingFit}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    className="px-4 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
                    onFileSelected={handleFitPhotoPicked}
                    onError={(msg) => setFitError(msg)}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-card border-2 border-dashed border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/60 dark:bg-[#171717]/60 text-center space-y-4">
                <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                  Photos are compressed in-browser to WebP so they load fast across all devices.
                </p>
                <div className="flex justify-center">
                  <PhotoPickerButton
                    label="Choose Photo"
                    busyLabel="Compressing..."
                    busy={uploadingFit}
                    className="px-5 py-3 min-h-[46px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                    onFileSelected={handleFitPhotoPicked}
                    onError={(msg) => setFitError(msg)}
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-2">
                Pick 1 or 2 vibes for this fit
              </p>
              <div className="flex flex-wrap gap-2">
                {FIT_VIBE_TAGS.map((tag) => {
                  const active = !fitNotSure && fitVibes.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleFitVibe(tag)}
                      className={`px-3 py-2 min-h-[42px] rounded-chip text-xs font-semibold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                          : 'border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] hover:bg-[#eae7e0] dark:hover:bg-[#303030]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setFitNotSure((prev) => !prev);
                    setFitVibes([]);
                  }}
                  className={`px-3 py-2 min-h-[42px] rounded-chip text-xs font-semibold border transition-colors cursor-pointer ${
                    fitNotSure
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                      : 'border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717]'
                  }`}
                >
                  Not sure
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                disabled={!fitImageUrl || uploadingFit}
                onClick={handleShowMyFit}
                className="flex-1 py-3 min-h-[48px] px-5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Show my fit</span>
              </button>
              <button
                type="button"
                onClick={() => advanceOnboardingStep('friends', false)}
                className="py-3 min-h-[48px] px-5 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ==================== FULL-SCREEN FIT REACTION ==================== */}
        {currentStep === 'reaction' && (
          <div
            className="fixed inset-0 z-50 bg-[#f5f4f0] dark:bg-[#171717] text-[#171717] dark:text-[#e5e1da] overflow-y-auto flex items-center justify-center p-5 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fit-reaction-heading"
          >
            {/* Subtle temporary confetti/sparkle burst (auto-stops after ~1.8s, reduced-motion safe) */}
            {showSparkles && (
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-x-0 top-0 h-64 overflow-hidden z-10"
              >
                {CONFETTI_PARTICLES.map((p) => (
                  <span
                    key={p.id}
                    style={{ left: p.left, animationDelay: p.delay }}
                    className={`absolute top-6 ${p.size} rounded-full bg-[#171717] dark:bg-[#e5e1da] opacity-0 animate-swooosh-confetti`}
                  />
                ))}
              </div>
            )}

            <div className="relative z-20 max-w-xl w-full p-6 sm:p-8 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-2xl space-y-5 animate-swooosh-pop">
              {fitImageUrl && (
                <div
                  className="w-full mx-auto rounded-card overflow-hidden border border-[#d4cfc5] dark:border-[#404040] bg-[#171717]"
                  style={
                    resolveDisplayAspectRatio({
                      aspectRatio: fitAspectRatio,
                      width: fitWidth,
                      height: fitHeight,
                      fallbackRatio: 4 / 5,
                      maxHeightCss: '18rem',
                    }).frameStyle
                  }
                >
                  <GarmentImage
                    src={fitImageUrl}
                    mediaId={fitMediaId}
                    alt={`${userProfile.displayName}'s uploaded fit`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-1.5">
                {(fitNotSure || fitVibes.length === 0 ? ['Fit Check'] : fitVibes).map((v) => (
                  <span
                    key={v}
                    className="px-2.5 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] text-[11px] font-semibold"
                  >
                    {v}
                  </span>
                ))}
              </div>

              <div role="status" aria-live="polite" className="text-center space-y-2">
                <h2
                  id="fit-reaction-heading"
                  className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-tight text-balance"
                >
                  {reactionLine ||
                    pickFitReaction(fitNotSure ? [] : fitVibes, userProfile.displayName).line}
                </h2>
              </div>

              {fitError && (
                <div
                  role="alert"
                  className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs"
                >
                  {fitError}
                </div>
              )}

              {postMode === 'post' && (
                <form
                  onSubmit={handlePublishFirstFit}
                  className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">Post my first fit</span>
                    <button
                      type="button"
                      onClick={() => setPostMode('none')}
                      className="text-xs underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={220}
                    value={postCaption}
                    onChange={(e) => setPostCaption(e.target.value)}
                    placeholder="Add a quick caption (optional)..."
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs"
                  />
                  <div>
                    <p className="text-[11px] font-semibold text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
                      Who can see this post?
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['public', 'friends', 'private'] as const).map((vis) => (
                        <button
                          key={vis}
                          type="button"
                          onClick={() => setPostVisibility(vis)}
                          className={`py-2 min-h-[42px] rounded-control border text-xs font-semibold capitalize cursor-pointer ${
                            postVisibility === vis
                              ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] border-[#171717] dark:border-[#e5e1da]'
                              : 'border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424]'
                          }`}
                        >
                          {vis}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="w-full py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingAction ? 'Posting...' : 'Publish First Fit'}</span>
                  </button>
                </form>
              )}

              {postMode === 'wardrobe' && (
                <form
                  onSubmit={handleSaveFitToWardrobe}
                  className="p-4 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Save privately to my wardrobe
                    </span>
                    <button
                      type="button"
                      onClick={() => setPostMode('none')}
                      className="text-xs underline cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={wardrobeName}
                    onChange={(e) => setWardrobeName(e.target.value)}
                    placeholder="Name this piece or fit (e.g. Heavyweight Hoodie Fit)"
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs"
                  />
                  <select
                    value={wardrobeCategory}
                    onChange={(e) => setWardrobeCategory(e.target.value as ClothingCategory)}
                    className="w-full px-3 py-2.5 min-h-[44px] rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] text-xs"
                  >
                    {CLOTHING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="w-full py-2.5 min-h-[44px] rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{submittingAction ? 'Saving...' : 'Save to Wardrobe (Private)'}</span>
                  </button>
                </form>
              )}

              {postMode === 'none' && (
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPostMode('post')}
                    className="w-full py-3 min-h-[48px] px-4 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Post my first fit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostMode('wardrobe')}
                    className="w-full py-3 min-h-[48px] px-4 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>Save to my wardrobe</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => finishAndGo('home')}
                    className="w-full py-2.5 min-h-[44px] text-xs font-semibold text-[#4e4c46] dark:text-[#c2bfb8] hover:underline cursor-pointer"
                  >
                    Skip, take me to Home
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== FINAL CARD: FIND FRIENDS ==================== */}
        {currentStep === 'friends' && (
          <div className="max-w-lg mx-auto w-full p-6 sm:p-8 rounded-modal border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-full bg-[#eae7e0] dark:bg-[#303030] flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                Find your people
              </h2>
              <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
                Connect with friends to see their fits, reply to MyDay stories, and message 1-on-1.
              </p>
            </div>

            {suggestedCreators.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5 text-left">
                {suggestedCreators.map((person) => (
                  <div
                    key={person.uid}
                    className="p-2.5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0] dark:bg-[#171717] flex items-center gap-2.5"
                  >
                    <AvatarImage
                      src={person.photoURL}
                      mediaId={person.mediaId}
                      name={person.displayName}
                      sizeClass="w-9 h-9"
                      textSizeClass="text-xs"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{person.displayName}</p>
                      <p className="text-[10px] text-[#4e4c46] dark:text-[#c2bfb8] truncate">
                        @{person.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => finishAndGo('people')}
                className="flex-1 py-3 min-h-[48px] px-5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Find Friends</span>
              </button>
              <button
                type="button"
                onClick={() => finishAndGo('home')}
                className="py-3 min-h-[48px] px-5 rounded-full border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
              >
                Go to Home
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Circle Cropper Dialog */}
      {cropSourceUrl && (
        <AvatarCropModal
          sourceUrl={cropSourceUrl}
          onCancel={() => {
            revokeTempUrl(cropSourceUrl);
            setCropSourceUrl(null);
          }}
          onConfirm={handleCropConfirmed}
        />
      )}
    </div>
  );
};

export const OnboardingModal = OnboardingFlow;

export const OnboardingChecklistCard: React.FC<{
  onNavigate: (sec: NavSection) => void;
}> = ({ onNavigate }) => {
  const { userProfile, updateAccountProfile } = useAuth();
  const { myPosts, friendIds, outgoingFollows } = useSocial();

  if (!userProfile || userProfile.checklistDismissed) return null;

  const hasPhoto = Boolean(userProfile.photoURL || userProfile.mediaId);
  const hasOotd = myPosts.length > 0;
  const connectionsCount = new Set([
    ...friendIds,
    ...outgoingFollows.filter((f) => f.status === 'accepted').map((f) => f.targetId),
  ]).size;
  const hasThreeConnections = connectionsCount >= 3;

  if (hasPhoto && hasOotd && hasThreeConnections) return null;

  const steps = [
    {
      id: 'photo',
      done: hasPhoto,
      label: 'Add a profile photo',
      actionLabel: 'Settings',
      onClick: () => onNavigate('settings'),
      Icon: Check,
    },
    {
      id: 'ootd',
      done: hasOotd,
      label: 'Post your first OOTD',
      actionLabel: 'Post OOTD',
      onClick: () => onNavigate('ootd'),
      Icon: Sparkles,
    },
    {
      id: 'friends',
      done: hasThreeConnections,
      label: `Add 3 friends or follow 3 people (${connectionsCount}/3)`,
      actionLabel: 'Find People',
      onClick: () => onNavigate('people'),
      Icon: Users,
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <section
      aria-label="Getting started checklist"
      className="p-4 sm:p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] shadow-sm space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono-num uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
            Getting Started · {completed}/3
          </p>
          <h2 className="font-display font-bold text-base mt-0.5">
            Complete your SWOOOSH setup
          </h2>
        </div>
        <button
          type="button"
          onClick={() => updateAccountProfile({ checklistDismissed: true }).catch(() => {})}
          aria-label="Dismiss checklist"
          className="p-2 rounded-control text-[#4e4c46] dark:text-[#c2bfb8] hover:bg-[#eae7e0] dark:hover:bg-[#303030] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className="p-3 rounded-control border border-[#d4cfc5] dark:border-[#404040] bg-[#f5f4f0]/70 dark:bg-[#171717]/70 flex flex-col justify-between gap-2.5"
          >
            <div className="flex items-start gap-2">
              {step.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-[#4e4c46] dark:text-[#c2bfb8] shrink-0 mt-0.5" />
              )}
              <span className={`text-xs font-medium ${step.done ? 'line-through opacity-70' : ''}`}>
                {step.label}
              </span>
            </div>
            {!step.done && (
              <button
                type="button"
                onClick={step.onClick}
                className="w-full py-2 min-h-[40px] px-3 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{step.actionLabel}</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
