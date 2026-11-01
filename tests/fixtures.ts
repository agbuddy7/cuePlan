import { createPlan } from '../src/domain/plan.js';
import { type Quote } from '../src/domain/schema.js';
export const today = '2030-01-01';
export const input = {
  eventType: 'community-fest' as const,
  budget: 120000,
  guests: 120,
  eventDate: '2030-03-01',
  priority: 'balanced' as const,
};
export const makePlan = () => createPlan(input, today, 'test-event');
export const makeQuote = (patch: Partial<Quote> = {}): Quote => ({
  id: 'q1',
  category: 'food',
  vendor: 'Community Kitchen',
  pricing: 'per-guest',
  amount: 400,
  minimumGuests: 0,
  tax: 'included',
  taxPercent: 0,
  depositPercent: 25,
  cancellation: 'Refund before 14 days',
  notes: 'Vegetarian buffet',
  accepted: false,
  ...patch,
});
