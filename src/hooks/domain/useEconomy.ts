import { useCallback, useMemo } from 'react';
import type { PlayerProfile } from '../../types';
import { getCosmeticThemeById } from '../../data/cosmetics';
import { progressionRepo } from '../../repos/progressionRepo';
import { authoritativeEnabled } from '../../lib/progressionOutcome';
import { useProfileWriter } from './useProfileWriter';

export type PurchaseResult = {
  purchased: boolean;
  reason?: 'missing' | 'owned' | 'coins';
};

async function purchaseViaServer(
  kind: 'theme' | 'avatar',
  itemId: string,
  persist: (next: PlayerProfile) => void,
  profile: PlayerProfile,
): Promise<PurchaseResult> {
  try {
    const res = await progressionRepo.purchase({
      kind,
      itemId,
      idempotencyKey: `${kind}:${itemId}`,
    });
    persist({
      ...profile,
      coins: res.balance,
      unlockedThemes: res.unlockedThemes,
      unlockedAvatars: res.unlockedAvatars,
      activeTheme: res.activeTheme || profile.activeTheme,
      avatar: res.avatar || profile.avatar,
      achievements: res.achievementsGranted.length
        ? Array.from(new Set([...profile.achievements, ...res.achievementsGranted]))
        : profile.achievements,
    });
    return { purchased: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'insufficient_funds') return { purchased: false, reason: 'coins' };
    if (code === 'already_owned') return { purchased: false, reason: 'owned' };
    return { purchased: false, reason: 'missing' };
  }
}

export interface EconomyActions {
  purchaseTheme: (themeId: string) => Promise<PurchaseResult>;
  purchaseAvatar: (avatarId: string, price: number) => Promise<PurchaseResult>;
}

/**
 * Cosmetic purchases (§13.1). Server-authoritative when an API base is
 * configured — the wallet balance comes back from the ledger, never computed
 * client-side — with a local coin-debit fallback for offline/dev.
 */
export function useEconomy(): EconomyActions {
  const { profile, persistProfile, updateProfile } = useProfileWriter();

  const purchaseTheme = useCallback(
    async (themeId: string): Promise<PurchaseResult> => {
      const theme = getCosmeticThemeById(themeId);
      if (!theme) return { purchased: false, reason: 'missing' as const };
      if (profile.unlockedThemes.includes(themeId)) {
        return { purchased: false, reason: 'owned' as const };
      }

      if (authoritativeEnabled()) {
        return purchaseViaServer('theme', themeId, persistProfile, profile);
      }

      if (profile.coins < theme.price) {
        return { purchased: false, reason: 'coins' as const };
      }

      updateProfile((current) => {
        if (current.unlockedThemes.includes(themeId)) return current;
        return {
          ...current,
          coins: current.coins - theme.price,
          unlockedThemes: [...current.unlockedThemes, themeId],
          activeTheme: themeId,
          achievements: current.achievements.includes('aesthete')
            ? current.achievements
            : [...current.achievements, 'aesthete'],
        };
      });

      return { purchased: true };
    },
    [profile, persistProfile, updateProfile],
  );

  const purchaseAvatar = useCallback(
    async (avatarId: string, price: number): Promise<PurchaseResult> => {
      if (profile.unlockedAvatars.includes(avatarId)) {
        return { purchased: false, reason: 'owned' as const };
      }

      if (authoritativeEnabled()) {
        return purchaseViaServer('avatar', avatarId, persistProfile, profile);
      }

      if (profile.coins < price) {
        return { purchased: false, reason: 'coins' as const };
      }

      updateProfile((current) => ({
        ...current,
        coins: current.coins - price,
        unlockedAvatars: [...current.unlockedAvatars, avatarId],
        avatar: avatarId,
      }));

      return { purchased: true };
    },
    [profile, persistProfile, updateProfile],
  );

  return useMemo(
    () => ({ purchaseTheme, purchaseAvatar }),
    [purchaseTheme, purchaseAvatar],
  );
}
