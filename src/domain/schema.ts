import { z } from 'zod';

export const categories = ['venue', 'food', 'production', 'decor', 'logistics'] as const;
export const occasions = [
  'community-fest',
  'birthday',
  'wedding',
  'fundraiser',
  'workshop',
] as const;
export const priorities = ['balanced', 'food', 'experience', 'reach', 'comfort'] as const;
export const categorySchema = z.enum(categories);
export const moneySchema = z.number().int().min(0).max(10_000_000);
export const dateSchema = z.iso.date();
export const constraintsSchema = z.object({
  eventType: z.enum(occasions),
  budget: moneySchema.min(10_000),
  guests: z.number().int().min(10).max(5000),
  eventDate: dateSchema,
  priority: z.enum(priorities),
});
export const quoteSchema = z.object({
  id: z.string().min(1).max(80),
  category: categorySchema,
  vendor: z.string().trim().min(1).max(120),
  pricing: z.enum(['fixed', 'per-guest']),
  amount: moneySchema.min(1),
  minimumGuests: z.number().int().min(0).max(5000),
  tax: z.enum(['included', 'extra', 'unknown']),
  taxPercent: z.number().min(0).max(100),
  depositPercent: z.number().min(0).max(100),
  cancellation: z.string().max(500),
  notes: z.string().max(1000),
  accepted: z.boolean(),
});
export const taskSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  owner: z.string().trim().min(1).max(80),
  leadDays: z.number().int().min(0).max(730),
  dependsOn: z.array(z.string().max(80)).max(20),
  done: z.boolean(),
  delayDays: z.number().int().min(0).max(365),
});
export const allocationSchema = z.object({
  venue: moneySchema,
  food: moneySchema,
  production: moneySchema,
  decor: moneySchema,
  logistics: moneySchema,
});
export const planSchema = z.object({
  version: z.literal(2),
  id: z.string().min(1).max(80),
  revision: z.number().int().min(0),
  constraints: constraintsSchema,
  allocations: allocationSchema,
  reserve: moneySchema,
  foodRate: z.number().min(0).max(10_000_000),
  locked: z.array(categorySchema).max(5),
  quotes: z.array(quoteSchema).max(30),
  tasks: z.array(taskSchema).max(40),
});
export type Category = z.infer<typeof categorySchema>;
export type Constraints = z.infer<typeof constraintsSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Allocation = z.infer<typeof allocationSchema>;
export type EventPlan = z.infer<typeof planSchema>;
export const labels: Record<Category, string> = {
  venue: 'Venue & permits',
  food: 'Food & beverage',
  production: 'Production',
  decor: 'Décor & experience',
  logistics: 'People & logistics',
};

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
