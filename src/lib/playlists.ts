import type { Difficulty, Playlist } from '../types';
import { ALL_QUESTIONS } from '../data/questions';

const PLAYLISTS_STORAGE_KEY = 'bible-game-playlists-v1';

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Менеджер плейлистів для Kahoot
 */
export class PlaylistManager {
  private playlists: Map<string, Playlist> = new Map();

  constructor() {
    this.loadFromStorage();
  }

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
    this.saveToStorage();
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
    this.saveToStorage();
    return updated;
  }

  /**
   * Видалити плейлист
   */
  deletePlaylist(id: string, userId: string): boolean {
    const playlist = this.playlists.get(id);
    if (!playlist || playlist.creatorId !== userId) return false;
    const removed = this.playlists.delete(id);
    if (removed) this.saveToStorage();
    return removed;
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
    this.saveToStorage();
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
    this.saveToStorage();
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
    const themeFilter = filters?.themeId;
    if (themeFilter) {
      results = results.filter(p => p.themes.includes(themeFilter));
    }
    const minPlaysFilter = filters?.minPlays;
    if (minPlaysFilter) {
      results = results.filter(p => p.plays >= minPlaysFilter);
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
    const map = new Map<string, string>();
    for (const q of ALL_QUESTIONS) map.set(q.id, q.themeId);
    const themes = new Set<string>();
    for (const id of questionIds) {
      const themeId = map.get(id);
      if (themeId) themes.add(themeId);
    }
    return [...themes];
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

  pickQuestionsForPlaylist(params: {
    themeIds: string[];
    difficulty?: Difficulty;
    count: number;
  }): string[] {
    const ids = new Set<string>();
    const difficulty = params.difficulty;
    const pool = ALL_QUESTIONS.filter(
      (q) => params.themeIds.includes(q.themeId) && (!difficulty || q.difficulty === difficulty),
    );
    for (const q of shuffle(pool)) {
      ids.add(q.id);
      if (ids.size >= Math.min(100, Math.max(1, params.count))) break;
    }
    return [...ids];
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as Playlist[];
      if (!Array.isArray(list)) return;
      for (const p of list) {
        if (!p?.id || !p?.creatorId) continue;
        this.playlists.set(p.id, p);
      }
    } catch {
      return;
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        PLAYLISTS_STORAGE_KEY,
        JSON.stringify(Array.from(this.playlists.values())),
      );
    } catch {
      return;
    }
  }
}

// Експорт одиночного екземпляру
export const playlistManager = new PlaylistManager();
