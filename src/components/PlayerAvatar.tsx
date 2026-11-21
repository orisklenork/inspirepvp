import { useState } from 'react';
import { getAvatarById, getThemeById } from '../lib/catalog.ts';

interface PlayerAvatarProps {
  profilePictureUrl: string | null;
  selectedAvatarId: string;
  profileThemeId?: string;
  displayName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export function PlayerAvatar({
  profilePictureUrl,
  selectedAvatarId,
  profileThemeId = 'amber_vanguard',
  displayName,
  size = 'md',
  shape = 'rounded',
  className = '',
}: PlayerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarOption = getAvatarById(selectedAvatarId);
  const theme = getThemeById(profileThemeId);

  const activeUrl = !imgFailed ? profilePictureUrl || avatarOption.imageUrl : null;
  const radiusClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#141b2c] shadow-[0_6px_14px_rgba(4,7,14,0.6),inset_0_1px_2px_rgba(255,255,255,0.2)] ${SIZE_CLASSES[size]} ${radiusClass} ${theme.ringClass} ${className}`}
    >
      {activeUrl ? (
        <img
          src={activeUrl}
          alt={`${displayName} avatar`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#232f48] to-[#101624]"
          aria-label={`${displayName} insignia`}
        >
          {selectedAvatarId === 'emblem_amber' ? (
            <svg viewBox="0 0 36 36" className="w-3/5 h-3/5" fill="none">
              <path
                d="M18 4L30 11V25L18 32L6 25V11L18 4Z"
                stroke="#F59E0B"
                strokeWidth="2.2"
              />
              <path d="M18 10L24 18L18 26L12 18L18 10Z" fill="#F59E0B" />
            </svg>
          ) : selectedAvatarId === 'emblem_steel' ? (
            <svg viewBox="0 0 36 36" className="w-3/5 h-3/5" fill="none">
              <rect
                x="7"
                y="7"
                width="22"
                height="22"
                rx="3"
                stroke="#94A3B8"
                strokeWidth="2.2"
              />
              <path d="M12 18H24M18 12V24" stroke="#E2E8F0" strokeWidth="2.4" />
            </svg>
          ) : (
            <span className="font-display font-bold text-slate-200 text-sm uppercase tracking-wider">
              {displayName.slice(0, 2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
