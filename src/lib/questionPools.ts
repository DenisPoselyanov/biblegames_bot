import type { Difficulty, Question } from '../types';
import { questionQuarantineManager } from './questionQuarantine';

/**
 * Типи пулів питань
 */
export type QuestionPoolType = 'study' | 'game' | 'both';

/**
 * Правила відбору для кожного пулу
 */
export interface PoolSelectionRules {
  minQualityScore: number;
  maxAmbiguityScore: number;
  allowedDifficulties: Difficulty[];
  requireReference: boolean;
  requireExplanation: boolean;
  allowQuarantined: boolean;
  maxDuplicatesAllowed: number;
}

/**
 * Конфігурація пулів
 */
export const POOL_CONFIGS: Record<QuestionPoolType, PoolSelectionRules> = {
  study: {
    minQualityScore: 60,
    maxAmbiguityScore: 50,
    allowedDifficulties: ['baby', 'child', 'youth', 'student', 'preacher'],
    requireReference: true,
    requireExplanation: false,
    allowQuarantined: false,
    maxDuplicatesAllowed: 0,
  },
  game: {
    minQualityScore: 50,
    maxAmbiguityScore: 60,
    allowedDifficulties: ['child', 'youth', 'student', 'preacher'],
    requireReference: false,
    requireExplanation: false,
    allowQuarantined: false,
    maxDuplicatesAllowed: 1,
  },
  both: {
    minQualityScore: 60,
    maxAmbiguityScore: 50,
    allowedDifficulties: ['child', 'youth', 'student'],
    requireReference: true,
    requireExplanation: false,
    allowQuarantined: false,
    maxDuplicatesAllowed: 0,
  },
};

/**
 * Менеджер пулів питань
 */
export class QuestionPoolManager {
  private studyPool: Map<string, Question> = new Map();
  private gamePool: Map<string, Question> = new Map();
  private questionMetadata: Map<string, QuestionPoolMetadata> = new Map();

  /**
   * Ініціалізація пулів на основі всіх питань
   */
  initializePools(questions: Question[]): void {
    this.studyPool.clear();
    this.gamePool.clear();
    this.questionMetadata.clear();

    for (const question of questions) {
      this.classifyAndAssign(question);
    }
  }

  /**
   * Автоматична класифікація питання та призначення до пулів
   */
  private classifyAndAssign(question: Question): void {
    const metadata = this.determinePoolMetadata(question);
    this.questionMetadata.set(question.id, metadata);

    // Призначення в пули
    if (metadata.pools.includes('study') || metadata.pools.includes('both')) {
      this.studyPool.set(question.id, question);
    }
    if (metadata.pools.includes('game') || metadata.pools.includes('both')) {
      this.gamePool.set(question.id, question);
    }
  }

