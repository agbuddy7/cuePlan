import { z } from 'zod';
import { createPlan, validatePlan } from '../domain/plan.js';
import { constraintsSchema, DomainError, planSchema } from '../domain/schema.js';
import { todayISO } from '../domain/calendar.js';
import { coordinate, type Environment } from './gemini.js';

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
export interface ApiResponse {
  statusCode: number;
  setHeader: (key: string, value: string) => void;
  end: (body: string) => void;
}
export type Route = 'plan' | 'coordinate' | 'health';
const hits = new Map<string, { count: number; until: number }>();
export function admit(identity: string, now = Date.now()): boolean {
  for (const [key, value] of hits) if (value.until <= now) hits.delete(key);
  const existing = hits.get(identity);
  if (!existing && hits.size >= 5000) return false;
  const slot = existing ?? { count: 0, until: now + 60000 };
  slot.count++;
  hits.set(identity, slot);
  return slot.count <= 12;
}
function header(req: ApiRequest, key: string): string {
  const value = req.headers[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
export async function handle(
  route: Route,
  req: ApiRequest,
  res: ApiResponse,
  env: Environment = process.env,
): Promise<void> {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  function send(status: number, body: unknown): void {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  }
  if (route === 'health' && req.method === 'GET') {
    send(200, { ok: true, service: 'cueplan', version: 2 });
    return;
  }
  if (req.method !== 'POST' || route === 'health') {
    res.setHeader('Allow', route === 'health' ? 'GET' : 'POST');
    send(405, {
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Use the supported request method.',
        requestId,
      },
    });
    return;
  }
  if (header(req, 'content-type').split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    send(415, {
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Send application/json.', requestId },
    });
    return;
  }
  const origin = header(req, 'origin'),
    host = header(req, 'host');
  try {
    if (origin && new URL(origin).host !== host) {
      send(403, {
        error: { code: 'FORBIDDEN_ORIGIN', message: 'Use the same-origin application.', requestId },
      });
      return;
    }
  } catch {
    send(403, { error: { code: 'FORBIDDEN_ORIGIN', message: 'Invalid origin.', requestId } });
    return;
  }
  if (
    route === 'coordinate' &&
    !admit(
      header(req, 'x-vercel-forwarded-for') ||
        header(req, 'x-real-ip') ||
        header(req, 'x-forwarded-for').split(',')[0] ||
        'local',
    )
  ) {
    res.setHeader('Retry-After', '60');
    send(429, { error: { code: 'RATE_LIMITED', message: 'Retry in one minute.', requestId } });
    return;
  }
  try {
    const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
    if (Buffer.byteLength(text) > 64000) {
      send(413, {
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request exceeds 64 KB.', requestId },
      });
      return;
    }
    const raw: unknown = JSON.parse(text);
    if (route === 'plan') {
      const input = constraintsSchema.parse(raw);
      send(200, { plan: createPlan(input, todayISO(), crypto.randomUUID()) });
      return;
    }
    const body = z.object({ plan: planSchema }).parse(raw);
    const plan = validatePlan(body.plan);
    send(200, await coordinate(plan, todayISO(), env));
  } catch (error) {
    const message =
      error instanceof DomainError
        ? error.message
        : 'The request does not match the event plan contract.';
    send(400, {
      error: {
        code: error instanceof DomainError ? error.code : 'INVALID_INPUT',
        message,
        requestId,
      },
    });
  }
}
