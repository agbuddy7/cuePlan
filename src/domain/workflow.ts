import { daysBetween, shiftDate } from './calendar.js';
import { DomainError, type Constraints, type Task } from './schema.js';

const templates = [
  {
    id: 'brief',
    title: 'Approve event brief and priorities',
    owner: 'Organizer',
    leadDays: 42,
    dependsOn: [],
  },
  {
    id: 'venue',
    title: 'Confirm venue, permits and access',
    owner: 'Logistics lead',
    leadDays: 35,
    dependsOn: ['brief'],
  },
  {
    id: 'vendors',
    title: 'Compare quotes and accept vendors',
    owner: 'Procurement lead',
    leadDays: 28,
    dependsOn: ['venue'],
  },
  {
    id: 'guest-list',
    title: 'Confirm guests, dietary and access needs',
    owner: 'Guest lead',
    leadDays: 21,
    dependsOn: ['brief'],
  },
  {
    id: 'run-show',
    title: 'Publish run-of-show and contact tree',
    owner: 'Producer',
    leadDays: 7,
    dependsOn: ['vendors', 'guest-list'],
  },
  {
    id: 'rehearsal',
    title: 'Walk through safety and contingency plan',
    owner: 'Safety lead',
    leadDays: 1,
    dependsOn: ['run-show'],
  },
];
export function createTasks(input: Constraints, today: string): Task[] {
  const runway = Math.max(0, daysBetween(today, input.eventDate));
  const usual = input.eventType === 'wedding' ? 120 : input.eventType === 'birthday' ? 28 : 42;
  const scale = Math.min(1, runway / usual);
  return templates.map((task) => ({
    ...task,
    dependsOn: [...task.dependsOn],
    leadDays: Math.floor(task.leadDays * (usual / 42) * scale),
    done: false,
    delayDays: 0,
  }));
}
export function assertGraph(tasks: Task[]): void {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (byId.size !== tasks.length)
    throw new DomainError('DUPLICATE_TASK', 'Task identifiers must be unique.');
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string): void {
    const task = byId.get(id);
    if (!task) throw new DomainError('UNKNOWN_TASK', 'Task dependency is missing.');
    if (visiting.has(id)) throw new DomainError('TASK_CYCLE', 'Task dependencies contain a cycle.');
    if (visited.has(id)) return;
    visiting.add(id);
    task.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  tasks.forEach((task) => {
    visit(task.id);
  });
  for (const task of tasks)
    if (task.done && task.dependsOn.some((id) => !byId.get(id)?.done))
      throw new DomainError('TASK_BLOCKED', 'Complete all prerequisites first.');
}
export function schedule(tasks: Task[], eventDate: string, today: string) {
  assertGraph(tasks);
  const shifted = new Map<string, number>();
  function totalDelay(task: Task): number {
    const existing = shifted.get(task.id);
    if (existing !== undefined) return existing;
    const upstream = Math.max(
      0,
      ...task.dependsOn.map((id) => totalDelay(tasks.find((t) => t.id === id) ?? task)),
    );
    const delay = task.delayDays + upstream;
    shifted.set(task.id, delay);
    return delay;
  }
  return tasks.map((task) => {
    const propagatedDelay = totalDelay(task);
    const date = shiftDate(eventDate, -task.leadDays + propagatedDelay);
    const blockedBy = task.dependsOn.filter((id) => !tasks.find((t) => t.id === id)?.done);
    return {
      ...task,
      date,
      propagatedDelay,
      blockedBy,
      status: task.done
        ? ('completed' as const)
        : blockedBy.length
          ? ('blocked' as const)
          : ('ready' as const),
      overdue: !task.done && date < today,
      afterEvent: date > eventDate,
    };
  });
}