  /**
   * Визначення метаданих пулу для питання
   */
  private determinePoolMetadata(question: Question): QuestionPoolMetadata {
    const pools: QuestionPoolType[] = [];
    const reasons: string[] = [];

    // Аналіз якості
    const qualityScore = question.qualityScore ?? 75;
    const ambiguityScore = question.ambiguityScore ?? 30;

    // Аналіз змісту для навчання
    const hasExplanation = !!(question.explanationShort || question.explanationDeep);
    const hasReference = !!question.reference;

    // Правила для study pool
    let studyEligible = true;
    if (qualityScore < POOL_CONFIGS.study.minQualityScore) {
      studyEligible = false;
      reasons.push(`low_quality_score_${qualityScore}`);
    }
    if (ambiguityScore > POOL_CONFIGS.study.maxAmbiguityScore) {
      studyEligible = false;
      reasons.push(`high_ambiguity_${ambiguityScore}`);
    }
    if (!POOL_CONFIGS.study.allowedDifficulties.includes(question.difficulty)) {
      studyEligible = false;
      reasons.push(`difficulty_not_allowed_${question.difficulty}`);
    }
    if (POOL_CONFIGS.study.requireReference && !hasReference) {
      studyEligible = false;
      reasons.push('no_reference');
    }
    // requireExplanation тепер false, тому ця перевірка не потрібна
    if (POOL_CONFIGS.study.requireExplanation && !hasExplanation) {
      studyEligible = false;
      reasons.push('no_explanation');
    }
    const isQuarantined = question.quarantined || !!questionQuarantineManager.getQuarantineInfo(question.id);
    if (isQuarantined) {
      studyEligible = false;
      reasons.push('quarantined');
    }

    // Додам відладку
    if (!studyEligible && reasons.length === 0) {
      reasons.push('study_not_eligible_unknown_reason');
    }

    if (studyEligible) {
      pools.push('study');
      reasons.push('suitable_for_learning');
    }

    // Правила для game pool
    let gameEligible = true;
    if (qualityScore < POOL_CONFIGS.game.minQualityScore) {
      gameEligible = false;
      reasons.push(`low_quality_score_${qualityScore}`);
    }
    if (ambiguityScore > POOL_CONFIGS.game.maxAmbiguityScore) {
      gameEligible = false;
      reasons.push(`high_ambiguity_${ambiguityScore}`);
    }
    if (!POOL_CONFIGS.game.allowedDifficulties.includes(question.difficulty)) {
      gameEligible = false;
      reasons.push(`difficulty_not_allowed_${question.difficulty}`);
    }
    if (isQuarantined) {
      gameEligible = false;
      reasons.push('quarantined');
    }

    if (gameEligible) {
      pools.push('game');
      reasons.push('suitable_for_gaming');
    }

    // Якщо питання підходить для обох пулів
    if (pools.includes('study') && pools.includes('game')) {
      return {
        pools: ['both'],
        primaryPool: 'both',
        classification: 'universal',
        reasons: ['suitable_for_both_modes'],
      };
    }

    return {
      pools: pools.length > 0 ? pools : ['game'], // Default to game if nothing else
      primaryPool: pools.includes('study') ? 'study' : 'game',
      classification: pools.includes('study') ? 'learning_focused' : 'game_focused',
      reasons,
    };
  }

  /**
   * Отримати питання з study pool
   */
  getStudyQuestions(filter?: PoolFilter): Question[] {
    let questions = Array.from(this.studyPool.values());

    if (filter) {
      questions = this.applyFilter(questions, filter);
    }

    return this.shuffleArray(questions);
  }

  /**
   * Отримати питання з game pool
   */
  getGameQuestions(filter?: PoolFilter): Question[] {
    let questions = Array.from(this.gamePool.values());

    if (filter) {
      questions = this.applyFilter(questions, filter);
    }

    return this.shuffleArray(questions);
  }

  /**
   * Отримати питання для конкретного ігрового режиму
   */
  getQuestionsForMode(mode: 'millionaire' | 'survival' | 'kahoot' | 'exploration', count: number = 7): Question[] {
    const rules = this.getModeSpecificRules(mode);
    const pool = mode === 'exploration' ? this.getStudyQuestions() : this.getGameQuestions();
    
    const allowed = rules.allowedDifficulties ?? ['child', 'youth', 'student', 'preacher'];
    let filtered = pool.filter(q => {
      if (!allowed.includes(q.difficulty)) return false;
      if (rules.requireReference && !q.reference) return false;
      return true;
    });

    // Сортування за складністю для певних режимів
    if (mode === 'millionaire') {
      const difficultyOrder: Record<string, number> = { baby: 0, child: 1, youth: 2, student: 3, preacher: 4, teacher: 5, theologian: 6 };
      filtered.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
    }

    return filtered.slice(0, count);
  }

  /**
   * Отримати правила для конкретного режиму гри
   */
  private getModeSpecificRules(mode: string): Partial<PoolSelectionRules> {
    switch (mode) {
      case 'millionaire':
        return {
          allowedDifficulties: ['child', 'youth', 'student', 'preacher'],
          requireReference: false,
        };
      case 'survival':
        return {
          allowedDifficulties: ['child', 'youth', 'student'],
          requireReference: false,
        };
      case 'kahoot':
        return {
          allowedDifficulties: ['child', 'youth'],
          requireReference: false,
        };
      case 'exploration':
        return {
          allowedDifficulties: ['baby', 'child', 'youth', 'student'],
          requireReference: true,
        };
      default:
        return {};
    }
  }

