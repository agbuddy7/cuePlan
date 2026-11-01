import { quoteCost } from '../domain/budget.js';
import { inr } from '../domain/money.js';
import { labels } from '../domain/schema.js';
import { QuoteForm } from './QuoteForm.js';
import { type PlanProps } from './types.js';

export function VendorsPanel({ plan, dispatch }: PlanProps) {
  return (
    <section aria-labelledby="vendors-title">
      <h2 id="vendors-title">Vendor quote workspace</h2>
      <p>
        Compare up to three quotes per category. Accepting a quote updates commitments, funding gaps
        and scenario calculations.
      </p>
      <QuoteForm
        onSave={(quote) => {
          dispatch({ type: 'recordQuote', quote });
        }}
      />
      <div className="cards">
        {plan.quotes.map((quote) => {
          const cost = quoteCost(quote, plan.constraints.guests);
          return (
            <article className="subcard" key={quote.id}>
              <h3>{quote.vendor}</h3>
              <p>
                {labels[quote.category]} · {quote.pricing}
              </p>
              <strong>{inr(cost)}</strong>
              <p>
                Deposit: {inr(Math.round((cost * quote.depositPercent) / 100))} (
                {quote.depositPercent}%)
              </p>
              <ul>
                {quote.tax === 'unknown' && <li>Confirm whether tax is included.</li>}
                {quote.minimumGuests > plan.constraints.guests && (
                  <li>
                    Minimum billing exceeds attendance by{' '}
                    {quote.minimumGuests - plan.constraints.guests} guests.
                  </li>
                )}
                {!quote.cancellation && <li>Request cancellation terms.</li>}
                {cost > plan.allocations[quote.category] && (
                  <li>Exceeds allocation by {inr(cost - plan.allocations[quote.category])}.</li>
                )}
              </ul>
              {quote.cancellation && <p>Cancellation: {quote.cancellation}</p>}
              {quote.notes && <p>Scope: {quote.notes}</p>}
              <div className="actions">
                <button
                  type="button"
                  disabled={quote.accepted}
                  onClick={() => {
                    dispatch({ type: 'acceptQuote', id: quote.id });
                  }}
                >
                  {quote.accepted ? 'Accepted quote' : 'Accept quote'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'removeQuote', id: quote.id });
                  }}
                >
                  Remove quote
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {plan.quotes.length === 0 && (
        <p>No quotes recorded yet. Category amounts remain estimates.</p>
      )}
    </section>
  );
}
