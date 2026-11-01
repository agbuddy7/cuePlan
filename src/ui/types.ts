import { type Command } from '../domain/plan.js';
import { type EventPlan } from '../domain/schema.js';
export interface PlanProps {
  plan: EventPlan;
  dispatch: (command: Command) => void;
}
