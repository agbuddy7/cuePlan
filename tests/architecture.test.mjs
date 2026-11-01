import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/domain/planning.js';
import { resolveWorkflow } from '../src/domain/workflow.js';
import { coordinateWithGemini } from '../src/infrastructure/gemini.js';
import { allowRequest } from '../src/infrastructure/rate-limit.js';
import worker from '../worker/index.js';

const input = {eventType:'community-fest', budget:120000, guests:120, days:42, priority:'balanced'};

test('budget invariants hold across priorities and non-round amounts', () => {
  for (const budget of [10000, 10101, 97500, 120001, 10000000]) {
    for (const priority of ['balanced','food','experience','reach','comfort']) {
      const plan = buildPlan({...input, budget, priority});
      assert.equal(plan.allocations.reduce((sum,a) => sum+a.amount,0)+plan.reserve,budget);
      assert.ok(plan.allocations.every(a => a.amount >= 0));
      const logistics = plan.allocations.find(a => a.id === 'logistics');
      const expected = plan.usable * (priority === 'reach' ? .12 : priority === 'comfort' ? .12 : priority === 'experience' ? .06 : .08) / .9;
      assert.ok(Math.abs(logistics.amount-expected) <= 250);
    }
  }
});

test('every prerequisite deadline precedes its dependent in T-minus time', () => {
  for (const days of [1, 7, 21, 42, 730]) {
    const {tasks} = buildPlan({...input,days});
    for (const task of tasks) for (const dep of task.dependsOn) {
      assert.ok(tasks.find(t => t.id === dep).due >= task.due);
    }
  }
});

test('workflow unlocks only tasks whose prerequisites have completed', () => {
  const {tasks} = buildPlan(input);
  const result = resolveWorkflow(tasks,['brief']);
  assert.equal(result.find(t => t.id === 'brief').status,'completed');
  assert.equal(result.find(t => t.id === 'venue').status,'ready');
  assert.equal(result.find(t => t.id === 'run-show').status,'blocked');
  assert.throws(() => resolveWorkflow(tasks,['run-show']),/prerequisite/);
  assert.equal(tasks[0].status,'ready');
});

test('workflow rejects cycles and unknown dependencies', () => {
  assert.throws(() => resolveWorkflow([{id:'a',dependsOn:['b']},{id:'b',dependsOn:['a']}]),/cycle/);
  assert.throws(() => resolveWorkflow([{id:'a',dependsOn:['missing']}]),/Unknown/);
});

test('Gemini adapter parses a grounded success using injected transport', async () => {
  const result = await coordinateWithGemini(buildPlan(input),{GEMINI_API_KEY:'test-key'},async (url, options) => {
    assert.match(url,/generativelanguage.googleapis.com/);
    assert.equal(options.headers['x-goog-api-key'],'test-key');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({candidates:[{content:{parts:[{text:'Confirm the venue estimate first.'}]}}]});
  });
  assert.equal(result.mode,'ai');
  assert.match(result.message,/estimate/);
});

test('Gemini fails gracefully on upstream error, empty answer and transport failure', async () => {
  for (const transport of [async()=>new Response('',{status:429}),async()=>Response.json({}),async()=>{throw new Error('offline');}]) {
    const result = await coordinateWithGemini(buildPlan(input),{GEMINI_API_KEY:'test'},transport);
    assert.equal(result.mode,'fallback');
  }
});

test('rate limiting isolates forwarded client identities and expires windows', () => {
  const req = new Request('https://test/',{headers:{'x-forwarded-for':'client-a'}});
  for(let i=0;i<12;i++) assert.equal(allowRequest(req,1000),true);
  assert.equal(allowRequest(req,1000),false);
  assert.equal(allowRequest(new Request('https://test/',{headers:{'x-forwarded-for':'client-b'}}),1000),true);
  assert.equal(allowRequest(req,62000),true);
});

test('task API recomputes graph and rejects out-of-order completion', async () => {
  for(const [completedIds,status] of [[['brief'],200],[['run-show'],400]]) {
    const response = await worker.fetch(new Request('https://test/api/tasks',{method:'POST',body:JSON.stringify({input,completedIds})}),{});
    assert.equal(response.status,status);
  }
});

test('invalid direct domain calls produce validation errors', () => {
  for(const value of [null,[],{},undefined]) assert.throws(()=>buildPlan(value));
});
