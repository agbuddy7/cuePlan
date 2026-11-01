import { z } from 'zod';
import { execute, validatePlan, type Command } from '../domain/plan.js';
import { planSchema, type EventPlan } from '../domain/schema.js';

export interface AuditEntry {
  revision: number;
  action: string;
  at: string;
  detail: string;
}
export interface Workspace {
  plan: EventPlan;
  history: EventPlan[];
  audit: AuditEntry[];
}
export const STORAGE_KEY = 'cueplan.workspace.v2';
export function initialWorkspace(plan: EventPlan): Workspace {
  return { plan, history: [], audit: [] };
}
export function applyCommand(
  state: Workspace,
  command: Command,
  today: string,
  at: string,
): Workspace {
  const plan = execute(state.plan, command, today);
  const detail =
    command.type === 'updateConstraints'
      ? `Budget ${state.plan.constraints.budget} → ${plan.constraints.budget}; guests ${state.plan.constraints.guests} → ${plan.constraints.guests}`
      : command.type;
  return {
    plan,
    history: [...state.history, state.plan].slice(-20),
    audit: [...state.audit, { revision: plan.revision, action: command.type, at, detail }].slice(
      -100,
    ),
  };
}
export function undo(state: Workspace, at: string): Workspace {
  const previous = state.history.at(-1);
  if (!previous) return state;
  const plan = { ...previous, revision: state.plan.revision + 1 };
  return {
    plan,
    history: state.history.slice(0, -1),
    audit: [
      ...state.audit,
      { revision: plan.revision, action: 'undo', at, detail: 'Restored previous plan snapshot' },
    ].slice(-100),
  };
}
const workspaceSchema = z.object({
  plan: planSchema,
  history: z.array(planSchema).max(20),
  audit: z
    .array(
      z.object({
        revision: z.number().int().min(0),
        action: z.string().max(80),
        at: z.iso.datetime(),
        detail: z.string().max(500),
      }),
    )
    .max(100),
});
export function importWorkspace(text: string): Workspace {
  if (new TextEncoder().encode(text).length > 2_000_000)
    throw new Error('Workspace exceeds the 2 MB import limit.');
  const raw: unknown = JSON.parse(text);
  const workspace = workspaceSchema.parse(raw);
  validatePlan(workspace.plan);
  workspace.history.forEach(validatePlan);
  return workspace;
}
export function saveWorkspace(storage: Pick<Storage, 'setItem'>, state: Workspace): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
export function loadWorkspace(storage: Pick<Storage, 'getItem'>): Workspace | null {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? importWorkspace(raw) : null;
}
