/**
 * AI job budgets (Phase 4 §8.2) — hard stops, not soft warnings.
 *
 * A budget tracks usage across the calls a single job makes and reports
 * `exceeded` once any configured limit is hit. The job handler is expected to
 * checkpoint `BudgetTracker.usage()` and stop issuing new provider calls when
 * `exceeded()` is true, rather than let a batch job run unbounded (§8.2 "no
 * infinite retries", "per-job and global budgets").
 */
import type { AiUsage } from './types';

export interface AiBudget {
  maxRequests?: number;
  maxTokens?: number;
  maxCostUsd?: number;
}

export interface AiBudgetUsage {
  requests: number;
  tokens: number;
  costUsd: number;
}

export class BudgetTracker {
  private readonly budget: AiBudget;
  private requests = 0;
  private tokens = 0;
  private costUsd = 0;

  constructor(budget: AiBudget, initial?: Partial<AiBudgetUsage>) {
    this.budget = budget;
    this.requests = initial?.requests ?? 0;
    this.tokens = initial?.tokens ?? 0;
    this.costUsd = initial?.costUsd ?? 0;
  }

  /** Record one completed call's usage/cost. */
  record(usage?: AiUsage, costEstimate?: number): void {
    this.requests += 1;
    this.tokens += usage?.totalTokens ?? 0;
    this.costUsd += costEstimate ?? 0;
  }

  usage(): AiBudgetUsage {
    return { requests: this.requests, tokens: this.tokens, costUsd: this.costUsd };
  }

  /** True once any configured limit has been reached or passed. */
  exceeded(): boolean {
    const { maxRequests, maxTokens, maxCostUsd } = this.budget;
    if (maxRequests !== undefined && this.requests >= maxRequests) return true;
    if (maxTokens !== undefined && this.tokens >= maxTokens) return true;
    if (maxCostUsd !== undefined && this.costUsd >= maxCostUsd) return true;
    return false;
  }
}
