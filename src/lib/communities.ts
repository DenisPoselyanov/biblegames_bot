import type { Community, CommunityLeaderboard, LeaderboardEntry, SocialProfile } from '../types';

const COMMUNITIES_STORAGE_KEY = 'bible-game-communities-v1';

/**
 * Менеджер спільнот
 */
export class CommunityManager {
  private communities: Map<string, Community> = new Map();
  private socialProfiles: Map<string, SocialProfile> = new Map();
  private leaderboards: Map<string, CommunityLeaderboard> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Створити спільноту
   */
  createCommunity(
    name: string,
    description: string,
    creatorId: string,
    isPublic: boolean = false
  ): Community {
    const id = this.generateCommunityId();
    
    const community: Community = {
      id,
      name,
      description,
      creatorId,
      memberIds: [creatorId],
      isPublic,
      createdAt: new Date().toISOString(),
    };

    this.communities.set(id, community);
    
    // Додаємо спільноту в профіль творця
    this.addCommunityToProfile(creatorId, id);
    
    // Створюємо лідерборд для спільноти
    this.createLeaderboard(id);

    this.saveToStorage();
    return community;
  }

  /**
   * Отримати спільноту за ID
   */
  getCommunity(id: string): Community | undefined {
    return this.communities.get(id);
  }

  /**
   * Отримати спільноти користувача
   */
  getUserCommunities(userId: string): Community[] {
    const profile = this.socialProfiles.get(userId);
    if (!profile) return [];
    
    return profile.communities
      .map(id => this.communities.get(id))
      .filter(Boolean) as Community[];
  }

  /**
   * Отримати публічні спільноти
   */
  getPublicCommunities(): Community[] {
    return Array.from(this.communities.values()).filter(c => c.isPublic);
  }

