import { allocate, budgetFacts, redistribute } from './budget.js';
import { apportion } from './money.js';
import { daysBetween } from './calendar.js';
import { assertGraph, createTasks } from './workflow.js';
import {
  categories,
  constraintsSchema,
  DomainError,
  planSchema,
  quoteSchema,
  taskSchema,
  type Category,
  type Constraints,
  type EventPlan,
  type Quote,
} from './schema.js';

export type Command =
  | { type: 'updateConstraints'; input: Constraints }
  | { type: 'setAllocation'; category: Category; amount: number }
  | { type: 'toggleLock'; category: Category }
  | { type: 'recordQuote'; quote: Quote }
  | { type: 'acceptQuote'; id: string }
  | { type: 'removeQuote'; id: string }
  | { type: 'coverGap' }
  | { type: 'completeTask'; id: string }
  | { type: 'updateTask'; id: string; owner: string; delayDays: number };

export function validatePlan(raw: unknown): EventPlan {
  const plan = planSchema.parse(raw);
  assertGraph(plan.tasks);
  if (plan.tasks.length === 0)
    throw new DomainError('EMPTY_WORKFLOW', 'A plan requires execution tasks.');
  if (new Set(plan.quotes.map((q) => q.id)).size !== plan.quotes.length)
    throw new DomainError('DUPLICATE_QUOTE', 'Quote identifiers must be unique.');
  for (const category of categories) {
    if (plan.quotes.filter((q) => q.category === category).length > 3)
      throw new DomainError('QUOTE_LIMIT', 'Compare up to three quotes per category.');
    if (plan.quotes.filter((q) => q.accepted && q.category === category).length > 1)
      throw new DomainError('MULTIPLE_ACCEPTED_QUOTES', 'Accept one quote per category.');
  }
  if (
    Object.values(plan.allocations).reduce((a, b) => a + b, 0) + plan.reserve !==
    plan.constraints.budget
  )
    throw new DomainError(
      'BUDGET_MISMATCH',
      'Allocations and reserve must reconcile to the budget.',
    );
  return plan;
}
export function createPlan(raw: Constraints, today: string, id: string): EventPlan {
  const constraints = constraintsSchema.parse(raw);
  const days = daysBetween(today, constraints.eventDate);
  if (days < 0 || days > 730)
    throw new DomainError('EVENT_DATE_RANGE', 'Choose an event within the next 730 days.');
  const budget = allocate(constraints);
  return validatePlan({
    version: 2,
    id,
    revision: 0,
    constraints,
    ...budget,
    foodRate: budget.allocations.food / constraints.guests,
    locked: [],
    quotes: [],
    tasks: createTasks(constraints, today),
  });
}
export function execute(plan: EventPlan, command: Command, today: string): EventPlan {
  let next: EventPlan;
  switch (command.type) {
    case 'updateConstraints': {
      const fresh = createPlan(command.input, today, plan.id);
      const protectedSet = new Set([
        ...plan.locked,
        ...plan.quotes.filter((q) => q.accepted).map((q) => q.category),
      ]);
      const fixed = categories.filter((c) => protectedSet.has(c));
      const flexible = categories.filter((c) => !protectedSet.has(c));
      const pool =
        fresh.constraints.budget -
        fresh.reserve -
        fixed.reduce((sum, c) => sum + plan.allocations[c], 0);
      if (pool < 0 || (!flexible.length && pool !== 0))
        throw new DomainError(
          'PROTECTED_BUDGET',
          'The new budget cannot fund protected category allocations. Unlock a category or adjust the budget.',
        );
      const amounts = flexible.length
        ? apportion(
            pool,
            flexible.map((c) => fresh.allocations[c]),
          )
        : [];
      const allocations = { ...plan.allocations };
      flexible.forEach((c, i) => {
        allocations[c] = amounts[i] ?? 0;
      });
      next = { ...plan, constraints: fresh.constraints, reserve: fresh.reserve, allocations };
      break;
    }
    case 'setAllocation':
      next = {
        ...plan,
        allocations: redistribute(plan, command.category, command.amount),
        foodRate:
          command.category === 'food' ? command.amount / plan.constraints.guests : plan.foodRate,
      };
      break;
    case 'coverGap': {
      const facts = budgetFacts(plan);
      const sources = categories.filter(
        (category) =>
          !plan.locked.includes(category) &&
          !plan.quotes.some((q) => q.accepted && q.category === category) &&
          category !== 'food' &&
          !facts.rows.some((row) => row.category === category && row.shortfall > 0),
      );
      const capacity = sources.reduce(
        (sum, category) => sum + Math.floor(plan.allocations[category] * 0.4),
        0,
      );
      if (facts.shortfall === 0 || capacity < facts.shortfall)
        throw new DomainError(
          'NO_FLEXIBLE_OPTION',
          'Flexible categories cannot fund this gap within the 40% trim limit.',
        );
      const cuts = apportion(
        facts.shortfall,
        sources.map((c) => Math.floor(plan.allocations[c] * 0.4)),
      );
      const allocations = { ...plan.allocations };
      sources.forEach((c, i) => {
        allocations[c] -= cuts[i] ?? 0;
      });
      const funding = apportion(
        facts.shortfall,
        facts.rows.map((row) => row.shortfall),
      );
      facts.rows.forEach((row, index) => {
        allocations[row.category] += funding[index] ?? 0;
      });
      next = { ...plan, allocations };
      break;
    }
    case 'toggleLock':
      next = {
        ...plan,
        locked: plan.locked.includes(command.category)
          ? plan.locked.filter((c) => c !== command.category)
          : [...plan.locked, command.category],
      };
      break;
    case 'recordQuote': {
      const quote = quoteSchema.parse(command.quote);
      if (plan.quotes.some((q) => q.id === quote.id))
        throw new DomainError('DUPLICATE_QUOTE', 'This quote already exists.');
      if (plan.quotes.filter((q) => q.category === quote.category).length >= 3)
        throw new DomainError('QUOTE_LIMIT', 'Compare up to three quotes per category.');
      next = { ...plan, quotes: [...plan.quotes, { ...quote, accepted: false }] };
      break;
    }
    case 'acceptQuote': {
      const target = plan.quotes.find((q) => q.id === command.id);
      if (!target) throw new DomainError('QUOTE_NOT_FOUND', 'Choose a recorded quote.');
      next = {
        ...plan,
        quotes: plan.quotes.map((q) =>
          q.category === target.category ? { ...q, accepted: q.id === target.id } : q,
        ),
      };
      break;
    }
    case 'removeQuote':
      next = { ...plan, quotes: plan.quotes.filter((q) => q.id !== command.id) };
      break;
    case 'completeTask': {
      if (!plan.tasks.some((t) => t.id === command.id))
        throw new DomainError('TASK_NOT_FOUND', 'Choose an existing task.');
      next = {
        ...plan,
        tasks: plan.tasks.map((t) => (t.id === command.id ? { ...t, done: true } : t)),
      };
      break;
    }
    case 'updateTask': {
      if (!plan.tasks.some((t) => t.id === command.id))
        throw new DomainError('TASK_NOT_FOUND', 'Choose an existing task.');
      next = {
        ...plan,
        tasks: plan.tasks.map((t) =>
          t.id === command.id
            ? taskSchema.parse({ ...t, owner: command.owner, delayDays: command.delayDays })
            : t,
        ),
      };
      break;
    }
  }
  return validatePlan({ ...next, revision: plan.revision + 1 });
}
