import { describe, expect, it } from 'vitest';
import { execute, validatePlan } from '../src/domain/plan.js';
import { previewScenario, tradeoffs } from '../src/domain/scenario.js';
import { schedule, assertGraph } from '../src/domain/workflow.js';
import {
  initialWorkspace,
  applyCommand,
  importWorkspace,
  loadWorkspace,
  saveWorkspace,
  undo,
} from '../src/state/workspace.js';
import { budgetFacts } from '../src/domain/budget.js';
import { makePlan, makeQuote, input, today } from './fixtures.js';
const at = '2030-01-01T00:00:00.000Z';

describe('workspace command lifecycle', () => {
  it('preserves progress and quotes when constraints change', () => {
    let plan = execute(makePlan(), { type: 'completeTask', id: 'brief' }, today);
    plan = execute(plan, { type: 'recordQuote', quote: makeQuote() }, today);
    plan = execute(plan, { type: 'updateConstraints', input: { ...input, budget: 100000 } }, today);
    expect(plan.tasks[0]?.done).toBe(true);
    expect(plan.quotes).toHaveLength(1);
  });
  it('keeps history immutable and undo increments revision', () => {
    const state = initialWorkspace(makePlan());
    const next = applyCommand(state, { type: 'toggleLock', category: 'venue' }, today, at);
    expect(state.plan.locked).toEqual([]);
    expect(next.audit[0]?.action).toBe('toggleLock');
    expect(undo(next, at).plan.locked).toEqual([]);
    expect(undo(next, at).plan.revision).toBe(2);
    expect(undo(state, at)).toBe(state);
  });
  it('round-trips validated workspace storage and import', () => {
    let raw = '';
    const state = initialWorkspace(makePlan());
    saveWorkspace(
      {
        setItem: (_key, value) => {
          raw = value;
        },
      },
      state,
    );
    expect(loadWorkspace({ getItem: () => raw })).toEqual(state);
    expect(loadWorkspace({ getItem: () => null })).toBeNull();
    expect(importWorkspace(raw)).toEqual(state);
  });
  it('rejects oversized, malformed and inconsistent imports', () => {
    expect(() => importWorkspace('x'.repeat(2000001))).toThrow();
    expect(() => importWorkspace('{')).toThrow();
    const state = initialWorkspace(makePlan());
    state.plan.reserve = 0;
    expect(() => importWorkspace(JSON.stringify(state))).toThrow();
  });
  it('bounds history and audit growth', () => {
    let state = initialWorkspace(makePlan());
    for (let i = 0; i < 110; i++)
      state = applyCommand(state, { type: 'toggleLock', category: 'venue' }, today, at);
    expect(state.history).toHaveLength(20);
    expect(state.audit).toHaveLength(100);
  });
  it('enforces quote capacity and uniqueness', () => {
    let plan = makePlan();
    for (let i = 0; i < 3; i++)
      plan = execute(plan, { type: 'recordQuote', quote: makeQuote({ id: `q${i}` }) }, today);
    expect(() =>
      execute(plan, { type: 'recordQuote', quote: makeQuote({ id: 'q4' }) }, today),
    ).toThrow();
    expect(() =>
      execute(plan, { type: 'recordQuote', quote: makeQuote({ id: 'q0' }) }, today),
    ).toThrow();
    expect(() => execute(plan, { type: 'acceptQuote', id: 'missing' }, today)).toThrow();
    plan = execute(plan, { type: 'removeQuote', id: 'q0' }, today);
    expect(plan.quotes).toHaveLength(2);
  });
  it('rejects inconsistent accepted quotes and duplicate identifiers on import', () => {
    const plan = makePlan();
    plan.quotes = [makeQuote({ accepted: true }), makeQuote({ id: 'q2', accepted: true })];
    expect(() => validatePlan(plan)).toThrow();
    plan.quotes = [makeQuote(), makeQuote()];
    expect(() => validatePlan(plan)).toThrow();
  });
});
describe('dependency execution and delay propagation', () => {
  it('unlocks prerequisites and refuses out-of-order completion', () => {
    const plan = makePlan();
    expect(() => execute(plan, { type: 'completeTask', id: 'vendors' }, today)).toThrow();
    const next = execute(plan, { type: 'completeTask', id: 'brief' }, today);
    const tasks = schedule(next.tasks, input.eventDate, today);
    expect(tasks.find((t) => t.id === 'venue')?.status).toBe('ready');
    expect(tasks.find((t) => t.id === 'vendors')?.status).toBe('blocked');
  });
  it('propagates a venue delay into downstream tasks', () => {
    const plan = execute(
      makePlan(),
      { type: 'updateTask', id: 'venue', owner: 'Asha', delayDays: 40 },
      today,
    );
    const tasks = schedule(plan.tasks, input.eventDate, today);
    expect(tasks.find((t) => t.id === 'vendors')?.propagatedDelay).toBe(40);
    expect(tasks.find((t) => t.id === 'rehearsal')?.afterEvent).toBe(true);
    expect(tasks.find((t) => t.id === 'venue')?.owner).toBe('Asha');
  });
  it('rejects unknown IDs, duplicate tasks and cycles', () => {
    const plan = makePlan();
    expect(() => execute(plan, { type: 'completeTask', id: 'missing' }, today)).toThrow();
    expect(() =>
      execute(plan, { type: 'updateTask', id: 'missing', owner: 'A', delayDays: 0 }, today),
    ).toThrow();
    const task = plan.tasks[0];
    expect(task).toBeDefined();
    if (!task) throw new Error('fixture');
    expect(() => {
      assertGraph([task, task]);
    }).toThrow();
    expect(() => {
      assertGraph([{ ...task, dependsOn: ['missing'] }]);
    }).toThrow();
    expect(() => {
      assertGraph([{ ...task, dependsOn: [task.id] }]);
    }).toThrow();
  });
  it('all tasks may complete and the graph remains valid', () => {
    let plan = makePlan();
    for (const task of plan.tasks)
      plan = execute(plan, { type: 'completeTask', id: task.id }, today);
    expect(
      schedule(plan.tasks, input.eventDate, today).every((t) => t.status === 'completed'),
    ).toBe(true);
  });
});
describe('reviewable decisions', () => {
  it('previews without mutating the source plan', () => {
    const plan = makePlan();
    const preview = previewScenario(plan, { ...input, guests: 200 }, today);
    expect(plan.constraints.guests).toBe(120);
    expect(preview.after.forecast).toBeGreaterThan(preview.before.forecast);
    expect(preview.changes).toEqual([]);
  });
  it('generates feasible relief and protects accepted quotes', () => {
    let plan = makePlan();
    plan.quotes = [makeQuote({ accepted: true })];
    plan = execute(plan, { type: 'updateConstraints', input: { ...input, guests: 140 } }, today);
    expect(tradeoffs(plan, today).every((option) => option.relief > 0)).toBe(true);
    const trim = tradeoffs(plan, today).find((option) => option.id === 'trim');
    expect(trim?.plan.quotes).toEqual(plan.quotes);
    if (trim) expect(budgetFacts(trim.plan).shortfall).toBeLessThan(budgetFacts(plan).shortfall);
  });
  it('rejects an underfunded protected allocation change', () => {
    const plan = makePlan();
    plan.locked = ['food', 'venue', 'production', 'decor', 'logistics'];
    expect(() => previewScenario(plan, { ...input, budget: 10000 }, today)).toThrow();
  });
  it('offers no alternatives for a funded baseline and rejects unnecessary trims', () => {
    expect(tradeoffs(makePlan(), today)).toEqual([]);
    expect(() => execute(makePlan(), { type: 'coverGap' }, today)).toThrow();
  });
});
