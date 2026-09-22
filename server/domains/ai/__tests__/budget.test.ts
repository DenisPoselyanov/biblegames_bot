import { describe, expect, it } from 'vitest';
import { BudgetTracker } from '../budget';

describe('BudgetTracker (§8.2)', () => {
  it('is not exceeded with no usage and a configured limit', () => {
    const tracker = new BudgetTracker({ maxRequests: 3 });
    expect(tracker.exceeded()).toBe(false);
    expect(tracker.usage()).toEqual({ requests: 0, tokens: 0, costUsd: 0 });
  });

  it('trips on maxRequests', () => {
    const tracker = new BudgetTracker({ maxRequests: 2 });
    tracker.record();
    expect(tracker.exceeded()).toBe(false);
    tracker.record();
    expect(tracker.exceeded()).toBe(true);
  });

  it('trips on maxTokens', () => {
    const tracker = new BudgetTracker({ maxTokens: 100 });
    tracker.record({ totalTokens: 60 });
    expect(tracker.exceeded()).toBe(false);
    tracker.record({ totalTokens: 50 });
    expect(tracker.exceeded()).toBe(true);
    expect(tracker.usage().tokens).toBe(110);
  });

  it('trips on maxCostUsd', () => {
    const tracker = new BudgetTracker({ maxCostUsd: 1 });
    tracker.record(undefined, 0.6);
    expect(tracker.exceeded()).toBe(false);
    tracker.record(undefined, 0.5);
    expect(tracker.exceeded()).toBe(true);
  });

  it('resumes from a prior checkpointed usage instead of restarting at zero', () => {
    const tracker = new BudgetTracker({ maxRequests: 2 }, { requests: 1 });
    expect(tracker.exceeded()).toBe(false);
    tracker.record();
    expect(tracker.exceeded()).toBe(true);
  });

  it('has no limit when the budget configures none', () => {
    const tracker = new BudgetTracker({});
    for (let i = 0; i < 1000; i++) tracker.record({ totalTokens: 1000 }, 100);
    expect(tracker.exceeded()).toBe(false);
  });
});
