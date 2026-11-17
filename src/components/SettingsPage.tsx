import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { uploadImageAsset } from '../services/storageService';
import { STYLE_CATEGORIES } from '../types';
import { Upload, Sun, Moon, LogOut, KeyRound, User } from 'lucide-react';

interface SettingsPageProps {
  onToast: (msg: string, type?: 'success' | 'error') => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onToast }) => {
  const {
    userProfile,
    isDemoMode,
    updateAccountProfile,
    changePassword,
    signOutUser,
  } = useAuth();
  const { theme, setTheme } = useTheme();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(userProfile?.photoURL || '');
  const [stylePreference, setStylePreference] = useState(
    userProfile?.stylePreference || 'Streetwear'
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadImageAsset(file, userProfile.uid, 'profiles', isDemoMode);
      setPhotoURL(uploaded.imageUrl);
      await updateAccountProfile({ photoURL: uploaded.imageUrl });
      onToast('Profile photo updated.');
    } catch (err: any) {
      onToast(err.message || 'Could not update profile photo.', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      onToast('Full name cannot be empty.', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await updateAccountProfile({
        displayName: displayName.trim(),
        stylePreference,
      });
      onToast('Profile preferences saved.');
    } catch (err: any) {
      onToast(err.message || 'Could not save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleThemeSelect = async (nextTheme: 'dark' | 'light') => {
    setTheme(nextTheme);
    try {
      await updateAccountProfile({ theme: nextTheme });
    } catch {
      // Theme is stored locally
    }
    onToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode.`);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      onToast('Enter both current and new passwords.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      onToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      onToast('New passwords do not match.', 'error');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      onToast('Password updated securely.');
    } catch (err: any) {
      onToast(err.message || 'Could not change password.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div className="pb-5 border-b border-[#d8d4ca] dark:border-[#404040]">
        <p className="text-xs uppercase tracking-[0.18em] text-[#5c5a54] dark:text-[#b0b0b0]">
          Account & Theme Preferences
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight mt-1">
          Settings
        </h1>
      </div>

      {/* Profile Section */}
      <section className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
          <User className="w-4 h-4" />
          <h2 className="font-display text-lg font-bold">Profile Details</h2>
        </div>

        <div className="flex items-center gap-4">
          {photoURL ? (
            <img
              src={photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 object-cover border border-[#d8d4ca] dark:border-[#404040]"
            />
          ) : (
            <div className="w-16 h-16 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] font-display text-xl font-bold flex items-center justify-center">
              {(displayName || userProfile?.email || 'S').charAt(0).toUpperCase()}
            </div>
          )}

          <label className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#d8d4ca] dark:border-[#404040] hover:border-[#171717] dark:hover:border-[#e5e1da] text-xs font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{uploadingPhoto ? 'Uploading...' : 'Update Profile Photo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
              className="hidden"
            />
          </label>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Registered Email
              </label>
              <input
                type="email"
                readOnly
                value={userProfile?.email || ''}
                className="w-full px-3 py-2 text-sm bg-[#eae7e0] dark:bg-[#171717] border border-[#d8d4ca] dark:border-[#404040] text-[#5c5a54] dark:text-[#b0b0b0]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Default Aesthetic Preference
              </label>
              <select
                value={stylePreference}
                onChange={(e) => setStylePreference(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              >
                {STYLE_CATEGORIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </section>

      {/* Theme Appearance */}
      <section className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-6 space-y-4">
        <h2 className="font-display text-lg font-bold pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
          CONCRETE Appearance
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleThemeSelect('dark')}
            className={`p-4 border text-left flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#171717] text-[#e5e1da] border-[#e5e1da]'
                : 'bg-[#f5f4f0] dark:bg-[#303030] border-[#d8d4ca] dark:border-[#404040]'
            }`}
          >
            <div>
              <p className="text-xs font-semibold">Dark Mode (CONCRETE)</p>
              <p className="text-[11px] opacity-75 mt-0.5">Charcoal #171717 & Bone #E5E1DA</p>
            </div>
            <Moon className="w-4 h-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => handleThemeSelect('light')}
            className={`p-4 border text-left flex items-center justify-between transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-[#171717] text-[#f5f4f0] border-[#171717]'
                : 'bg-[#f5f4f0] dark:bg-[#303030] border-[#d8d4ca] dark:border-[#404040]'
            }`}
          >
            <div>
              <p className="text-xs font-semibold">Light Mode (Editorial)</p>
              <p className="text-[11px] opacity-75 mt-0.5">Warm Off-White & Concrete Gray</p>
            </div>
            <Sun className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </section>

      {/* Security / Change Password */}
      <section className="bg-white dark:bg-[#242424] border border-[#d8d4ca] dark:border-[#404040] p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#d8d4ca] dark:border-[#404040]">
          <KeyRound className="w-4 h-4" />
          <h2 className="font-display text-lg font-bold">Security & Password</h2>
        </div>

        {isDemoMode ? (
          <p className="text-xs text-[#5c5a54] dark:text-[#b0b0b0]">
            Password management is disabled in Demo Mode. Sign out and create a personal account to manage credentials.
          </p>
        ) : (
          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#5c5a54] dark:text-[#b0b0b0] mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#f5f4f0] dark:bg-[#303030] border border-[#d8d4ca] dark:border-[#404040]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="px-5 py-2.5 bg-[#171717] dark:bg-[#e5e1da] text-[#f5f4f0] dark:text-[#171717] text-xs font-semibold cursor-pointer"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </section>

      {/* Sign Out */}
      <section className="pt-2">
        <button
          type="button"
          onClick={signOutUser}
          className="px-5 py-2.5 border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of SWOOOSH</span>
        </button>
      </section>
    </div>
  );
};
