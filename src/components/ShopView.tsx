import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Coins,
  Crosshair,
  Lock,
  Shield,
  ShoppingBag,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { CHARACTERS, WEAPONS } from '../lib/catalog.ts';
import { unlockArmoryWeapon, updateProfile } from '../lib/api.ts';
import type { PlayerAccountBundle } from '../types/game.ts';

interface ShopViewProps {
  account: PlayerAccountBundle;
  onAccountUpdated: (bundle: PlayerAccountBundle) => void;
  onOpenFiringRange: () => void;
}

const CATEGORIES = [
  'All',
  'Assault Rifle',
  'SMG',
  'Shotgun',
  'Sniper',
  'LMG',
  'Pistol',
] as const;

export function ShopView({
  account,
  onAccountUpdated,
  onOpenFiringRange,
}: ShopViewProps) {
  const { profile } = account;
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const filteredWeapons =
    selectedCategory === 'All'
      ? WEAPONS
      : WEAPONS.filter((w) => w.category === selectedCategory);

  async function handleBuyWeapon(weaponId: string): Promise<void> {
    setFeedback(null);
    setBusyId(weaponId);
    try {
      const res = await unlockArmoryWeapon(weaponId);
      // Automatically equip newly unlocked weapon for convenience
      const equipped = await updateProfile({ favoriteWeaponId: weaponId });
      onAccountUpdated(equipped.account);
      setFeedback({ type: 'success', text: `${res.message} Equipped as primary!` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Purchase failed.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleEquipWeapon(weaponId: string, name: string): Promise<void> {
    setFeedback(null);
    setBusyId(weaponId);
    try {
      const res = await updateProfile({ favoriteWeaponId: weaponId });
      onAccountUpdated(res.account);
      setFeedback({ type: 'success', text: `${name} equipped as your primary 3D gun.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not equip weapon.',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleEquipCharacter(charId: string, name: string): Promise<void> {
    setFeedback(null);
    setBusyId(`char:${charId}`);
    try {
      const res = await updateProfile({ selectedCharacterId: charId });
      onAccountUpdated(res.account);
      setFeedback({ type: 'success', text: `${name} operative frame deployed.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not switch operative.',
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
      {/* Header Banner */}
      <div className="clay-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono font-bold text-orange-400 inline-flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>TACTICAL ARMORY SHOP</span>
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-0.5">
            Weapons &amp; Combat Loadout
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Unlock rifles, SMGs, shotguns, snipers, and LMGs with Coins earned in 1v1 PvP or Zombie Outbreak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="clay-inset px-4 py-2.5 inline-flex items-center gap-2 text-base font-bold text-amber-400 tabular-nums">
            <Coins className="w-4 h-4" />
            <span>{profile.coins.toLocaleString()} Coins</span>
          </div>
          <button
            type="button"
            onClick={onOpenFiringRange}
            className="clay-btn-secondary px-4 py-2.5 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-orange-400" />
            <span>Test in Firing Range</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
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

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                active ? 'clay-btn-primary' : 'clay-btn-secondary text-slate-300'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Weapons Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredWeapons.map((w) => {
          const owned = profile.inventory.includes(w.id);
          const equipped = profile.favoriteWeaponId === w.id;
          const totalDamage = w.damage * w.pellets;
          const dmgPct = Math.min(100, Math.round((totalDamage / 120) * 100));
          const rofPct = Math.min(100, Math.round((100 / Math.max(70, w.fireRateMs)) * 78));
          const magPct = Math.min(100, Math.round((w.magSize / 85) * 100));
          const rangePct = Math.min(100, Math.round((w.rangePx / 1200) * 100));

          return (
            <div
              key={w.id}
              className={`clay-card p-5 flex flex-col justify-between gap-4 border ${
                equipped
                  ? 'border-orange-500/70'
                  : owned
                    ? 'border-emerald-500/25'
                    : 'border-white/8'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-orange-400 uppercase">
                      {w.category}
                    </span>
                    <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">
                      {w.name}
                    </h2>
                  </div>

                  {equipped ? (
                    <span className="text-[11px] font-mono font-bold text-orange-300 bg-orange-500/15 border border-orange-500/40 rounded-xl px-2.5 py-1">
                      EQUIPPED
                    </span>
                  ) : owned ? (
                    <span className="text-[11px] font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 rounded-xl px-2.5 py-1">
                      OWNED
                    </span>
                  ) : (
                    <span className="text-xs font-mono font-bold text-amber-400 inline-flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      {w.costCoins}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[34px]">
                  {w.description}
                </p>

                {/* Tactical Stat Bars */}
                <div className="clay-inset p-3 space-y-2 text-[11px]">
                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span>Damage {w.pellets > 1 ? `(${w.pellets}x${w.damage})` : ''}</span>
                      <span className="font-mono font-bold">{totalDamage}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#070b14] overflow-hidden">
                      <div className="h-full bg-orange-500" style={{ width: `${dmgPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span>Fire Rate</span>
                      <span className="font-mono font-bold">
                        {Math.round(60000 / w.fireRateMs)} RPM
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#070b14] overflow-hidden">
                      <div className="h-full bg-sky-400" style={{ width: `${rofPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span>Magazine / Reload</span>
                      <span className="font-mono font-bold">
                        {w.magSize} rds · {(w.reloadMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#070b14] overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${magPct}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-300 mb-0.5">
                      <span>Effective Range</span>
                      <span className="font-mono font-bold">{w.rangePx}m</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#070b14] overflow-hidden">
                      <div className="h-full bg-violet-400" style={{ width: `${rangePct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {owned ? (
                <button
                  type="button"
                  disabled={equipped || busyId === w.id}
                  onClick={() => void handleEquipWeapon(w.id, w.name)}
                  className={`w-full py-2.5 px-4 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    equipped ? 'clay-inset text-orange-300 cursor-default' : 'clay-btn-primary'
                  }`}
                >
                  {equipped ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Active Primary</span>
                    </>
                  ) : busyId === w.id ? (
                    <span>Equipping...</span>
                  ) : (
                    <span>Equip Primary Gun</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={profile.coins < w.costCoins || busyId === w.id}
                  onClick={() => void handleBuyWeapon(w.id)}
                  className="clay-btn-emerald w-full py-2.5 px-4 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-45 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    {busyId === w.id
                      ? 'Purchasing...'
                      : profile.coins < w.costCoins
                        ? `Need ${w.costCoins - profile.coins} More Coins`
                        : `Buy & Equip · ${w.costCoins} Coins`}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Operative Armor Frames */}
      <div className="clay-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono font-bold text-sky-400 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>OPERATIVE ARMOR FRAMES</span>
            </p>
            <h2 className="font-display text-2xl font-extrabold text-white mt-0.5">
              Select Your 3D Combat Rig
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CHARACTERS.map((c) => {
            const active = profile.selectedCharacterId === c.id;
            return (
              <div
                key={c.id}
                className={`clay-panel p-4 flex flex-col justify-between gap-3 border ${
                  active ? 'border-orange-500/60' : 'border-white/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-xl font-bold text-white">{c.name}</span>
                    <span className="text-xs font-mono text-emerald-400 inline-flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {c.maxHp} HP
                    </span>
                  </div>
                  <p className="text-xs text-orange-300 mt-0.5">{c.title}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{c.description}</p>
                </div>

                <button
                  type="button"
                  disabled={active || busyId === `char:${c.id}`}
                  onClick={() => void handleEquipCharacter(c.id, c.name)}
                  className={`w-full py-2 text-xs font-bold cursor-pointer ${
                    active ? 'clay-inset text-orange-300 cursor-default' : 'clay-btn-secondary'
                  }`}
                >
                  {active ? 'Active Frame' : 'Deploy Frame'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
