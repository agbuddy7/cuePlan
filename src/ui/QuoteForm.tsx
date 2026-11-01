import { useState } from 'react';
import { categories, labels, quoteSchema, type Quote } from '../domain/schema.js';

export function QuoteForm({ onSave }: { onSave: (quote: Quote) => void }) {
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const parsed = quoteSchema.safeParse({
          id: crypto.randomUUID(),
          vendor: data.get('vendor'),
          category: data.get('category'),
          pricing: data.get('pricing'),
          amount: Number(data.get('amount')),
          minimumGuests: Number(data.get('minimum')),
          tax: data.get('tax'),
          taxPercent: Number(data.get('taxPercent')),
          depositPercent: Number(data.get('deposit')),
          cancellation: data.get('cancellation'),
          notes: data.get('notes'),
          accepted: false,
        });
        if (!parsed.success) {
          setError(parsed.error.issues.map((issue) => issue.message).join('. '));
          return;
        }
        onSave(parsed.data);
        setError('');
        form.reset();
      }}
    >
      <h3>Record vendor quote</h3>
      <div className="fields">
        <label>
          Vendor name
          <input name="vendor" maxLength={120} required />
        </label>
        <label>
          Category
          <select name="category">
            {categories.map((c) => (
              <option key={c} value={c}>
                {labels[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pricing basis
          <select name="pricing">
            <option value="fixed">Fixed total</option>
            <option value="per-guest">Per guest</option>
          </select>
        </label>
        <label>
          Quoted amount (₹)
          <input name="amount" type="number" min="1" max="10000000" step="1" required />
        </label>
        <label>
          Minimum guests
          <input name="minimum" type="number" min="0" max="5000" defaultValue="0" required />
        </label>
        <label>
          Tax status
          <select name="tax">
            <option value="unknown">Not confirmed</option>
            <option value="included">Included</option>
            <option value="extra">Extra</option>
          </select>
        </label>
        <label>
          Extra tax (%)
          <input name="taxPercent" type="number" min="0" max="100" defaultValue="0" required />
        </label>
        <label>
          Deposit (%)
          <input name="deposit" type="number" min="0" max="100" defaultValue="0" required />
        </label>
      </div>
      <label>
        Cancellation terms
        <textarea name="cancellation" maxLength={500} />
      </label>
      <label>
        Inclusions / exclusions
        <textarea name="notes" maxLength={1000} />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="primary" type="submit">
        Save quote for comparison
      </button>
    </form>
  );
}
