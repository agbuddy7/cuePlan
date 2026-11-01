import { assessRisks } from '../domain/risks.js';
import { todayISO } from '../domain/calendar.js';
import { type EventPlan } from '../domain/schema.js';

export function RisksPanel({ plan }: { plan: EventPlan }) {
  const risks = assessRisks(plan, todayISO());
  return (
    <section aria-labelledby="risks-title">
      <h2 id="risks-title">Active risk register</h2>
      <p>These findings are derived from the current commitments, schedule and quote terms.</p>
      <div className="cards">
        {risks.map((risk) => (
          <article className="subcard" key={risk.id}>
            <span className="badge">{risk.level} priority</span>
            <h3>{risk.title}</h3>
            <p>{risk.action}</p>
          </article>
        ))}
      </div>
      {risks.length === 0 && <p>No active risks from the modeled checks.</p>}
    </section>
  );
}
