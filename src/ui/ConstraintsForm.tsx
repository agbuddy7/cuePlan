import { useState } from 'react';
import { constraintsSchema, occasions, priorities, type Constraints } from '../domain/schema.js';

export function ConstraintsForm({
  input,
  onApply,
  label = 'Update constraints',
}: {
  input: Constraints;
  onApply: (input: Constraints) => void;
  label?: string;
}) {
  const [error, setError] = useState('');
  return (
    <form
      key={JSON.stringify(input)}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const result = constraintsSchema.safeParse({
          eventType: data.get('eventType'),
          budget: Number(data.get('budget')),
          guests: Number(data.get('guests')),
          eventDate: data.get('eventDate'),
          priority: data.get('priority'),
        });
        if (result.success) {
          setError('');
          onApply(result.data);
        } else setError(result.error.issues.map((issue) => issue.message).join('. '));
      }}
    >
      <div className="fields">
        <label>
          Event type
          <select name="eventType" defaultValue={input.eventType}>
            {occasions.map((value) => (
              <option key={value} value={value}>
                {value.replace('-', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Budget (₹)
          <input
            name="budget"
            type="number"
            min="10000"
            max="10000000"
            step="1"
            defaultValue={input.budget}
            required
          />
        </label>
        <label>
          Guests
          <input
            name="guests"
            type="number"
            min="10"
            max="5000"
            step="1"
            defaultValue={input.guests}
            required
          />
        </label>
        <label>
          Event date
          <input name="eventDate" type="date" defaultValue={input.eventDate} required />
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={input.priority}>
            {priorities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary" type="submit">
        {label}
      </button>
    </form>
  );
}
