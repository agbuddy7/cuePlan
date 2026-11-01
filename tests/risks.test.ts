import { expect, it } from 'vitest';
import { assessRisks } from '../src/domain/risks.js';
import { execute } from '../src/domain/plan.js';
import { categories } from '../src/domain/schema.js';
import { makePlan, makeQuote, today } from './fixtures.js';

it('derives financial, timing and commercial risks from current facts', () => {
  const plan = execute(
    makePlan(),
    { type: 'updateTask', id: 'venue', owner: 'Asha', delayDays: 100 },
    today,
  );
  plan.quotes = [makeQuote({ accepted: true, tax: 'unknown', cancellation: '', amount: 1200 })];
  const risks = assessRisks(plan, today);
  expect(risks.map((r) => r.id)).toEqual(
    expect.arrayContaining(['funding', 'venue', 'tax', 'cancellation', 'estimates']),
  );
  expect(assessRisks(makePlan(), '2030-04-01').some((r) => r.title.includes('overdue'))).toBe(true);
});
it('can clear modeled risks after quote confirmation and execution', () => {
  let plan = makePlan();
  plan.quotes = categories.map((category) =>
    makeQuote({ id: category, category, pricing: 'fixed', amount: 1, accepted: true }),
  );
  for (const task of plan.tasks) plan = execute(plan, { type: 'completeTask', id: task.id }, today);
  expect(assessRisks(plan, today)).toEqual([]);
});
