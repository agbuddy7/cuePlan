# Security policy

Report vulnerabilities privately to the repository owner. Do not open a public issue for secrets, authentication bypasses, injection, or denial-of-service findings.

## Design controls

- The OpenAI key is read only from the Worker environment.
- Every API input is reconstructed and validated server-side.
- The coordinator recomputes the authoritative plan instead of trusting client totals.
- Request bodies are limited to 24 KB and coordinator calls are rate-limited.
- Responses set CSP, frame, MIME, referrer, and browser permissions controls.
- AI failures degrade to a deterministic briefing without exposing upstream errors.

This demo stores no personal data and has no client-side analytics.
