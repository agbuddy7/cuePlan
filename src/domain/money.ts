import { DomainError } from './schema.js';

/** Hamilton apportionment: deterministic ties; every integer rupee is assigned exactly once. */
export function apportion(total: number, weights: readonly number[]): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    weights.length === 0 ||
    weights.some((w) => !Number.isFinite(w) || w < 0)
  )
    throw new DomainError('INVALID_MONEY', 'Use nonnegative integer money and valid weights.');
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => total * (sum === 0 ? 1 / weights.length : w / sum));
  const result = exact.map(Math.floor);
  const remainder = total - result.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const row of order.slice(0, remainder)) result[row.index] = (result[row.index] ?? 0) + 1;
  return result;
}
export function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}
