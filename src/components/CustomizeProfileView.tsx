import { useEffect, useState } from 'react';
import {
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Coins,
  Lock,
  Check,
} from 'lucide-react';
import {
  BADGES,
  CHARACTERS,
  DEFAULT_AVATARS,
  PROFILE_BACKGROUNDS,
  PROFILE_THEMES,
  WEAPONS,
  getBackgroundById,
  getBadgeById,
  getCharacterById,
  getThemeById,
  getWeaponById,
} from '../lib/catalog.ts';
import {
  checkUsernameAvailability,
  unlockArmoryWeapon,
  updateProfile,
} from '../lib/api.ts';
import type { PlayerAccountBundle } from '../types/game.ts';
import { PlayerAvatar } from './PlayerAvatar.tsx';

interface CustomizeProfileViewProps {
  account: PlayerAccountBundle;
  onAccountUpdated: (bundle: PlayerAccountBundle) => void;
  onOpenAvatarUpload: () => void;
  onRemoveAvatarPicture: () => Promise<void>;
}

export function CustomizeProfileView({
  account,
  onAccountUpdated,
  onOpenAvatarUpload,
  onRemoveAvatarPicture,
}: CustomizeProfileViewProps) {
  const { profile, stats } = account;

  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [selectedAvatarId, setSelectedAvatarId] = useState(profile.selectedAvatarId);
  const [profileBackgroundId, setProfileBackgroundId] = useState(profile.profileBackgroundId);
  const [profileThemeId, setProfileThemeId] = useState(profile.profileThemeId);
  const [selectedCharacterId, setSelectedCharacterId] = useState(profile.selectedCharacterId);
  const [favoriteWeaponId, setFavoriteWeaponId] = useState(profile.favoriteWeaponId);
  const [showcaseBadges, setShowcaseBadges] = useState<string[]>(profile.showcaseBadges);

  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });

  const [saving, setSaving] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setSelectedAvatarId(profile.selectedAvatarId);
    setProfileBackgroundId(profile.profileBackgroundId);
    setProfileThemeId(profile.profileThemeId);
    setSelectedCharacterId(profile.selectedCharacterId);
    setFavoriteWeaponId(profile.favoriteWeaponId);
    setShowcaseBadges(profile.showcaseBadges);
  }, [profile]);

  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.toLowerCase() === profile.username.toLowerCase()) {
      setUsernameStatus({ checking: false, available: null, message: '' });
      return;
    }
    if (trimmed.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: '3-20 chars using letters, numbers, underscores only.',
      });
      return;
    }

    let cancelled = false;
    setUsernameStatus({ checking: true, available: null, message: 'Checking...' });
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed);
        if (!cancelled) {
          setUsernameStatus({
            checking: false,
            available: res.available,
            message: res.message,
          });
        }
      } catch {
        if (!cancelled) {
          setUsernameStatus({ checking: false, available: null, message: '' });
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, profile.username]);

  function toggleBadge(badgeId: string): void {
    if (!profile.badges.includes(badgeId)) return;
    setShowcaseBadges((prev) => {
      if (prev.includes(badgeId)) {
        return prev.filter((id) => id !== badgeId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), badgeId];
      }
      return [...prev, badgeId];
    });
  }

  async function handleSave(): Promise<void> {
    setFeedback(null);
    if (usernameStatus.available === false) {
      setFeedback({ type: 'error', text: usernameStatus.message || 'Username unavailable.' });
      return;
    }
    setSaving(true);
    try {
      const res = await updateProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        bio: bio.trim(),
        selectedAvatarId,
        profileBackgroundId,
        profileThemeId,
        selectedCharacterId,
        favoriteWeaponId,
        showcaseBadges,
      });
      onAccountUpdated(res.account);
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save changes.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlockWeapon(weaponId: string): Promise<void> {
    setFeedback(null);
    setUnlockingId(weaponId);
    try {
      const res = await unlockArmoryWeapon(weaponId);
      onAccountUpdated(res.account);
      setFavoriteWeaponId(weaponId);
      setFeedback({ type: 'success', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not unlock weapon.',
      });
    } finally {
      setUnlockingId(null);
    }
  }

  const previewBg = getBackgroundById(profileBackgroundId);
  const previewTheme = getThemeById(profileThemeId);
  const previewChar = getCharacterById(selectedCharacterId);
  const previewWeapon = getWeaponById(favoriteWeaponId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Avatar & Armory Customization</h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalize your portrait, banner, operative class, and 3D weapon loadout.
          </p>
        </div>
        <div className="clay-panel px-4 py-2 inline-flex items-center gap-2 text-sm font-bold text-amber-400 tabular-nums">
          <Coins className="w-4 h-4" />
          <span>{profile.coins.toLocaleString()} Coins</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Profile Picture & Default Avatars */}
          <div className="clay-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-100">Profile Picture & Avatar</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload a custom photo (JPG, PNG, WEBP) or choose an operative portrait.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenAvatarUpload}
                  className="clay-btn-primary inline-flex items-center gap-2 font-bold text-xs px-4 py-2.5 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{profile.profilePictureUrl ? 'Change Picture' : 'Upload Picture'}</span>
                </button>
                {profile.profilePictureUrl && (
                  <button
                    type="button"
                    onClick={() => void onRemoveAvatarPicture()}
                    className="clay-btn-secondary inline-flex items-center gap-1.5 text-rose-300 text-xs font-semibold px-3.5 py-2.5 cursor-pointer whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2.5">
                Default Tactical Avatars {profile.profilePictureUrl ? '(used if custom picture is removed)' : ''}
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {DEFAULT_AVATARS.map((av) => {
                  const active = selectedAvatarId === av.id;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setSelectedAvatarId(av.id)}
                      className={`rounded-2xl p-2 border text-center transition-all cursor-pointer ${
                        active
                          ? 'bg-orange-500/15 border-orange-500 shadow-[0_0_0_2px_rgba(255,122,47,0.2)]'
                          : 'clay-inset hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-center">
                        <PlayerAvatar
                          profilePictureUrl={null}
                          selectedAvatarId={av.id}
                          profileThemeId={profileThemeId}
                          displayName={av.name}
                          size="md"
                        />
                      </div>
                      <p className="text-xs text-slate-200 font-medium mt-2 truncate">{av.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Identity & Bio */}
          <div className="clay-card p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-100">Identity & Bio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="custom-display-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Display Name
                </label>
                <input
                  id="custom-display-name"
                  type="text"
                  maxLength={28}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
                />
              </div>

              <div>
                <label
                  htmlFor="custom-username"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Username
                </label>
                <input
                  id="custom-username"
                  type="text"
                  maxLength={20}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100"
                />
                {usernameStatus.message && (
                  <p
                    className={`mt-1 text-xs flex items-center gap-1 ${
                      usernameStatus.checking
                        ? 'text-slate-400'
                        : usernameStatus.available
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                    }`}
                  >
                    {usernameStatus.checking && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{usernameStatus.message}</span>
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="custom-bio" className="text-xs font-medium text-slate-300">
                  Bio / About Me
                </label>
                <span className="text-xs text-slate-500 tabular-nums">{bio.length} / 220</span>
              </div>
              <textarea
                id="custom-bio"
                rows={3}
                maxLength={220}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="clay-input w-full px-3.5 py-2.5 text-sm text-slate-100 resize-none"
              />
            </div>
          </div>

          {/* Background & Theme Frame */}
          <div className="clay-card p-6 space-y-5">
            <h2 className="text-xl font-bold text-slate-100">Profile Theme & Background</h2>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2.5">Profile Frame Theme</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {PROFILE_THEMES.map((t) => {
                  const active = profileThemeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setProfileThemeId(t.id)}
                      className={`rounded-2xl p-2.5 border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-orange-500/15 border-orange-500'
                          : 'clay-inset hover:border-white/20'
                      }`}
                    >
                      <span
                        className="block w-5 h-5 rounded-lg mb-1.5"
                        style={{ backgroundColor: t.accentHex }}
                      />
                      <span className="text-xs font-medium text-slate-200 block truncate">
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2.5">Banner Background</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PROFILE_BACKGROUNDS.map((b) => {
                  const active = profileBackgroundId === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setProfileBackgroundId(b.id)}
                      className={`relative h-20 rounded-2xl overflow-hidden border text-left transition-all cursor-pointer bg-gradient-to-br ${
                        b.gradientClass
                      } ${active ? 'border-orange-500 ring-2 ring-orange-500/40' : 'border-white/10'}`}
                    >
                      {b.imageUrl && (
                        <img
                          src={b.imageUrl}
                          alt={b.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-60"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-end p-2.5">
                        <span className="text-xs font-semibold text-slate-100">{b.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Character, Weapons & Showcase Badges */}
          <div className="clay-card p-6 space-y-5">
            <h2 className="text-xl font-bold text-slate-100">Character, Armory & Badges</h2>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2.5">Selected 3D Operative</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CHARACTERS.map((c) => {
                  const active = selectedCharacterId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCharacterId(c.id)}
                      className={`rounded-2xl p-3.5 border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-orange-500/15 border-orange-500'
                          : 'clay-inset hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-100">{c.name}</span>
                        <span className="text-xs text-slate-400 tabular-nums">{c.maxHp} HP</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{c.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2.5">
                Primary Weapon & Armory Unlocks
              </p>
              <div className="space-y-2.5">
                {WEAPONS.map((w) => {
                  const owned = profile.inventory.includes(w.id);
                  const active = favoriteWeaponId === w.id;
                  return (
                    <div
                      key={w.id}
                      className={`rounded-2xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        active ? 'bg-orange-500/15 border-orange-500' : 'clay-inset'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-100">{w.name}</span>
                          <span className="text-xs text-slate-500">· {w.category}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{w.description}</p>
                      </div>

                      {owned ? (
                        <button
                          type="button"
                          onClick={() => setFavoriteWeaponId(w.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                            active
                              ? 'clay-btn-primary'
                              : 'clay-btn-secondary'
                          }`}
                        >
                          {active ? 'Equipped' : 'Equip'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={profile.coins < w.costCoins || unlockingId === w.id}
                          onClick={() => void handleUnlockWeapon(w.id)}
                          className="clay-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-400 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>
                            {unlockingId === w.id ? 'Unlocking...' : `Unlock · ${w.costCoins} Coins`}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-400 mb-2.5">
                Showcase Badges (select up to 3 unlocked badges)
              </p>
              <div className="flex flex-wrap gap-2">
                {BADGES.map((b) => {
                  const unlocked = profile.badges.includes(b.id);
                  const selected = showcaseBadges.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => toggleBadge(b.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors ${
                        !unlocked
                          ? 'bg-[#0e1422]/40 border-white/5 text-slate-600 cursor-not-allowed'
                          : selected
                            ? 'bg-orange-500/15 border-orange-500 text-orange-300 cursor-pointer'
                            : 'clay-inset text-slate-300 hover:border-white/25 cursor-pointer'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      <span>{b.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Live Preview */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          <div className="clay-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-100">Live Profile Preview</h2>
              <span className="text-xs text-slate-400">Updates before saving</span>
            </div>

            <div className={`clay-inset border ${previewTheme.borderClass} overflow-hidden`}>
              <div className={`relative h-28 bg-gradient-to-br ${previewBg.gradientClass}`}>
                {previewBg.imageUrl && (
                  <img
                    src={previewBg.imageUrl}
                    alt={previewBg.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-55"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#101624] via-[#101624]/35 to-transparent" />
              </div>

              <div className="px-5 pb-5 -mt-10 relative">
                <div className="flex items-end justify-between gap-3">
                  <PlayerAvatar
                    profilePictureUrl={profile.profilePictureUrl}
                    selectedAvatarId={selectedAvatarId}
                    profileThemeId={profileThemeId}
                    displayName={displayName || username}
                    size="lg"
                  />
                  <div className="text-right pb-1">
                    <span className={`text-sm font-bold ${previewTheme.badgeTextClass}`}>
                      Level {profile.level}
                    </span>
                    <p className="text-xs text-slate-500 font-mono">{profile.playerId}</p>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-slate-100 mt-3 truncate">
                  {displayName || username}
                </h3>
                <p className="text-xs text-slate-400 font-mono">@{username || profile.username}</p>
                <p className="mt-2.5 text-sm text-slate-300 leading-relaxed">
                  {bio || 'No bio entered.'}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="clay-panel p-2.5">
                    <span className="text-slate-400">Operative</span>
                    <p className="font-semibold text-slate-100 mt-0.5">{previewChar.name}</p>
                  </div>
                  <div className="clay-panel p-2.5">
                    <span className="text-slate-400">Primary Gun</span>
                    <p className="font-semibold text-slate-100 mt-0.5">{previewWeapon.name}</p>
                  </div>
                </div>

                {showcaseBadges.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                    {showcaseBadges.map((id) => {
                      const b = getBadgeById(id);
                      return b ? <span key={id}>{b.name}</span> : null;
                    })}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="clay-panel p-2">
                    <span className="text-slate-400 block">Kills</span>
                    <span className="font-semibold text-slate-100 tabular-nums">
                      {stats.totalKills}
                    </span>
                  </div>
                  <div className="clay-panel p-2">
                    <span className="text-slate-400 block">Wins</span>
                    <span className="font-semibold text-emerald-400 tabular-nums">
                      {stats.totalWins}
                    </span>
                  </div>
                  <div className="clay-panel p-2">
                    <span className="text-slate-400 block">Win Rate</span>
                    <span className="font-semibold text-slate-100 tabular-nums">
                      {stats.winRate}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {feedback && (
              <div
                className={`mt-4 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="clay-btn-primary mt-4 w-full font-bold text-sm py-3 px-4 disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