  /**
   * Пошук спільнот
   */
  searchCommunities(query: string): Community[] {
    const lowerQuery = query.toLowerCase();
    return this.getPublicCommunities().filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      c.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Приєднатися до спільноти
   */
  joinCommunity(communityId: string, userId: string): boolean {
    const community = this.communities.get(communityId);
    if (!community) return false;
    if (!community.isPublic) return false; // Приватні спільноти за запрошенням
    if (community.memberIds.includes(userId)) return false;

    community.memberIds.push(userId);
    this.communities.set(communityId, community);
    
    this.addCommunityToProfile(userId, communityId);
    this.saveToStorage();
    return true;
  }

  /**
   * Покинути спільноту
   */
  leaveCommunity(communityId: string, userId: string): boolean {
    const community = this.communities.get(communityId);
    if (!community) return false;
    if (community.creatorId === userId) return false; // Творець не може покинути

    const index = community.memberIds.indexOf(userId);
    if (index === -1) return false;

    community.memberIds.splice(index, 1);
    this.communities.set(communityId, community);
    
    this.removeCommunityFromProfile(userId, communityId);
    this.saveToStorage();
    return true;
  }

  removeMember(communityId: string, memberId: string, userId: string): boolean {
    const community = this.communities.get(communityId);
    if (!community || community.creatorId !== userId) return false;
    if (memberId === community.creatorId) return false;

    const index = community.memberIds.indexOf(memberId);
    if (index === -1) return false;

    community.memberIds.splice(index, 1);
    this.communities.set(communityId, community);
    this.removeCommunityFromProfile(memberId, communityId);
    this.saveToStorage();
    return true;
  }

  /**
   * Видалити спільноту (тільки творець)
   */
  deleteCommunity(communityId: string, userId: string): boolean {
    const community = this.communities.get(communityId);
    if (!community || community.creatorId !== userId) return false;

    // Видаляємо спільноту з профілів усіх учасників
    community.memberIds.forEach(memberId => {
      this.removeCommunityFromProfile(memberId, communityId);
    });

    const periods: CommunityLeaderboard['period'][] = ['weekly', 'monthly', 'all_time'];
    periods.forEach((p) => this.leaderboards.delete(`${communityId}_${p}`));

    const removed = this.communities.delete(communityId);
    if (removed) this.saveToStorage();
    return removed;
  }

  /**
   * Оновити спільноту
   */
  updateCommunity(communityId: string, updates: Partial<Omit<Community, 'id' | 'creatorId' | 'createdAt'>>, userId: string): Community | null {
    const community = this.communities.get(communityId);
    if (!community || community.creatorId !== userId) return null;

    const updated = {
      ...community,
      ...updates,
      id: community.id,
      creatorId: community.creatorId,
      createdAt: community.createdAt,
    };

    this.communities.set(communityId, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Отримати соціальний профіль користувача
   */
  getSocialProfile(userId: string): SocialProfile {
    if (!this.socialProfiles.has(userId)) {
      this.socialProfiles.set(userId, this.createDefaultProfile(userId));
      this.saveToStorage();
    }
    return this.socialProfiles.get(userId)!;
  }

  /**
   * Оновити соціальний профіль
   */
  updateSocialProfile(userId: string, updates: Partial<SocialProfile>): SocialProfile {
    const profile = this.getSocialProfile(userId);
    const updated = { ...profile, ...updates };
    this.socialProfiles.set(userId, updated);
    this.saveToStorage();
    return updated;
  }

  /**
   * Додати друга
   */
  addFriend(userId: string, friendId: string): boolean {
    if (userId === friendId) return false;
    
    const userProfile = this.getSocialProfile(userId);
    const friendProfile = this.getSocialProfile(friendId);

    if (userProfile.friends.includes(friendId)) return false;
    if (userProfile.blockedUsers.includes(friendId)) return false;
    if (friendProfile.blockedUsers.includes(userId)) return false;

    userProfile.friends.push(friendId);
    friendProfile.friends.push(userId);

    // Видаляємо з pending якщо є
    const pendingIndex = userProfile.pendingFriends.indexOf(friendId);
    if (pendingIndex !== -1) {
      userProfile.pendingFriends.splice(pendingIndex, 1);
    }

    this.socialProfiles.set(userId, userProfile);
    this.socialProfiles.set(friendId, friendProfile);
    this.saveToStorage();
    return true;
  }

  /**
   * Видалити друга
   */
  removeFriend(userId: string, friendId: string): boolean {
    const userProfile = this.getSocialProfile(userId);
    const friendProfile = this.getSocialProfile(friendId);

    const userIndex = userProfile.friends.indexOf(friendId);
    const friendIndex = friendProfile.friends.indexOf(userId);

    if (userIndex === -1 || friendIndex === -1) return false;

    userProfile.friends.splice(userIndex, 1);
    friendProfile.friends.splice(friendIndex, 1);

    this.socialProfiles.set(userId, userProfile);
    this.socialProfiles.set(friendId, friendProfile);
    this.saveToStorage();
    return true;
  }

  /**
   * Заблокувати користувача
   */
  blockUser(userId: string, blockedUserId: string): boolean {
    if (userId === blockedUserId) return false;

    const userProfile = this.getSocialProfile(userId);
    if (userProfile.blockedUsers.includes(blockedUserId)) return false;

    // Спочатку видаляємо з друзів
    this.removeFriend(userId, blockedUserId);

    userProfile.blockedUsers.push(blockedUserId);
    this.socialProfiles.set(userId, userProfile);
    this.saveToStorage();
    return true;
  }

  /**
   * Розблокувати користувача
   */
  unblockUser(userId: string, blockedUserId: string): boolean {
    const userProfile = this.getSocialProfile(userId);
    const index = userProfile.blockedUsers.indexOf(blockedUserId);
    
    if (index === -1) return false;

    userProfile.blockedUsers.splice(index, 1);
    this.socialProfiles.set(userId, userProfile);
    this.saveToStorage();
    return true;
  }

  /**
   * Отримати лідерборд спільноти
   */
  getCommunityLeaderboard(communityId: string, period: CommunityLeaderboard['period'] = 'weekly'): CommunityLeaderboard | undefined {
    const key = `${communityId}_${period}`;
    return this.leaderboards.get(key);
  }

  /**
   * Оновити лідерборд спільноти
   */
  updateCommunityLeaderboard(communityId: string, entries: LeaderboardEntry[], period: CommunityLeaderboard['period'] = 'weekly'): CommunityLeaderboard {
    const key = `${communityId}_${period}`;
    
    const leaderboard: CommunityLeaderboard = {
      communityId,
      period,
      entries: entries.sort((a, b) => b.score - a.score),
      lastUpdated: new Date().toISOString(),
    };

    this.leaderboards.set(key, leaderboard);
    this.saveToStorage();
    return leaderboard;
  }

  /**
   * Отримати глобальний лідерборд
   */
  getGlobalLeaderboard(_period: 'weekly' | 'monthly' | 'all_time' = 'weekly'): LeaderboardEntry[] {
    // У реальному коді це бірлося б з бази даних
    // Для демо повернемо порожній масив
    return [];
  }

  /**
   * Створити лідерборд для спільноти
   */
  private createLeaderboard(communityId: string): void {
    const periods: CommunityLeaderboard['period'][] = ['weekly', 'monthly', 'all_time'];
    periods.forEach(period => {
      const key = `${communityId}_${period}`;
      this.leaderboards.set(key, {
        communityId,
        period,
        entries: [],
        lastUpdated: new Date().toISOString(),
      });
    });
  }

  /**
   * Додати спільноту в профіль
   */
  private addCommunityToProfile(userId: string, communityId: string): void {
    const profile = this.getSocialProfile(userId);
    if (!profile.communities.includes(communityId)) {
      profile.communities.push(communityId);
      this.socialProfiles.set(userId, profile);
    }
  }

  /**
   * Видалити спільноту з профілю
   */
  private removeCommunityFromProfile(userId: string, communityId: string): void {
    const profile = this.getSocialProfile(userId);
    const index = profile.communities.indexOf(communityId);
    if (index !== -1) {
      profile.communities.splice(index, 1);
      this.socialProfiles.set(userId, profile);
    }
  }

  /**
   * Створити дефолтний профіль
   */
  private createDefaultProfile(userId: string): SocialProfile {
    return {
      userId,
      friends: [],
      pendingFriends: [],
      communities: [],
      blockedUsers: [],
      privacySettings: {
        showProfile: true,
        showStats: true,
        allowChallenges: true,
        showInLeaderboards: true,
      },
    };
  }

  /**
   * Генерація ID спільноти
   */
  private generateCommunityId(): string {
    return `community_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(COMMUNITIES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        communities?: Community[];
        profiles?: SocialProfile[];
        leaderboards?: CommunityLeaderboard[];
      };
      if (Array.isArray(parsed.communities)) {
        for (const c of parsed.communities) {
          if (!c?.id) continue;
          this.communities.set(c.id, c);
        }
      }
      if (Array.isArray(parsed.profiles)) {
        for (const p of parsed.profiles) {
          if (!p?.userId) continue;
          this.socialProfiles.set(p.userId, p);
        }
      }
      if (Array.isArray(parsed.leaderboards)) {
        for (const lb of parsed.leaderboards) {
          if (!lb?.communityId || !lb?.period) continue;
          this.leaderboards.set(`${lb.communityId}_${lb.period}`, lb);
        }
      }
    } catch {
      return;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        COMMUNITIES_STORAGE_KEY,
        JSON.stringify({
          communities: Array.from(this.communities.values()),
          profiles: Array.from(this.socialProfiles.values()),
          leaderboards: Array.from(this.leaderboards.values()),
        }),
      );
    } catch {
      return;
    }
  }

  /**
   * Отримати статистику системи
   */
  getSystemStats() {
    const allCommunities = Array.from(this.communities.values());
    const allProfiles = Array.from(this.socialProfiles.values());

    return {
      totalCommunities: allCommunities.length,
      publicCommunities: allCommunities.filter(c => c.isPublic).length,
      privateCommunities: allCommunities.filter(c => !c.isPublic).length,
      totalMembers: allCommunities.reduce((sum, c) => sum + c.memberIds.length, 0),
      totalUsers: allProfiles.length,
      totalFriendships: allProfiles.reduce((sum, p) => sum + p.friends.length, 0) / 2, // Кожна дружба рахується двічі
    };
  }
}

// Експорт одиночного екземпляру
export const communityManager = new CommunityManager();
