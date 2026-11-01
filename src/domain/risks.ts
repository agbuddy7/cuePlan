import { budgetFacts } from './budget.js';
import { inr } from './money.js';
import { schedule } from './workflow.js';
import { type EventPlan } from './schema.js';

export interface Risk {
  id: string;
  level: 'high' | 'medium' | 'low';
  title: string;
  action: string;
}
export function assessRisks(plan: EventPlan, today: string): Risk[] {
  const facts = budgetFacts(plan),
    tasks = schedule(plan.tasks, plan.constraints.eventDate, today);
  const risks: Risk[] = [];
  if (facts.shortfall > 0)
    risks.push({
      id: 'funding',
      level: 'high',
      title: `Funding gap ${inr(facts.shortfall)}`,
      action: 'Review a feasible decision before accepting another quote.',
    });
  for (const task of tasks.filter((t) => !t.done && (t.afterEvent || t.overdue)))
    risks.push({
      id: task.id,
      level: task.afterEvent ? 'high' : 'medium',
      title: `${task.title}: ${task.afterEvent ? 'scheduled after event' : 'overdue'}`,
      action: `Ask ${task.owner} to review the delay and prerequisites.`,
    });
  if (facts.rows.some((row) => row.taxUnknown))
    risks.push({
      id: 'tax',
      level: 'medium',
      title: 'Tax treatment remains unconfirmed',
      action: 'Ask the accepted vendor for a tax-inclusive written total.',
    });
  if (plan.quotes.some((q) => q.accepted && !q.cancellation))
    risks.push({
      id: 'cancellation',
      level: 'medium',
      title: 'Accepted vendor lacks cancellation terms',
      action: 'Obtain cancellation and refund terms before paying a deposit.',
    });
  if (facts.confirmedCategories < 5)
    risks.push({
      id: 'estimates',
      level: 'low',
      title: `${5 - facts.confirmedCategories} categories still use estimates`,
      action: 'Collect comparable quotes and confirm their scope.',
    });
  return risks;
}
