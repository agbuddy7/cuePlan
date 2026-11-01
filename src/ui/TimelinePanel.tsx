import { schedule } from '../domain/workflow.js';
import { todayISO } from '../domain/calendar.js';
import { type PlanProps } from './types.js';

export function TimelinePanel({ plan, dispatch }: PlanProps) {
  const tasks = schedule(plan.tasks, plan.constraints.eventDate, todayISO());
  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title">Execution timeline</h2>
      <p>
        Tasks unlock when prerequisites are complete. Delays propagate through downstream
        dependencies.
      </p>
      {tasks.map((task) => (
        <article className="task" key={task.id}>
          <div>
            <h3>{task.title}</h3>
            <p>
              <span className="badge">{task.status}</span> Due {task.date}
              {task.overdue ? ' · Overdue' : ''}
              {task.afterEvent ? ' · Beyond event date' : ''}
            </p>
            {task.blockedBy.length > 0 && <p>Waiting for: {task.blockedBy.join(', ')}</p>}
            {task.propagatedDelay > 0 && (
              <p>Schedule impact: {task.propagatedDelay} days including dependencies.</p>
            )}
          </div>
          <form
            className="task-controls"
            key={`${task.id}-${plan.revision}`}
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const owner = data.get('owner');
              dispatch({
                type: 'updateTask',
                id: task.id,
                owner: typeof owner === 'string' ? owner : '',
                delayDays: Number(data.get('delay')),
              });
            }}
          >
            <label>
              Owner for {task.id}
              <input name="owner" maxLength={80} defaultValue={task.owner} required />
            </label>
            <label>
              Delay days for {task.id}
              <input
                name="delay"
                type="number"
                min="0"
                max="365"
                defaultValue={task.delayDays}
                required
              />
            </label>
            <button type="submit">Save task</button>
            <button
              type="button"
              disabled={task.status !== 'ready'}
              onClick={() => {
                dispatch({ type: 'completeTask', id: task.id });
              }}
            >
              {task.done ? 'Completed' : 'Complete task'}
            </button>
          </form>
        </article>
      ))}
    </section>
  );
}
