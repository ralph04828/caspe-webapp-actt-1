import React, { useEffect, useState } from 'react';
import { FIT_VIBE_TAGS, Visibility } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useWardrobe } from '../context/WardrobeContext';
import { useSocial } from '../context/SocialContext';
import { preparePreviewDataUrl, resolveMediaRef, uploadImageAsset } from '../services/storageService';
import { normalizeUsername } from '../utils/formatters';
import { AvatarImage } from './AvatarImage';
import { PhotoEditorModal, createDefaultCropState } from './PhotoEditorModal';
import { PhotoPickerButton } from './PhotoPickerButton';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertCircle, Copy, Download, Loader2, Lock, RotateCw, Save, Shield, Trash2, Upload } from 'lucide-react';

interface SettingsPageProps {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onToast }) => {
  const { userProfile, isDemoMode, updateAccountProfile, changePassword, deleteAccount } = useAuth();
  const { theme, setTheme } = useTheme();
  const { wardrobe, outfits, wishlist, schedules, wearLogs } = useWardrobe();
  const { blockedEdges, mutedEdges, toggleBlock, toggleMute } = useSocial();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [username, setUsername] = useState(userProfile?.username || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [pronouns, setPronouns] = useState(userProfile?.pronouns || '');
  const [location, setLocation] = useState(userProfile?.location || '');
  const [styleTags, setStyleTags] = useState<string[]>(userProfile?.styleTags || ['Streetwear']);
  const [isPublic, setIsPublic] = useState(userProfile?.isPublic !== false);
  const [defaultItemVis, setDefaultItemVis] = useState<Visibility>(
    userProfile?.defaultItemVisibility || 'public'
  );
  const [defaultOutfitVis, setDefaultOutfitVis] = useState<Visibility>(
    userProfile?.defaultOutfitVisibility || 'public'
  );
  const [autoDirtyOnWear, setAutoDirtyOnWear] = useState(Boolean(userProfile?.autoDirtyOnWear));
  const [showOnlineStatus, setShowOnlineStatus] = useState(userProfile?.showOnlineStatus !== false);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingExistingAvatar, setLoadingExistingAvatar] = useState(false);
  const [avatarCropSource, setAvatarCropSource] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!userProfile) return;
    setDisplayName(userProfile.displayName || '');
    setUsername(userProfile.username || '');
    setBio(userProfile.bio || '');
    setPronouns(userProfile.pronouns || '');
    setLocation(userProfile.location || '');
    setStyleTags(userProfile.styleTags || ['Streetwear']);
    setIsPublic(userProfile.isPublic !== false);
    setDefaultItemVis(userProfile.defaultItemVisibility || 'public');
    setDefaultOutfitVis(userProfile.defaultOutfitVisibility || 'public');
    setAutoDirtyOnWear(Boolean(userProfile.autoDirtyOnWear));
    setShowOnlineStatus(userProfile.showOnlineStatus !== false);
  }, [
    userProfile?.uid,
    userProfile?.displayName,
    userProfile?.username,
    userProfile?.bio,
    userProfile?.pronouns,
    userProfile?.location,
    userProfile?.isPublic,
    userProfile?.defaultItemVisibility,
    userProfile?.defaultOutfitVisibility,
    userProfile?.autoDirtyOnWear,
    userProfile?.showOnlineStatus,
  ]);

  const handleAvatarFileSelected = async (file: File) => {
    if (!userProfile) return;
    setAvatarError(null);
    try {
      const preview = await preparePreviewDataUrl(file);
      setAvatarCropSource(preview);
    } catch (err: any) {
      const msg = err?.message || 'Could not load selected photo.';
      console.error('Avatar preview load failed:', err);
      setAvatarError(msg);
      onToast(msg, 'error');
    }
  };

  const handleRotateExistingAvatar = async () => {
    if (!userProfile) return;
    setAvatarError(null);
    setLoadingExistingAvatar(true);
    try {
      const resolved = await resolveMediaRef(userProfile.photoURL, userProfile.mediaId);
      if (!resolved.url) {
        throw new Error(resolved.reason || 'Current profile photo could not be loaded for editing.');
      }
      setAvatarCropSource(resolved.url);
    } catch (err: any) {
      const msg = err?.message || 'Could not open profile photo editor.';
      console.error('Load existing avatar for rotation failed:', err);
      setAvatarError(msg);
      onToast(msg, 'error');
    } finally {
      setLoadingExistingAvatar(false);
    }
  };

  const handleSaveCroppedAvatar = async (croppedDataUrl: string) => {
    if (!userProfile) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const uploaded = await uploadImageAsset(croppedDataUrl, userProfile.uid, 'public', isDemoMode);
      await updateAccountProfile({ photoURL: uploaded.thumbUrl, mediaId: uploaded.mediaId });
      setAvatarCropSource(null);
      onToast('Profile photo updated.');
    } catch (err: any) {
      const msg = err?.message || 'Could not update photo.';
      console.error('Profile photo upload failed:', err);
      setAvatarError(msg);
      onToast(msg, 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileError(null);
    try {
      const normalizedNextUsername = normalizeUsername(username);
      const updates: Parameters<typeof updateAccountProfile>[0] = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        pronouns: pronouns.trim(),
        location: location.trim(),
        styleTags,
        isPublic,
        defaultItemVisibility: defaultItemVis,
        defaultOutfitVisibility: defaultOutfitVis,
        autoDirtyOnWear,
        showOnlineStatus,
      };
      if (normalizedNextUsername && normalizedNextUsername !== userProfile?.usernameLower) {
        updates.username = normalizedNextUsername;
      }
      await updateAccountProfile(updates);
      onToast('Profile and privacy settings saved.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to update settings.';
      console.error('Profile settings save failed:', err);
      setProfileError(msg);
      onToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: {
        displayName: userProfile?.displayName,
        username: userProfile?.username,
        bio: userProfile?.bio,
        styleTags: userProfile?.styleTags,
      },
      wardrobe,
      outfits,
      wishlist,
      schedules,
      wearLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swooosh-export-${userProfile?.username || 'member'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onToast('Exported your SWOOOSH data as JSON.');
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changePassword(currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      onToast('Password updated.');
    } catch (err: any) {
      const msg = err?.message || 'Password update failed.';
      console.error('Password update failed:', err);
      onToast(msg, 'error');
    }
  };

  return (
    <ErrorBoundary title="Settings ran into an issue">
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings & Privacy</h1>
        <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
          Manage your profile, invite link, online presence, visibility defaults, blocked/muted users, and data.
        </p>
      </div>

      {/* Invite Link Card */}
      <section className="p-5 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display font-bold text-sm">Invite Friends to SWOOOSH</h2>
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8] truncate">
            {`${window.location.origin}/?u=${userProfile?.username || 'member'}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/?u=${userProfile?.username || 'member'}`);
            onToast('Invite link copied!');
          }}
          className="px-4 py-2 min-h-[42px] rounded-control bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy invite link</span>
        </button>
      </section>

      {/* Profile & Privacy Form */}
      <form
        onSubmit={handleSaveProfile}
        className="p-6 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4"
      >
        {avatarError && (
          <div
            role="alert"
            className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{avatarError}</span>
          </div>
        )}

        {profileError && (
          <div
            role="alert"
            className="p-3 rounded-control border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{profileError}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AvatarImage
              src={userProfile?.photoURL}
              mediaId={userProfile?.mediaId}
              name={userProfile?.displayName || userProfile?.username || 'S'}
              sizeClass="w-12 h-12"
              textSizeClass="text-base"
            />
            <div>
              <h2 className="font-display font-bold text-base">Profile & Visibility</h2>
              <p className="text-[11px] text-[#4e4c46] dark:text-[#c2bfb8]">
                Avatar is cropped, compressed to WebP &amp; synced across devices.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(userProfile?.photoURL || userProfile?.mediaId) && (
              <button
                type="button"
                disabled={loadingExistingAvatar || uploadingAvatar}
                onClick={handleRotateExistingAvatar}
                className="px-3 py-1.5 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030] disabled:opacity-50"
              >
                {loadingExistingAvatar ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
                <span>Rotate / Crop</span>
              </button>
            )}
            <PhotoPickerButton
              label="Change Avatar"
              busyLabel="Preparing..."
              busy={uploadingAvatar}
              icon={<Upload className="w-3.5 h-3.5" />}
              className="px-3 py-1.5 min-h-[40px] rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#eae7e0] dark:hover:bg-[#303030]"
              onFileSelected={handleAvatarFileSelected}
              onError={(msg) => {
                setAvatarError(msg);
                onToast(msg, 'error');
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
              @Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
              Pronouns (Optional)
            </label>
            <input
              type="text"
              maxLength={32}
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
              placeholder="they/them"
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
              City or Country (Optional)
            </label>
            <input
              type="text"
              maxLength={60}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Manila, PH"
              className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
            Bio
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full px-3 py-2 rounded-control text-sm bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1.5">
            Style Tags
          </label>
          <div className="flex flex-wrap gap-1.5">
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
                  className={`px-2.5 py-1 rounded-chip text-xs border cursor-pointer ${
                    active
                      ? 'bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717]'
                      : 'border-[#d4cfc5] dark:border-[#404040]'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#d4cfc5] dark:border-[#404040]">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
              Default Wardrobe Visibility
            </label>
            <select
              value={defaultItemVis}
              onChange={(e) => setDefaultItemVis(e.target.value as Visibility)}
              className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            >
              <option value="public">Public</option>
              <option value="friends">Friends only</option>
              <option value="followers">Followers only</option>
              <option value="private">Private</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8] mb-1">
              Default Lookbook Visibility
            </label>
            <select
              value={defaultOutfitVis}
              onChange={(e) => setDefaultOutfitVis(e.target.value as Visibility)}
              className="w-full px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
            >
              <option value="public">Public</option>
              <option value="friends">Friends only</option>
              <option value="followers">Followers only</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!isPublic}
              onChange={(e) => setIsPublic(!e.target.checked)}
              className="accent-[#171717] dark:accent-[#e5e1da]"
            />
            <Lock className="w-3.5 h-3.5" />
            <span>Private account (require follow approval)</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlineStatus}
              onChange={(e) => setShowOnlineStatus(e.target.checked)}
              className="accent-[#171717] dark:accent-[#e5e1da]"
            />
            <span>Show green online dot &amp; last seen status to friends</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoDirtyOnWear}
              onChange={(e) => setAutoDirtyOnWear(e.target.checked)}
              className="accent-[#171717] dark:accent-[#e5e1da]"
            />
            <span>Automatically mark garments &ldquo;Dirty&rdquo; when clicking &ldquo;Wore this today&rdquo;</span>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">Theme:</span>
            <button
              type="button"
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark';
                setTheme(next);
                updateAccountProfile({ theme: next }).catch(() => {});
              }}
              className="px-3 py-1 rounded-chip border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer capitalize"
            >
              {theme} Mode
            </button>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-full bg-[#171717] text-[#f5f4f0] dark:bg-[#e5e1da] dark:text-[#171717] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Blocked & Muted Users */}
      <section className="p-6 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <h2 className="font-display font-bold text-base">Blocked & Muted Accounts</h2>
        </div>

        {blockedEdges.length === 0 && mutedEdges.length === 0 ? (
          <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
            You haven&rsquo;t blocked or muted any accounts.
          </p>
        ) : (
          <div className="space-y-2 text-xs">
            {blockedEdges.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-2.5 rounded-control bg-[#f5f4f0] dark:bg-[#171717]">
                <span>Blocked: @{b.targetUsername}</span>
                <button
                  type="button"
                  onClick={() => toggleBlock({ uid: b.targetId, username: b.targetUsername })}
                  className="underline cursor-pointer"
                >
                  Unblock
                </button>
              </div>
            ))}
            {mutedEdges.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2.5 rounded-control bg-[#f5f4f0] dark:bg-[#171717]">
                <span>Muted: @{m.targetUsername}</span>
                <button
                  type="button"
                  onClick={() => toggleMute({ uid: m.targetId, username: m.targetUsername })}
                  className="underline cursor-pointer"
                >
                  Unmute
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data Export & Password */}
      <section className="p-6 rounded-card border border-[#d4cfc5] dark:border-[#404040] bg-white dark:bg-[#242424] space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-base">Export Your Data</h2>
            <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
              Download your wardrobe, outfits, wishlist, planner, and wear logs as JSON.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportJson}
            className="px-4 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON</span>
          </button>
        </div>

        {!isDemoMode && (
          <form onSubmit={handleUpdatePassword} className="pt-4 border-t border-[#d4cfc5] dark:border-[#404040] space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4e4c46] dark:text-[#c2bfb8]">
              Change Password (Email Accounts)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="Current password"
                className="px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              />
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="New password (6+ chars)"
                className="px-3 py-2 rounded-control text-xs bg-[#f5f4f0] dark:bg-[#171717] border border-[#d4cfc5] dark:border-[#404040]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs font-semibold cursor-pointer"
            >
              Update Password
            </button>
          </form>
        )}
      </section>

      {/* Delete Account */}
      <section className="p-6 rounded-card border border-red-500/40 bg-red-500/5 space-y-3">
        <h2 className="font-display font-bold text-base text-red-700 dark:text-red-300">
          Delete Account & All Content
        </h2>
        <p className="text-xs text-[#4e4c46] dark:text-[#c2bfb8]">
          Permanently removes your wardrobe, outfits, posts, media, and profile from SWOOOSH.
        </p>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-4 py-2 rounded-control border border-red-500/60 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteAccount();
                  onToast('Account deleted.');
                } catch (err: any) {
                  onToast(err?.message || 'Please sign in again before deleting.', 'error');
                }
              }}
              className="px-4 py-2 rounded-control bg-red-700 text-white text-xs font-semibold cursor-pointer"
            >
              Confirm Permanent Deletion
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 rounded-control border border-[#d4cfc5] dark:border-[#404040] text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      <PhotoEditorModal
        open={Boolean(avatarCropSource)}
        sourceUrl={avatarCropSource || ''}
        initialCrop={createDefaultCropState('1:1')}
        defaultAspect="1:1"
        circleMask={true}
        outputMaxDim={512}
        title="Crop Profile Photo"
        subtitle="Drag and zoom to frame your SWOOOSH profile picture."
        doneLabel={uploadingAvatar ? 'Saving...' : 'Done'}
        onCancel={() => {
          if (!uploadingAvatar) setAvatarCropSource(null);
        }}
        onChangePhotoFile={async (file) => {
          const preview = await preparePreviewDataUrl(file);
          setAvatarCropSource(preview);
        }}
        onDone={({ croppedDataUrl }) => handleSaveCroppedAvatar(croppedDataUrl)}
      />
    </div>
    </ErrorBoundary>
  );
};
