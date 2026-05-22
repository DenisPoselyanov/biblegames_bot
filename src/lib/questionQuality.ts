import type { Difficulty, QualityIssue, Question, QuestionQualityReport } from '../types';

/**
 * Система валідації та оцінки якості питань
 */
export class QuestionQualityValidator {
  private similarityThreshold = 0.85; // Поріг схожості для дублікатів

  /**
   * Повна валідація питання з генерацією звіту якості
   */
  validateQuestion(question: Question, allQuestions: Question[]): QuestionQualityReport {
    const issues: QualityIssue[] = [];
    let ambiguityScore = 0;
    let qualityScore = 100;

    // 1. Перевірка на дублікати
    const duplicateIds = this.findDuplicates(question, allQuestions);
    if (duplicateIds.length > 0) {
      issues.push({
        type: 'duplicate',
        severity: 'high',
        message: `Знайдено ${duplicateIds.length} подібних питань`,
        autoFixable: false,
      });
      qualityScore -= 20 * duplicateIds.length;
    }

    // 2. Перевірка на однозначність
    ambiguityScore = this.calculateAmbiguityScore(question);
    if (ambiguityScore > 50) {
      issues.push({
        type: 'ambiguous',
        severity: 'medium',
        message: `Питання має високий рівень неоднозначності (${ambiguityScore}/100)`,
        autoFixable: false,
      });
      qualityScore -= 15;
    }

    // 3. Перевірка посилання
    if (!question.reference || question.reference.trim().length === 0) {
      issues.push({
        type: 'unclear_reference',
        severity: 'low',
        message: 'Відсутнє біблійне посилання',
        autoFixable: false,
      });
      qualityScore -= 5;
    }

    // 4. Перевірка відповідності складності
    const difficultyMismatch = this.validateDifficulty(question);
    if (difficultyMismatch) {
      issues.push({
        type: 'wrong_difficulty',
        severity: 'medium',
        message: difficultyMismatch,
        autoFixable: true,
      });
      qualityScore -= 10;
    }

    // 5. Перевірка на одруківки
    const typos = this.detectTypos(question);
    if (typos.length > 0) {
      issues.push({
        type: 'typo',
        severity: 'low',
        message: `Знайдено можливі одруківки: ${typos.join(', ')}`,
        autoFixable: true,
      });
      qualityScore -= typos.length * 2;
    }

    // 6. Теологічна перевірка (базова)
    const theologicalIssues = this.validateTheologicalContent(question);
    issues.push(...theologicalIssues);
    qualityScore -= theologicalIssues.length * 15;

    // Визначення статусу
    let status: 'pending' | 'approved' | 'rejected' | 'quarantined' = 'pending';
    if (qualityScore >= 80 && issues.filter(i => i.severity === 'high').length === 0) {
      status = 'approved';
    } else if (qualityScore < 50 || issues.filter(i => i.severity === 'high').length > 0) {
      status = 'quarantined';
    }

    return {
      questionId: question.id,
      status,
      ambiguityScore,
      qualityScore: Math.max(0, qualityScore),
      duplicateIds,
      issues,
      reviewedAt: new Date().toISOString(),
    };
  }

  /**
   * Пошук дублікатів питань
   */
  private findDuplicates(question: Question, allQuestions: Question[]): string[] {
    const duplicates: string[] = [];

    for (const other of allQuestions) {
      if (other.id === question.id) continue;

      // Порівняння тексту питань
      const textSimilarity = this.calculateTextSimilarity(question.text, other.text);
      if (textSimilarity > this.similarityThreshold) {
        duplicates.push(other.id);
        continue;
      }

      // Порівняння варіантів відповідей
      const optionsSimilarity = this.calculateOptionsSimilarity(question.options, other.options);
      if (textSimilarity > 0.6 && optionsSimilarity > this.similarityThreshold) {
        duplicates.push(other.id);
      }
    }

    return duplicates;
  }

