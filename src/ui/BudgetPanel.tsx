import { budgetFacts } from '../domain/budget.js';
import { inr } from '../domain/money.js';
import { categories, labels } from '../domain/schema.js';
import { type PlanProps } from './types.js';

export function BudgetPanel({ plan, dispatch }: PlanProps) {
  const facts = budgetFacts(plan);
  return (
    <section aria-labelledby="budget-title">
      <h2 id="budget-title">Budget and commitments</h2>
      <p>
        Allocations reconcile exactly to your budget. Accepted quotes and guest-driven food
        requirements determine the spend forecast.
      </p>
      <div className="metrics">
        <article>
          <span>Total budget</span>
          <strong>{inr(plan.constraints.budget)}</strong>
        </article>
        <article>
          <span>Protected reserve</span>
          <strong>{inr(plan.reserve)}</strong>
        </article>
        <article>
          <span>Accepted commitments</span>
          <strong>{inr(facts.committed)}</strong>
        </article>
        <article>
          <span>Funding gap</span>
          <strong className={facts.shortfall ? 'error' : ''}>{inr(facts.shortfall)}</strong>
        </article>
      </div>
      <div className="table-scroll">
        <table>
          <caption>Working category allocations and forecast</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Allocated</th>
              <th scope="col">Forecast</th>
              <th scope="col">Provenance</th>
              <th scope="col">Protect</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const row = facts.rows.find((item) => item.category === category);
              const accepted = plan.quotes.some((q) => q.category === category && q.accepted);
              return (
                <tr key={category}>
                  <th scope="row">{labels[category]}</th>
                  <td>
                    <input
                      aria-label={`${labels[category]} allocation`}
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={plan.allocations[category]}
                      key={`${category}-${plan.revision}`}
                      disabled={accepted || plan.locked.includes(category)}
                      onBlur={(event) => {
                        const amount = Number(event.target.value);
                        if (amount !== plan.allocations[category])
                          dispatch({ type: 'setAllocation', category, amount });
                      }}
                    />
                  </td>
                  <td>{inr(row?.amount ?? 0)}</td>
                  <td>
                    <span className={accepted ? 'badge accepted' : 'badge'}>
                      {accepted ? 'Accepted quote' : 'Estimate'}
                    </span>
                    {row?.taxUnknown && <small> Tax unconfirmed</small>}
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-pressed={plan.locked.includes(category)}
                      aria-label={`Lock ${labels[category]}`}
                      onClick={() => {
                        dispatch({ type: 'toggleLock', category });
                      }}
                    >
                      {plan.locked.includes(category) ? 'Locked' : 'Unlocked'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        {facts.confirmedCategories} of 5 categories backed by accepted quotes. Forecast:{' '}
        <strong>{inr(facts.forecast)}</strong>. Free headroom after reserve:{' '}
        <strong>{inr(Math.max(0, facts.remaining))}</strong>.
      </p>
    </section>
  );
}
