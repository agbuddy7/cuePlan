import { useEffect, useRef, useState } from 'react';
import { briefingSchema, fallbackBriefing, type Briefing } from '../application/briefing.js';
import { todayISO } from '../domain/calendar.js';
import { type EventPlan } from '../domain/schema.js';

export function Coordinator({ plan }: { plan: EventPlan }) {
  const [result, setResult] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    setResult(null);
    request.current?.abort();
    setLoading(false);
    return () => request.current?.abort();
  }, [plan]);
  async function ask(): Promise<void> {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/coordinate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Coordinator unavailable');
      const raw: unknown = await response.json();
      const parsed = briefingSchema.parse(raw);
      if (!controller.signal.aborted) setResult(parsed);
    } catch {
      if (!controller.signal.aborted) setResult(fallbackBriefing(plan, todayISO()));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  const briefing = result ?? fallbackBriefing(plan, todayISO());
  return (
    <aside className="coordinator" aria-labelledby="coordinator-title">
      <p className="eyebrow">Grounded coordination</p>
      <h2 id="coordinator-title">Your next move</h2>
      <div aria-live="polite" aria-busy={loading}>
        <p>{loading ? 'Reviewing current commitments and execution…' : briefing.message}</p>
        <span className="badge">
          {briefing.mode === 'ai' ? 'Answered by Gemini' : 'Built-in coordinator'}
        </span>
      </div>
      <button
        type="button"
        disabled={loading}
        onClick={() => {
          void ask();
        }}
      >
        Ask Gemini to review plan
      </button>
      <h3>Assumptions</h3>
      <ul>
        {briefing.assumptions.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </aside>
  );
}
