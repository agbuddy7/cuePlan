import { describe, expect, it } from 'vitest';
import { allocate, budgetFacts, quoteCost, redistribute } from '../src/domain/budget.js';
import { apportion } from '../src/domain/money.js';
import { execute } from '../src/domain/plan.js';
import { categories, occasions, priorities } from '../src/domain/schema.js';
import { input, makePlan, makeQuote, today } from './fixtures.js';

describe('money and allocation invariants', () => {
  it.each([10000, 10101, 97500, 120001, 10000000])(
    'reconciles every priority and occasion at %i rupees',
    (budget) => {
      for (const eventType of occasions)
        for (const priority of priorities) {
          const result = allocate({ ...input, budget, eventType, priority });
          expect(
            Object.values(result.allocations).reduce((a, b) => a + b, 0) + result.reserve,
          ).toBe(budget);
          expect(
            Object.values(result.allocations).every((n) => Number.isSafeInteger(n) && n >= 0),
          ).toBe(true);
        }
    },
  );
  it('distributes remainder fairly with deterministic ties', () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(5, [0, 0])).toEqual([3, 2]);
  });
  it.each([-1, 1.1, NaN])('rejects invalid money %s', (total) => {
    expect(() => apportion(total, [1])).toThrow();
  });
  it('rejects empty or negative weights', () => {
    expect(() => apportion(1, [])).toThrow();
    expect(() => apportion(1, [-1])).toThrow();
  });
  it('enforces minimum billing and extra taxes', () => {
    expect(quoteCost(makeQuote({ minimumGuests: 150, tax: 'extra', taxPercent: 18 }), 120)).toBe(
      70800,
    );
  });
  it('computes fixed quote prices separately from guest count', () => {
    expect(quoteCost(makeQuote({ pricing: 'fixed', amount: 50000 }), 500)).toBe(50000);
  });
});
describe('protected commitments', () => {
  it('locks category allocations during redistribution', () => {
    const plan = makePlan();
    plan.locked = ['venue'];
    const next = redistribute(plan, 'decor', 10000);
    expect(next.venue).toBe(plan.allocations.venue);
    expect(categories.reduce((sum, c) => sum + next[c], 0)).toBe(
      plan.constraints.budget - plan.reserve,
    );
    expect(() => redistribute(plan, 'venue', 1)).toThrow();
  });
  it('protects accepted quotes from manual reallocation', () => {
    const plan = makePlan();
    plan.quotes = [makeQuote({ accepted: true })];
    expect(() => redistribute(plan, 'food', 1)).toThrow();
  });
  it('rejects invalid or unaffordable allocations', () => {
    const plan = makePlan();
    expect(() => redistribute(plan, 'decor', -1)).toThrow();
    expect(() => redistribute(plan, 'decor', 900000)).toThrow();
    plan.locked = ['food', 'venue', 'logistics', 'production'];
    expect(() => redistribute(plan, 'decor', 0)).toThrow();
  });
  it('records and accepts one quote per category', () => {
    let plan = execute(makePlan(), { type: 'recordQuote', quote: makeQuote() }, today);
    expect(plan.quotes[0]?.accepted).toBe(false);
    plan = execute(plan, { type: 'acceptQuote', id: 'q1' }, today);
    expect(budgetFacts(plan).committed).toBe(48000);
    plan = execute(plan, { type: 'recordQuote', quote: makeQuote({ id: 'q2' }) }, today);
    plan = execute(plan, { type: 'acceptQuote', id: 'q2' }, today);
    expect(plan.quotes.filter((q) => q.accepted)).toHaveLength(1);
  });
  it('guest count increases food forecast without silently increasing budget', () => {
    const plan = makePlan();
    const next = execute(
      plan,
      { type: 'updateConstraints', input: { ...input, guests: 200 } },
      today,
    );
    expect(budgetFacts(next).forecast).toBeGreaterThan(budgetFacts(plan).forecast);
    expect(next.constraints.budget).toBe(input.budget);
  });
  it('changing the food allocation sets an explicit new estimated food rate', () => {
    const next = execute(
      makePlan(),
      { type: 'setAllocation', category: 'food', amount: 42000 },
      today,
    );
    expect(next.foodRate).toBe(350);
  });
});
