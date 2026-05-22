import type { Difficulty, FriendChallenge } from '../types';

const CHALLENGES_STORAGE_KEY = 'bible-game-friend-challenges-v1';

/**
 * Менеджер викликів друзів
 */
export class FriendChallengeManager {
  private challenges: Map<string, FriendChallenge> = new Map();
  private readonly CHALLENGE_EXPIRY_HOURS = 24; // Виклик діє 24 години

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Створити виклик друга
   */
  createChallenge(
    challengerId: string,
    challengerName: string,
    challengerScore: number,
    challengedId: string,
    challengedName: string,
    options?: {
      themeId?: string;
      difficulty?: Difficulty;
      questions?: string[];
    }
  ): FriendChallenge {
    const id = this.generateChallengeId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000);

    const challenge: FriendChallenge = {
      id,
      challengerId,
      challengerName,
      challengerScore,
      challengedId,
      challengedName,
      status: 'pending',
      themeId: options?.themeId,
      difficulty: options?.difficulty,
      questions: options?.questions || [],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.challenges.set(id, challenge);
    this.saveToStorage();
    return challenge;
  }

  /**
   * Отримати виклик за ID
   */
  getChallenge(id: string): FriendChallenge | undefined {
    return this.challenges.get(id);
  }

  /**
   * Отримати виклики для користувача
   */
  getUserChallenges(userId: string): {
    sent: FriendChallenge[];
    received: FriendChallenge[];
  } {
    const all = Array.from(this.challenges.values());
    
    return {
      sent: all.filter(c => c.challengerId === userId),
      received: all.filter(c => c.challengedId === userId),
    };
  }

  /**
   * Отримати очікуючі виклики
   */
  getPendingChallenges(userId: string): FriendChallenge[] {
    const all = Array.from(this.challenges.values());
    return all.filter(c => 
      c.challengedId === userId && 
      c.status === 'pending' &&
      !this.isExpired(c)
    );
  }

  /**
   * Прийняти виклик
   */
  acceptChallenge(challengeId: string): FriendChallenge | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.status !== 'pending') return null;
    if (this.isExpired(challenge)) return null;

    challenge.status = 'accepted';
    this.challenges.set(challengeId, challenge);
    this.saveToStorage();
    return challenge;
  }

  /**
   * Відхилити виклик
   */
  declineChallenge(challengeId: string): FriendChallenge | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.status !== 'pending') return null;

    challenge.status = 'declined';
    this.challenges.set(challengeId, challenge);
    this.saveToStorage();
    return challenge;
  }

  /**
   * Завершити виклик
   */
  completeChallenge(challengeId: string, challengedScore: number): FriendChallenge | null {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.status !== 'accepted') return null;
    if (this.isExpired(challenge)) return null;

    challenge.status = 'completed';
    challenge.challengedScore = challengedScore;
    challenge.completedAt = new Date().toISOString();
    this.challenges.set(challengeId, challenge);
    this.saveToStorage();
    return challenge;
  }

  /**
   * Видалити виклик
   */
  deleteChallenge(challengeId: string, userId: string): boolean {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return false;
    
    // Тільки викликатель або той, кого викликали, може видалити
    if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
      return false;
    }

    const removed = this.challenges.delete(challengeId);
    if (removed) this.saveToStorage();
    return removed;
  }

  /**
   * Перевірити, чи закінчився термін дії виклику
   */
  private isExpired(challenge: FriendChallenge): boolean {
    return new Date(challenge.expiresAt) < new Date();
  }

  /**
   * Очистити закінчені виклики
   */
  cleanupExpiredChallenges(): number {
    let cleaned = 0;
    for (const [id, challenge] of this.challenges.entries()) {
      if (this.isExpired(challenge) && challenge.status === 'pending') {
        this.challenges.delete(id);
        cleaned++;
      }
    }
    if (cleaned) this.saveToStorage();
    return cleaned;
  }

  /**
   * Отримати історію викликів
   */
  getChallengeHistory(userId: string, limit: number = 10): FriendChallenge[] {
    const all = Array.from(this.challenges.values());
    const userChallenges = all.filter(c => 
      c.challengerId === userId || c.challengedId === userId
    );
    
    return userChallenges
      .filter(c => c.status === 'completed' || c.status === 'declined')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  /**
   * Отримати статистику викликів користувача
   */
  getUserStats(userId: string) {
    const userChallenges = Array.from(this.challenges.values()).filter(c => 
      c.challengerId === userId || c.challengedId === userId
    );

    const completed = userChallenges.filter(c => c.status === 'completed');
    const wins = completed.filter(c => {
      if (c.challengerId === userId) {
        return (c.challengerScore || 0) > (c.challengedScore || 0);
      } else {
        return (c.challengedScore || 0) > (c.challengerScore || 0);
      }
    });

    return {
      totalGames: userChallenges.length,
      completed: completed.length,
      pending: userChallenges.filter(c => c.status === 'pending').length,
      accepted: userChallenges.filter(c => c.status === 'accepted').length,
      declined: userChallenges.filter(c => c.status === 'declined').length,
      wins: wins.length,
      losses: completed.length - wins.length,
      winRate: completed.length > 0 ? Math.round((wins.length / completed.length) * 100) : 0,
    };
  }

  /**
   * Отримати рейтинг друзів
   */
  getFriendsLeaderboard(friendIds: string[]): Array<{
    userId: string;
    wins: number;
    totalGames: number;
    winRate: number;
  }> {
    const stats = friendIds.map(userId => ({
      userId,
      ...this.getUserStats(userId),
    }));

    return stats
      .filter(s => s.totalGames > 0)
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.totalGames - a.totalGames;
      });
  }

  /**
   * Генерація ID виклику
   */
  private generateChallengeId(): string {
    return `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Загальна статистика системи
   */
  getSystemStats() {
    const all = Array.from(this.challenges.values());
    return {
      total: all.length,
      pending: all.filter(c => c.status === 'pending').length,
      accepted: all.filter(c => c.status === 'accepted').length,
      completed: all.filter(c => c.status === 'completed').length,
      declined: all.filter(c => c.status === 'declined').length,
      expired: all.filter(c => this.isExpired(c)).length,
    };
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(CHALLENGES_STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as FriendChallenge[];
      if (!Array.isArray(list)) return;
      for (const c of list) {
        if (!c?.id) continue;
        this.challenges.set(c.id, c);
      }
    } catch {
      return;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        CHALLENGES_STORAGE_KEY,
        JSON.stringify(Array.from(this.challenges.values())),
      );
    } catch {
      return;
    }
  }
}

// Експорт одиночного екземпляру
export const friendChallengeManager = new FriendChallengeManager();
