import { describe, expect, it } from 'vitest';
import {
  handle,
  admit,
  type ApiRequest,
  type ApiResponse,
  type Route,
} from '../src/server/http.js';
import { coordinate } from '../src/server/gemini.js';
import { fallbackBriefing } from '../src/application/briefing.js';
import { createPlan, execute } from '../src/domain/plan.js';
import { todayISO, shiftDate, daysBetween } from '../src/domain/calendar.js';
import { makePlan, makeQuote, today, input } from './fixtures.js';

async function call(route: Route, patch: Partial<ApiRequest> = {}) {
  const headers = new Map<string, string>();
  let text = '';
  const response: ApiResponse = {
    statusCode: 0,
    setHeader: (key, value) => {
      headers.set(key, value);
    },
    end: (body) => {
      text = body;
    },
  };
  await handle(
    route,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'test.local' },
      body: { plan: makePlan() },
      ...patch,
    },
    response,
    {},
  );
  return { status: response.statusCode, headers, text };
}
describe('HTTP contract', () => {
  it('serves readiness with request correlation', async () => {
    const result = await call('health', { method: 'GET' });
    expect(result.status).toBe(200);
    expect(result.text).toContain('cueplan');
    expect(result.headers.has('X-Request-ID')).toBe(true);
  });
  it('rejects unsupported methods', async () => {
    const result = await call('plan', { method: 'GET' });
    expect(result.status).toBe(405);
    expect(result.headers.get('Allow')).toBe('POST');
    expect((await call('health', { method: 'POST' })).status).toBe(405);
  });
  it('rejects non-JSON and cross-origin callers', async () => {
    expect((await call('plan', { headers: {} })).status).toBe(415);
    expect(
      (await call('plan', { headers: { 'content-type': 'application/json-invalid' } })).status,
    ).toBe(415);
    expect(
      (
        await call('plan', {
          headers: {
            'content-type': 'application/json',
            host: 'test.local',
            origin: 'https://other.local',
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call('plan', {
          headers: { 'content-type': 'application/json', host: 'test.local', origin: 'invalid' },
        })
      ).status,
    ).toBe(403);
  });
  it('rejects malformed, oversized and inconsistent inputs', async () => {
    expect((await call('plan', { body: '{' })).status).toBe(400);
    expect((await call('plan', { body: 'x'.repeat(64001) })).status).toBe(413);
    const plan = makePlan();
    plan.reserve = 0;
    expect((await call('coordinate', { body: { plan } })).status).toBe(400);
  });
  it('builds a plan with the shared contract and rejects expired dates', async () => {
    expect(
      (await call('plan', { body: { ...input, eventDate: shiftDate(todayISO(), 20) } })).status,
    ).toBe(200);
    expect((await call('plan', { body: { ...input, eventDate: '2000-01-01' } })).status).toBe(400);
  });
  it('returns a grounded fallback when no key is configured', async () => {
    const result = await call('coordinate');
    expect(result.status).toBe(200);
    expect(result.text).toContain('fallback');
  });
  it('isolates rate-limit identities, bounds windows and returns retry guidance', async () => {
    for (let i = 0; i < 12; i++) expect(admit('window-test', 1)).toBe(true);
    expect(admit('window-test', 1)).toBe(false);
    expect(admit('another-test', 1)).toBe(true);
    expect(admit('window-test', 60002)).toBe(true);
    for (let i = 0; i < 12; i++)
      await call('coordinate', {
        headers: { 'content-type': 'application/json', 'x-real-ip': 'quota-test' },
      });
    const result = await call('coordinate', {
      headers: { 'content-type': 'application/json', 'x-real-ip': 'quota-test' },
    });
    expect(result.status).toBe(429);
    expect(result.headers.get('Retry-After')).toBe('60');
  });
});
describe('Gemini boundary', () => {
  it('parses a valid provider response and keeps secrets in headers', async () => {
    let sent = '';
    const transport: typeof fetch = (_url, options) => {
      sent = typeof options?.body === 'string' ? options.body : '';
      expect(new Headers(options?.headers).get('x-goog-api-key')).toBe('test-key');
      return Promise.resolve(
        Response.json({
          candidates: [{ content: { parts: [{ text: 'Confirm the venue estimate.' }] } }],
        }),
      );
    };
    const result = await coordinate(makePlan(), today, { GEMINI_API_KEY: 'test-key' }, transport);
    expect(result.mode).toBe('ai');
    expect(sent).not.toContain('test-key');
    expect(sent).toContain('shortfall');
  });
  it.each(['quota', 'empty', 'invalid', 'failure'])('falls back on %s', async (mode) => {
    const transport: typeof fetch = () => {
      if (mode === 'failure') return Promise.reject(new Error('offline'));
      if (mode === 'quota') return Promise.resolve(new Response('', { status: 429 }));
      if (mode === 'invalid') return Promise.resolve(Response.json({ candidates: 'bad' }));
      return Promise.resolve(Response.json({}));
    };
    expect((await coordinate(makePlan(), today, { GEMINI_API_KEY: 'test' }, transport)).mode).toBe(
      'fallback',
    );
  });
  it('reflects current completion and accepted quotes in the local briefing', () => {
    let plan = makePlan();
    plan.quotes = [makeQuote({ accepted: true, tax: 'unknown' })];
    for (const task of plan.tasks)
      plan = execute(plan, { type: 'completeTask', id: task.id }, today);
    expect(fallbackBriefing(plan, today).message).toContain('All execution tasks completed');
    expect(fallbackBriefing(plan, today).message).toContain('48,000');
  });
  it('validates calendar boundaries and event date range', () => {
    expect(daysBetween('2030-02-28', '2030-03-01')).toBe(1);
    expect(() => createPlan({ ...input, eventDate: '2035-01-01' }, today, 'x')).toThrow();
    expect(() => daysBetween('invalid', '2030-01-01')).toThrow();
  });
});
