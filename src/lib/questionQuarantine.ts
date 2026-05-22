import type { Question, QuestionQualityReport, QuestionQuarantine } from '../types';

/**
 * Система управління карантином для проблемних питань
 */
export class QuestionQuarantineManager {
  private quarantinedQuestions: Map<string, QuestionQuarantine> = new Map();
  private qualityReports: Map<string, QuestionQualityReport> = new Map();

  /**
   * Додати питання в карантин
   */
  quarantineQuestion(
    questionId: string,
    reason: string,
    quarantinedBy: string,
    proposedFix?: string
  ): QuestionQuarantine {
    const quarantine: QuestionQuarantine = {
      questionId,
      reason,
      quarantinedAt: new Date().toISOString(),
      quarantinedBy,
      status: 'pending_review',
      proposedFix,
    };

    this.quarantinedQuestions.set(questionId, quarantine);
    return quarantine;
  }

  /**
   * Отримати інформацію про карантин
   */
  getQuarantineInfo(questionId: string): QuestionQuarantine | undefined {
    return this.quarantinedQuestions.get(questionId);
  }

  /**
   * Отримати всі питання в карантині
   */
  getAllQuarantined(): QuestionQuarantine[] {
    return Array.from(this.quarantinedQuestions.values());
  }

  /**
   * Отримати питання в карантині за статусом
   */
  getQuarantinedByStatus(status: QuestionQuarantine['status']): QuestionQuarantine[] {
    return Array.from(this.quarantinedQuestions.values()).filter(q => q.status === status);
  }

  /**
   * Схвалити виправлення питання
   */
  approveFix(questionId: string, _reviewedBy: string): boolean {
    const quarantine = this.quarantinedQuestions.get(questionId);
    if (!quarantine) return false;

    quarantine.status = 'approved_fix';
    // Тут можна додати логіку для застосування виправлення
    return true;
  }

  /**
   * Відхилити питання (видалити з бази)
   */
  rejectQuestion(questionId: string, _reviewedBy: string): boolean {
    const quarantine = this.quarantinedQuestions.get(questionId);
    if (!quarantine) return false;

    quarantine.status = 'rejected';
    return true;
  }

  /**
   * Видалити питання з карантину (після виправлення)
   */
  releaseFromQuarantine(questionId: string): boolean {
    return this.quarantinedQuestions.delete(questionId);
  }

  /**
   * Зберегти звіт про якість
   */
  saveQualityReport(report: QuestionQualityReport): void {
    this.qualityReports.set(report.questionId, report);

    // Якщо статус 'quarantined', автоматично додати в карантин
    if (report.status === 'quarantined') {
      const highSeverityIssues = report.issues.filter(i => i.severity === 'high');
      const reason = highSeverityIssues.length > 0
        ? highSeverityIssues.map(i => i.message).join('; ')
        : 'Низька оцінка якості';

      this.quarantineQuestion(
        report.questionId,
        reason,
        'auto-validator',
        report.issues.filter(i => i.autoFixable).map(i => i.message).join('; ')
      );
    }
  }

  /**
   * Отримати звіт про якість
   */
  getQualityReport(questionId: string): QuestionQualityReport | undefined {
    return this.qualityReports.get(questionId);
  }

  /**
   * Отримати всі звіти про якість
   */
  getAllQualityReports(): QuestionQualityReport[] {
    return Array.from(this.qualityReports.values());
  }

  /**
   * Фільтрувати питання, виключаючи карантинні
   */
  filterValidQuestions(questions: Question[]): Question[] {
    return questions.filter(q => !this.quarantinedQuestions.has(q.id));
  }

  /**
   * Отримати статистику карантину
   */
  getQuarantineStats() {
    const all = Array.from(this.quarantinedQuestions.values());
    return {
      total: all.length,
      pending_review: all.filter(q => q.status === 'pending_review').length,
      approved_fix: all.filter(q => q.status === 'approved_fix').length,
      rejected: all.filter(q => q.status === 'rejected').length,
    };
  }
}

// Експорт одиночного екземпляру
export const questionQuarantineManager = new QuestionQuarantineManager();
