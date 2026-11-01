import { budgetFacts } from './budget.js';
import { execute, type Command } from './plan.js';
import { schedule } from './workflow.js';
import { categories, type Constraints, type EventPlan } from './schema.js';

export function previewScenario(plan: EventPlan, input: Constraints, today: string) {
  const next = execute(plan, { type: 'updateConstraints', input }, today);
  const before = budgetFacts(plan),
    after = budgetFacts(next);
  return {
    plan: next,
    before,
    after,
    delta: after.forecast - before.forecast,
    changes: categories
      .map((category) => ({
        category,
        before: plan.allocations[category],
        after: next.allocations[category],
      }))
      .filter((row) => row.before !== row.after),
    affectedTasks: schedule(next.tasks, next.constraints.eventDate, today)
      .filter((t) => !t.done && (t.afterEvent || t.overdue))
      .map((t) => t.title),
  };
}
export function tradeoffs(plan: EventPlan, today: string) {
  const facts = budgetFacts(plan);
  if (facts.shortfall === 0) return [];
  const alternatives: { id: string; title: string; command: Command }[] = [
    {
      id: 'trim',
      title: 'Trim flexible categories within a 40% limit',
      command: { type: 'coverGap' },
    },
    {
      id: 'fund',
      title: 'Increase budget to cover forecast and reserve',
      command: {
        type: 'updateConstraints',
        input: {
          ...plan.constraints,
          budget: Math.min(10_000_000, Math.ceil(facts.forecast / 0.9)),
        },
      },
    },
    {
      id: 'guests',
      title: 'Reduce guests by 10%',
      command: {
        type: 'updateConstraints',
        input: {
          ...plan.constraints,
          guests: Math.max(10, Math.floor(plan.constraints.guests * 0.9)),
        },
      },
    },
  ];
  return alternatives
    .flatMap((option) => {
      try {
        const next = execute(plan, option.command, today);
        const after = budgetFacts(next);
        return [{ ...option, plan: next, after, relief: facts.shortfall - after.shortfall }];
      } catch {
        return [];
      }
    })
    .filter((option) => option.relief > 0);
}
