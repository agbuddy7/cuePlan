import { useState } from 'react';
import { todayISO } from '../domain/calendar.js';
import { previewScenario, tradeoffs } from '../domain/scenario.js';
import { inr } from '../domain/money.js';
import { categories, labels } from '../domain/schema.js';
import { ConstraintsForm } from './ConstraintsForm.js';
import { type PlanProps } from './types.js';
import { type Command } from '../domain/plan.js';

export function ScenarioPanel({ plan, dispatch }: PlanProps) {
  const [preview, setPreview] = useState<ReturnType<typeof previewScenario> | null>(null);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<Command | null>(null);
  const options = tradeoffs(plan, todayISO());
  return (
    <section aria-labelledby="scenario-title">
      <h2 id="scenario-title">Decision studio</h2>
      <p>
        Preview commitments, reserve, allocation changes and affected tasks before applying a
        decision. Locks and accepted category allocations stay protected.
      </p>
      <ConstraintsForm
        input={plan.constraints}
        label="Preview scenario"
        onApply={(input) => {
          try {
            setPreview(previewScenario(plan, input, todayISO()));
            setDecision({ type: 'updateConstraints', input });
            setError('');
          } catch (error) {
            setPreview(null);
            setError(error instanceof Error ? error.message : 'Scenario is unavailable.');
          }
        }}
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {preview && (
        <div className="subcard">
          <h3>Before / after decision</h3>
          <dl>
            <dt>Forecast spend</dt>
            <dd>
              {inr(preview.before.forecast)} → {inr(preview.after.forecast)}
            </dd>
            <dt>Funding gap</dt>
            <dd>
              {inr(preview.before.shortfall)} → {inr(preview.after.shortfall)}
            </dd>
            <dt>Reserve</dt>
            <dd>
              {inr(plan.reserve)} → {inr(preview.plan.reserve)}
            </dd>
          </dl>
          <ul>
            {preview.changes.map((row) => (
              <li key={row.category}>
                {labels[row.category]}: {inr(row.before)} → {inr(row.after)}
              </li>
            ))}
          </ul>
          <p>
            Affected tasks:{' '}
            {preview.affectedTasks.join(', ') || 'No overdue or post-event tasks in this preview.'}
          </p>
          <button
            className="primary"
            type="button"
            onClick={() => {
              if (decision) dispatch(decision);
              setPreview(null);
            }}
          >
            Apply reviewed scenario
          </button>
        </div>
      )}
      <h3>Funding alternatives</h3>
      {options.length === 0 ? (
        <p>No eligible funding alternatives needed or available under current constraints.</p>
      ) : (
        <div className="cards">
          {options.map((option) => (
            <article className="subcard" key={option.id}>
              <h4>{option.title}</h4>
              <p>Gap reduction: {inr(option.relief)}</p>
              <p>
                Budget {inr(option.plan.constraints.budget)} · {option.plan.constraints.guests}{' '}
                guests · reserve {inr(option.plan.reserve)}
              </p>
              <button
                type="button"
                onClick={() => {
                  const comparison = previewScenario(plan, plan.constraints, todayISO());
                  setPreview({
                    ...comparison,
                    plan: option.plan,
                    after: option.after,
                    changes: categories
                      .map((category) => ({
                        category,
                        before: plan.allocations[category],
                        after: option.plan.allocations[category],
                      }))
                      .filter((row) => row.before !== row.after),
                  });
                  setDecision(option.command);
                }}
              >
                Review this option
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
