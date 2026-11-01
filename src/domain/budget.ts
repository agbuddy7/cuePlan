import { apportion } from './money.js';
import {
  categories,
  type Allocation,
  type Category,
  type Constraints,
  type EventPlan,
  type Quote,
  DomainError,
} from './schema.js';

const presets: Record<Constraints['eventType'], readonly number[]> = {
  'community-fest': [22, 35, 15, 10, 8],
  birthday: [15, 35, 15, 20, 5],
  wedding: [25, 40, 10, 10, 5],
  fundraiser: [15, 30, 20, 5, 20],
  workshop: [25, 30, 20, 5, 10],
};
const shifts: Record<Constraints['priority'], readonly number[]> = {
  balanced: [0, 0, 0, 0, 0],
  food: [-2, 8, -2, -4, 0],
  experience: [-4, -4, 5, 5, -2],
  reach: [-3, 0, 3, -4, 4],
  comfort: [5, -2, -3, -4, 4],
};
export function allocate(constraints: Constraints): { allocations: Allocation; reserve: number } {
  const reserve = Math.round(constraints.budget * 0.1);
  const weights = presets[constraints.eventType].map(
    (weight, i) => weight + (shifts[constraints.priority][i] ?? 0),
  );
  const amounts = apportion(constraints.budget - reserve, weights);
  return {
    reserve,
    allocations: {
      venue: amounts[0] ?? 0,
      food: amounts[1] ?? 0,
      production: amounts[2] ?? 0,
      decor: amounts[3] ?? 0,
      logistics: amounts[4] ?? 0,
    },
  };
}
export function quoteCost(quote: Quote, guests: number): number {
  const base =
    quote.amount * (quote.pricing === 'per-guest' ? Math.max(guests, quote.minimumGuests) : 1);
  return Math.round(base * (quote.tax === 'extra' ? 1 + quote.taxPercent / 100 : 1));
}
export function budgetFacts(plan: EventPlan) {
  const rows = categories.map((category) => {
    const quote = plan.quotes.find((q) => q.category === category && q.accepted);
    const amount = quote
      ? quoteCost(quote, plan.constraints.guests)
      : category === 'food'
        ? Math.round(plan.foodRate * plan.constraints.guests)
        : plan.allocations[category];
    return {
      category,
      amount,
      quoted: !!quote,
      shortfall: Math.max(0, amount - plan.allocations[category]),
      taxUnknown: quote?.tax === 'unknown',
    };
  });
  const committed = rows.filter((row) => row.quoted).reduce((sum, row) => sum + row.amount, 0);
  const forecast = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    rows,
    committed,
    forecast,
    remaining: plan.constraints.budget - plan.reserve - forecast,
    shortfall: Math.max(0, forecast + plan.reserve - plan.constraints.budget),
    confirmedCategories: rows.filter((row) => row.quoted).length,
  };
}
export function redistribute(plan: EventPlan, category: Category, amount: number): Allocation {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new DomainError('INVALID_AMOUNT', 'Enter a nonnegative whole-rupee allocation.');
  const protectedCategories = new Set([
    ...plan.locked,
    ...plan.quotes.filter((q) => q.accepted).map((q) => q.category),
  ]);
  if (protectedCategories.has(category))
    throw new DomainError(
      'PROTECTED_CATEGORY',
      'Unlock this category and release accepted quotes before adjusting it.',
    );
  const flexible = categories.filter((c) => c !== category && !protectedCategories.has(c));
  const pool =
    flexible.reduce((sum, c) => sum + plan.allocations[c], 0) + plan.allocations[category];
  if (amount > pool || (flexible.length === 0 && amount !== pool))
    throw new DomainError(
      'INSUFFICIENT_FLEXIBLE_BUDGET',
      'The requested amount exceeds the flexible budget.',
    );
  const next = { ...plan.allocations, [category]: amount };
  const amounts = flexible.length
    ? apportion(
        pool - amount,
        flexible.map((c) => plan.allocations[c]),
      )
    : [];
  flexible.forEach((c, i) => {
    next[c] = amounts[i] ?? 0;
  });
  return next;
}