  /**
   * Розрахунок коефіцієнта схожості текстів
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = this.normalizeText(text1);
    const words2 = this.normalizeText(text2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];

    return intersection.length / union.length;
  }

  /**
   * Нормалізація тексту для порівняння
   */
  private normalizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sа-яґєії]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Порівняння варіантів відповідей
   */
  private calculateOptionsSimilarity(options1: string[], options2: string[]): number {
    if (options1.length !== options2.length) return 0;

    let matchCount = 0;
    for (const opt1 of options1) {
      for (const opt2 of options2) {
        if (this.calculateTextSimilarity(opt1, opt2) > 0.9) {
          matchCount++;
          break;
        }
      }
    }

    return matchCount / options1.length;
  }

  /**
   * Розрахунок оцінки неоднозначності питання
   */
  private calculateAmbiguityScore(question: Question): number {
    let score = 0;

    // Перевірка на розмиті формулювання
    const vagueWords = ['десь', 'колись', 'можливо', 'ймовірно', 'близько', 'приблизно'];
    const text = question.text.toLowerCase();
    vagueWords.forEach(word => {
      if (text.includes(word)) score += 10;
    });

    // Перевірка на занадто схожі варіанти відповідей
    for (let i = 0; i < question.options.length; i++) {
      for (let j = i + 1; j < question.options.length; j++) {
        const similarity = this.calculateTextSimilarity(question.options[i], question.options[j]);
        if (similarity > 0.6) score += 15;
      }
    }

    // Перевірка на відсутність конкретних деталей
    if (question.text.length < 20) score += 10;
    if (!question.reference) score += 5;

    return Math.min(100, score);
  }

  /**
   * Валідація відповідності складності
   */
  private validateDifficulty(question: Question): string | null {
    const textLength = question.text.length;
    const optionsLength = question.options.join(' ').length;

    switch (question.difficulty) {
      case 'beginner':
        if (textLength > 50) return 'Питання для початківців занадто довге';
        if (optionsLength > 80) return 'Варіанти відповідей занадто складні для початківців';
        break;
      case 'expert':
        if (textLength < 30) return 'Питання для експертів занадто коротке';
        if (optionsLength < 50) return 'Варіанти відповідей занадто прості для експертів';
        break;
    }

    return null;
  }

  /**
   * Виявлення можливих одруківок
   */
  private detectTypos(question: Question): string[] {
    const typos: string[] = [];

    const allText = [question.text, ...question.options].join(' ').toLowerCase();
    
    // Проста перевірка на повторені літери
    const repeatedLetters = allText.match(/([а-яґєії])\1{2,}/g);
    if (repeatedLetters) {
      typos.push(...repeatedLetters);
    }

    return typos;
  }

  /**
   * Базова теологічна валідація
   */
  private validateTheologicalContent(question: Question): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Перевірка на суперечливі твердження (базова)
    const contradictoryPatterns = [
      /ісус.*не.*син.*бог/i,
      /бог.*не.*існує/i,
      /біблія.*не.*істина/i,
    ];

    for (const pattern of contradictoryPatterns) {
      if (pattern.test(question.text)) {
        issues.push({
          type: 'theological_error',
          severity: 'high',
          message: 'Містить теологічне супереччя',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * Автоматичне калібрування складності на основі статистики відповідей
   */
  calibrateDifficulty(
    question: Question,
    correctRate: number,
    avgResponseTime: number
  ): Difficulty {
    // Якщо правильних відповідей > 80%, знизити складність
    if (correctRate > 0.8 && avgResponseTime < 5000) {
      const currentLevel = this.getDifficultyLevel(question.difficulty);
      if (currentLevel > 0) {
        return this.getDifficultyByLevel(currentLevel - 1);
      }
    }

    // Якщо правильних відповідей < 30%, підвищити складність
    if (correctRate < 0.3) {
      const currentLevel = this.getDifficultyLevel(question.difficulty);
      if (currentLevel < 4) {
        return this.getDifficultyByLevel(currentLevel + 1);
      }
    }

    return question.difficulty;
  }

  private getDifficultyLevel(difficulty: Difficulty): number {
    const levels: Record<Difficulty, number> = {
      beginner: 0,
      easy: 1,
      medium: 2,
      hard: 3,
      expert: 4,
    };
    return levels[difficulty];
  }

  private getDifficultyByLevel(level: number): Difficulty {
    const levels: Difficulty[] = ['beginner', 'easy', 'medium', 'hard', 'expert'];
    return levels[level];
  }
}

// Експорт одиночого екземпляру
export const questionQualityValidator = new QuestionQualityValidator();
