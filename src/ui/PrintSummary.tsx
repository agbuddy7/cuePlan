import { budgetFacts } from '../domain/budget.js';
import { inr } from '../domain/money.js';
import { schedule } from '../domain/workflow.js';
import { todayISO } from '../domain/calendar.js';
import { labels, type EventPlan } from '../domain/schema.js';

export function PrintSummary({ plan }: { plan: EventPlan }) {
  const facts = budgetFacts(plan);
  return (
    <div className="print-only">
      <h1>CuePlan operating summary</h1>
      <p>
        {plan.constraints.eventType} · {plan.constraints.eventDate} · {plan.constraints.guests}{' '}
        guests · revision {plan.revision}
      </p>
      <p>
        Budget {inr(plan.constraints.budget)} · reserve {inr(plan.reserve)} · committed{' '}
        {inr(facts.committed)} · funding gap {inr(facts.shortfall)}
      </p>
      <section>
        <h2>Budget</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Forecast</th>
              <th scope="col">Basis</th>
            </tr>
          </thead>
          <tbody>
            {facts.rows.map((row) => (
              <tr key={row.category}>
                <th scope="row">{labels[row.category]}</th>
                <td>{inr(row.amount)}</td>
                <td>{row.quoted ? 'Accepted quote' : 'Estimate'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Execution</h2>
        <ol>
          {schedule(plan.tasks, plan.constraints.eventDate, todayISO()).map((task) => (
            <li key={task.id}>
              {task.date} · {task.title} · {task.owner} · {task.status}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>Accepted vendors</h2>
        <ul>
          {plan.quotes
            .filter((q) => q.accepted)
            .map((q) => (
              <li key={q.id}>
                {q.vendor} · {labels[q.category]} · tax {q.tax} · cancellation{' '}
                {q.cancellation || 'Unconfirmed'}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
