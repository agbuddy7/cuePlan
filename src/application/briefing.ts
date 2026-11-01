import { budgetFacts } from '../domain/budget.js';
import { inr } from '../domain/money.js';
import { schedule } from '../domain/workflow.js';
import { type EventPlan } from '../domain/schema.js';
import { z } from 'zod';

export const briefingSchema = z.object({
  mode: z.enum(['ai', 'fallback']),
  message: z.string().min(1).max(1800),
  assumptions: z.array(z.string().max(250)).max(8),
});
export type Briefing = z.infer<typeof briefingSchema>;
export function planFacts(plan: EventPlan, today: string) {
  const budget = budgetFacts(plan);
  const tasks = schedule(plan.tasks, plan.constraints.eventDate, today);
  return {
    budget: plan.constraints.budget,
    guests: plan.constraints.guests,
    reserve: plan.reserve,
    committed: budget.committed,
    forecast: budget.forecast,
    shortfall: budget.shortfall,
    confirmedCategories: budget.confirmedCategories,
    nextTask: tasks.find((t) => t.status === 'ready')?.title ?? 'All execution tasks completed',
    overdue: tasks.filter((t) => t.overdue).map((t) => t.title),
    taxUnknown: budget.rows.some((row) => row.taxUnknown),
  };
}
export function fallbackBriefing(plan: EventPlan, today: string): Briefing {
  const facts = planFacts(plan, today);
  return {
    mode: 'fallback',
    message: `Next: ${facts.nextTask}. Forecast spend is ${inr(facts.forecast)}, including ${inr(facts.committed)} from accepted quotes. ${facts.shortfall > 0 ? `Resolve the ${inr(facts.shortfall)} funding gap before accepting more commitments.` : `Protect the ${inr(plan.reserve)} reserve and confirm remaining estimates.`}`,
    assumptions: [
      'Unquoted category costs are estimates',
      'Unknown tax and excluded services require vendor confirmation',
      'Accepted quotes are organizer-recorded, not independently verified',
    ],
  };
}
