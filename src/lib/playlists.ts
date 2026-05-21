import type { Playlist, Question, Theme } from '../types';

/**
 * Менеджер плейлистів для Kahoot
 */
export class PlaylistManager {
  private playlists: Map<string, Playlist> = new Map();

  /**
   * Створити новий плейлист
   */
  createPlaylist(
    name: string,
    description: string,
    creatorId: string,
    creatorName: string,
    questions: string[],
    isPublic: boolean = false
  ): Playlist {
    const id = this.generatePlaylistId();
    
    // Визначаємо теми на основі питань
    const themes = this.extractThemesFromQuestions(questions);

    const playlist: Playlist = {
      id,
      name,
      description,
      creatorId,
      creatorName,
      questions,
      themes,
      isPublic,
      plays: 0,
      likes: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.playlists.set(id, playlist);
    return playlist;
  }

  /**
   * Отримати плейлист за ID
   */
  getPlaylist(id: string): Playlist | undefined {
    return this.playlists.get(id);
  }

  /**
   * Отримати всі плейлисти користувача
   */
  getUserPlaylists(userId: string): Playlist[] {
    return Array.from(this.playlists.values()).filter(p => p.creatorId === userId);
  }

  /**
   * Отримати публічні плейлисти
   */
  getPublicPlaylists(): Playlist[] {
    return Array.from(this.playlists.values()).filter(p => p.isPublic);
  }

  /**
   * Отримати популярні плейлисти
   */
  getTrendingPlaylists(limit: number = 10): Playlist[] {
    return this.getPublicPlaylists()
      .sort((a, b) => b.plays - a.plays)
      .slice(0, limit);
  }

  /**
   * Оновити плейлист
   */
  updatePlaylist(id: string, updates: Partial<Omit<Playlist, 'id' | 'creatorId' | 'createdAt'>>): Playlist | null {
    const playlist = this.playlists.get(id);
    if (!playlist) return null;

    const updated = {
      ...playlist,
      ...updates,
      id: playlist.id, // Забезпечуємо незмінність ID
      creatorId: playlist.creatorId, // Забезпечуємо незмінність creatorId
      createdAt: playlist.createdAt, // Забезпечуємо незмінність createdAt
      updatedAt: new Date().toISOString(),
      // Якщо оновлюються питання, перераховуємо теми
      themes: updates.questions ? this.extractThemesFromQuestions(updates.questions) : playlist.themes,
    };

    this.playlists.set(id, updated);
    return updated;
  }

  /**
   * Видалити плейлист
   */
  deletePlaylist(id: string, userId: string): boolean {
    const playlist = this.playlists.get(id);
    if (!playlist || playlist.creatorId !== userId) return false;
    return this.playlists.delete(id);
  }

  /**
   * Лайкнути плейлист
   */
  likePlaylist(id: string): boolean {
    const playlist = this.playlists.get(id);
    if (!playlist) return false;

    playlist.likes++;
    playlist.updatedAt = new Date().toISOString();
    this.playlists.set(id, playlist);
    return true;
  }

  /**
   * Зареєструвати гру плейлисту
   */
  registerPlay(id: string): boolean {
    const playlist = this.playlists.get(id);
    if (!playlist) return false;

    playlist.plays++;
    playlist.updatedAt = new Date().toISOString();
    this.playlists.set(id, playlist);
    return true;
  }

  /**
   * Пошук плейлистів
   */
  searchPlaylists(query: string, filters?: {
    themeId?: string;
    minPlays?: number;
    creatorId?: string;
  }): Playlist[] {
    let results = this.getPublicPlaylists();

    // Текстовий пошук
    if (query) {
      const lowerQuery = query.toLowerCase();
      results = results.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery)
      );
    }

    // Фільтри
    if (filters?.themeId) {
      results = results.filter(p => p.themes.includes(filters.themeId));
    }
    if (filters?.minPlays) {
      results = results.filter(p => p.plays >= filters.minPlays);
    }
    if (filters?.creatorId) {
      results = results.filter(p => p.creatorId === filters.creatorId);
    }

    return results.sort((a, b) => b.plays - a.plays);
  }

  /**
   * Отримати плейлисти за темою
   */
  getPlaylistsByTheme(themeId: string): Playlist[] {
    return this.getPublicPlaylists().filter(p => p.themes.includes(themeId));
  }

  /**
   * Генерація ID плейлисту
   */
  private generatePlaylistId(): string {
    return `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Видобуття тем з питань (потрібна база питань)
   */
  private extractThemesFromQuestions(questionIds: string[]): string[] {
    // Це заглушка - в реальному коді потрібно мати доступ до бази питань
    // Для демо повернемо порожній масив
    return [];
    
    // В реальному коді:
    // const questions = questionIds.map(id => getQuestionById(id)).filter(Boolean);
    // const themes = new Set(questions.map(q => q.themeId));
    // return Array.from(themes);
  }

  /**
   * Валідація плейлисту
   */
  validatePlaylist(playlist: Partial<Playlist>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!playlist.name || playlist.name.trim().length === 0) {
      errors.push('Назва плейлисту обов\'язкова');
    }
    if (!playlist.description || playlist.description.trim().length === 0) {
      errors.push('Опис плейлисту обов\'язковий');
    }
    if (!playlist.questions || playlist.questions.length === 0) {
      errors.push('Плейлист повинен містити хоча б одне питання');
    }
    if (playlist.questions && playlist.questions.length > 100) {
      errors.push('Плейлист не може містити більше 100 питань');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Статистика плейлистів
   */
  getStats() {
    const all = Array.from(this.playlists.values());
    return {
      total: all.length,
      public: all.filter(p => p.isPublic).length,
      private: all.filter(p => !p.isPublic).length,
      totalPlays: all.reduce((sum, p) => sum + p.plays, 0),
      totalLikes: all.reduce((sum, p) => sum + p.likes, 0),
    };
  }
}

// Експорт одиночного екземпляру
export const playlistManager = new PlaylistManager();