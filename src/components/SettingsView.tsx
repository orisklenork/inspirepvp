import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  changeAccountPassword,
  checkUsernameAvailability,
  updateProfile,
} from '../lib/api.ts';
import type { AppView, PlayerAccountBundle } from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface SettingsViewProps {
  account: PlayerAccountBundle;
  onAccountUpdated: (bundle: PlayerAccountBundle) => void;
  onOpenAvatarUpload: () => void;
  onRemoveAvatarPicture: () => Promise<void>;
  onNavigate: (view: AppView) => void;
  onLogout: () => Promise<void>;
}

export function SettingsView({
  account,
  onAccountUpdated,
  onOpenAvatarUpload,
  onRemoveAvatarPicture,
  onNavigate,
  onLogout,
}: SettingsViewProps) {
  const { profile } = account;

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [username, setUsername] = useState(profile.username);
  const [usernameCheck, setUsernameCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [passwordMsg, setPasswordMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setUsername(profile.username);
  }, [profile]);

  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.toLowerCase() === profile.username.toLowerCase()) {
      setUsernameCheck({ checking: false, available: null, message: '' });
      return;
    }
    if (trimmed.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameCheck({
        checking: false,
        available: false,
        message: 'Username must be 3-20 alphanumeric or underscore characters.',
      });
      return;
    }

    let cancelled = false;
    setUsernameCheck({ checking: true, available: null, message: 'Checking availability...' });
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed);
        if (!cancelled) {
          setUsernameCheck({
            checking: false,
            available: res.available,
            message: res.message,
          });
        }
      } catch {
        if (!cancelled) {
          setUsernameCheck({ checking: false, available: null, message: '' });
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, profile.username]);

  async function handleSaveAccountProfile(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setProfileMsg(null);
    if (usernameCheck.available === false) {
      setProfileMsg({ type: 'error', text: usernameCheck.message || 'Username unavailable.' });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await updateProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim(),
      });
      onAccountUpdated(res.account);
      setProfileMsg({ type: 'success', text: 'Account profile updated.' });
    } catch (err) {
      setProfileMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update settings.',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setPasswordMsg(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await changeAccountPassword(currentPassword, newPassword, confirmNewPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMsg({ type: 'success', text: res.message });
    } catch (err) {
      setPasswordMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Password change failed.',
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Account Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your username, password, profile picture, bio, and active session.
        </p>
      </div>

      {/* Avatar & Picture Card */}
      <div className="clay-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar
            profilePictureUrl={profile.profilePictureUrl}
            selectedAvatarId={profile.selectedAvatarId}
            profileThemeId={profile.profileThemeId}
            displayName={profile.displayName}
            size="lg"
          />
          <div>
            <h2 className="text-lg font-bold text-slate-100">Avatar & Profile Picture</h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Player ID: {profile.playerId}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenAvatarUpload}
            className="clay-btn-primary inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Picture</span>
          </button>
          {profile.profilePictureUrl && (
            <button
              type="button"
              onClick={() => void onRemoveAvatarPicture()}
              className="clay-btn-secondary inline-flex items-center gap-1.5 text-rose-300 text-xs font-semibold px-3.5 py-2.5 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Picture</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('customize')}
            className="clay-btn-secondary inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 cursor-pointer whitespace-nowrap"
          >
            <Sliders className="w-3.5 h-3.5 text-orange-400" />
            <span>Customize Appearance</span>
          </button>
        </div>
      </div>

      {/* Edit Profile & Username */}
      <form
        onSubmit={(e) => void handleSaveAccountProfile(e)}
        className="clay-card p-6 space-y-4"
      >
        <h2 className="text-xl font-bold text-slate-100">Edit Profile & Username</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="settings-username"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Username
            </label>
            <input
              id="settings-username"
              type="text"
              maxLength={20}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
            />
            {usernameCheck.message && (
              <p
                className={`mt-1 text-xs flex items-center gap-1 ${
                  usernameCheck.checking
                    ? 'text-slate-400'
                    : usernameCheck.available
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                }`}
              >
                {usernameCheck.checking && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{usernameCheck.message}</span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="settings-display-name"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Display Name
            </label>
            <input
              id="settings-display-name"
              type="text"
              maxLength={28}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
            />
          </div>
        </div>

        <div>
          <label htmlFor="settings-bio" className="block text-xs font-medium text-slate-300 mb-1.5">
            Bio / About Me
          </label>
          <textarea
            id="settings-bio"
            rows={3}
            maxLength={220}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100 resize-none"
          />
        </div>

        {profileMsg && (
          <div
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm border ${
              profileMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
            }`}
          >
            {profileMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{profileMsg.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="clay-btn-primary font-bold text-sm px-5 py-2.5 disabled:opacity-60 cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Account Details'}
          </button>
        </div>
      </form>

      {/* Change Password */}
      <form
        onSubmit={(e) => void handlePasswordSubmit(e)}
        className="clay-card p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-100">Change Password</h2>
          <button
            type="button"
            onClick={() => setShowPasswords((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPasswords ? 'Hide passwords' : 'Show passwords'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="settings-cur-pw"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Current Password
            </label>
            <input
              id="settings-cur-pw"
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="settings-new-pw"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              New Password
            </label>
            <input
              id="settings-new-pw"
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
            />
          </div>
          <div>
            <label
              htmlFor="settings-confirm-pw"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Confirm New Password
            </label>
            <input
              id="settings-confirm-pw"
              type={showPasswords ? 'text' : 'password'}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
            />
          </div>
        </div>

        {passwordMsg && (
          <div
            className={`flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm border ${
              passwordMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
            }`}
          >
            {passwordMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{passwordMsg.text}</span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingPassword}
            className="clay-btn-secondary font-semibold text-sm px-5 py-2.5 disabled:opacity-60 cursor-pointer"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* Session & Logout */}
      <div className="clay-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Session & Sign Out</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Account created on {new Date(profile.createdAt).toLocaleDateString()}. Logging out
            ends your saved browser session.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="clay-btn-danger inline-flex items-center justify-center gap-2 font-bold text-sm px-5 py-2.5 cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