  /**
   * Застосувати фільтр до питань
   */
  private applyFilter(questions: Question[], filter: PoolFilter): Question[] {
    return questions.filter(q => {
      if (filter.themeId && q.themeId !== filter.themeId) return false;
      if (filter.difficulty && q.difficulty !== filter.difficulty) return false;
      if (filter.minQualityScore && (q.qualityScore ?? 0) < filter.minQualityScore) return false;
      if (filter.maxAmbiguityScore && (q.ambiguityScore ?? 0) > filter.maxAmbiguityScore) return false;
      return true;
    });
  }

  /**
   * Перемішування масиву
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Отримати статистику пулів
   */
  getPoolStats(): PoolStats {
    const studyQuestions = Array.from(this.studyPool.values());
    const gameQuestions = Array.from(this.gamePool.values());

    return {
      study: {
        total: studyQuestions.length,
        byDifficulty: this.groupByDifficulty(studyQuestions),
        byTheme: this.groupByTheme(studyQuestions),
      },
      game: {
        total: gameQuestions.length,
        byDifficulty: this.groupByDifficulty(gameQuestions),
        byTheme: this.groupByTheme(gameQuestions),
      },
      overlap: this.calculateOverlap(),
    };
  }

  /**
   * Групування за складністю
   */
  private groupByDifficulty(questions: Question[]): Record<string, number> {
    return questions.reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Групування за темою
   */
  private groupByTheme(questions: Question[]): Record<string, number> {
    return questions.reduce((acc, q) => {
      acc[q.themeId] = (acc[q.themeId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Розрахунок перекриття між пулами
   */
  private calculateOverlap(): number {
    const studyIds = new Set(this.studyPool.keys());
    const gameIds = new Set(this.gamePool.keys());
    
    let overlap = 0;
    for (const id of studyIds) {
      if (gameIds.has(id)) overlap++;
    }
    
    return overlap;
  }

  /**
   * Додати питання в конкретний пул
   */
  addToPool(question: Question, poolType: QuestionPoolType): void {
    switch (poolType) {
      case 'study':
        this.studyPool.set(question.id, question);
        break;
      case 'game':
        this.gamePool.set(question.id, question);
        break;
      case 'both':
        this.studyPool.set(question.id, question);
        this.gamePool.set(question.id, question);
        break;
    }

    // Оновлення метаданих
    const metadata = this.questionMetadata.get(question.id) || {
      pools: [],
      primaryPool: poolType,
      classification: 'manual',
      reasons: ['manually_assigned'],
    };
    
    if (!metadata.pools.includes(poolType)) {
      metadata.pools.push(poolType);
    }
    this.questionMetadata.set(question.id, metadata);
  }

  /**
   * Видалити питання з пулу
   */
  removeFromPool(questionId: string, poolType: QuestionPoolType): void {
    switch (poolType) {
      case 'study':
        this.studyPool.delete(questionId);
        break;
      case 'game':
        this.gamePool.delete(questionId);
        break;
      case 'both':
        this.studyPool.delete(questionId);
        this.gamePool.delete(questionId);
        break;
    }
  }
}

/**
 * Метадані для питання в пулі
 */
interface QuestionPoolMetadata {
  pools: QuestionPoolType[];
  primaryPool: QuestionPoolType;
  classification: 'learning_focused' | 'game_focused' | 'universal' | 'manual';
  reasons: string[];
}

/**
 * Фільтр для вибору питань
 */
export interface PoolFilter {
  themeId?: string;
  difficulty?: Difficulty;
  minQualityScore?: number;
  maxAmbiguityScore?: number;
}

/**
 * Статистика пулів
 */
export interface PoolStats {
  study: {
    total: number;
    byDifficulty: Record<string, number>;
    byTheme: Record<string, number>;
  };
  game: {
    total: number;
    byDifficulty: Record<string, number>;
    byTheme: Record<string, number>;
  };
  overlap: number;
}

// Експорт одиночного екземпляру
export const questionPoolManager = new QuestionPoolManager();