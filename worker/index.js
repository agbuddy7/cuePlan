const ALLOWED_EVENTS = ["community-fest", "birthday", "wedding", "fundraiser", "workshop"];
const ALLOWED_PRIORITIES = ["balanced", "food", "experience", "reach", "comfort"];
const rateBuckets = new Map();

const CATEGORY_META = [
  { id: "venue", label: "Venue & permits", color: "#4f46e5" },
  { id: "food", label: "Food & beverage", color: "#f97316" },
  { id: "production", label: "Production", color: "#0891b2" },
  { id: "decor", label: "Décor & experience", color: "#db2777" },
  { id: "logistics", label: "People & logistics", color: "#16a34a" },
];

const BASE_WEIGHTS = { venue: 0.22, food: 0.35, production: 0.15, decor: 0.1, logistics: 0.08 };
const PRIORITY_SHIFTS = {
  balanced: {},
  food: { food: 0.08, decor: -0.04, production: -0.02, venue: -0.02 },
  experience: { production: 0.05, decor: 0.05, venue: -0.04, food: -0.04, logistics: -0.02 },
  reach: { logistics: 0.04, production: 0.03, decor: -0.04, venue: -0.03 },
  comfort: { venue: 0.05, logistics: 0.04, decor: -0.04, production: -0.03, food: -0.02 },
};

export function validatePlanInput(value) {
  const errors = [];
  if (!value || typeof value !== "object") return { ok: false, errors: ["A JSON object is required."] };
  if (!ALLOWED_EVENTS.includes(value.eventType)) errors.push("Choose a supported event type.");
  if (!ALLOWED_PRIORITIES.includes(value.priority)) errors.push("Choose a supported priority.");
  if (!Number.isFinite(Number(value.budget)) || Number(value.budget) < 10000 || Number(value.budget) > 10000000) errors.push("Budget must be between ₹10,000 and ₹1,00,00,000.");
  if (!Number.isInteger(Number(value.guests)) || Number(value.guests) < 10 || Number(value.guests) > 5000) errors.push("Guests must be a whole number from 10 to 5,000.");
  if (!Number.isInteger(Number(value.days)) || Number(value.days) < 1 || Number(value.days) > 730) errors.push("Event date must be 1–730 days away.");
  return { ok: errors.length === 0, errors };
}

function roundMoney(value) {
  return Math.round(value / 100) * 100;
}

export function buildPlan(raw) {
  const input = Object.freeze({
    eventType: raw.eventType,
    budget: Math.round(Number(raw.budget)),
    guests: Number(raw.guests),
    days: Number(raw.days),
    priority: raw.priority,
  });
  const result = validatePlanInput(input);
  if (!result.ok) throw new Error(result.errors.join(" "));

  const reserve = roundMoney(input.budget * 0.1);
  const usable = input.budget - reserve;
  const shifts = PRIORITY_SHIFTS[input.priority] || {};
  let spent = 0;
  const allocations = CATEGORY_META.map((category, index) => {
    const amount = index === CATEGORY_META.length - 1
      ? usable - spent
      : roundMoney(usable * (BASE_WEIGHTS[category.id] + (shifts[category.id] || 0)));
    spent += amount;
    return { ...category, amount, percent: Math.round((amount / input.budget) * 100), status: "estimate" };
  });

  const perGuest = Math.round(input.budget / input.guests);
  const risks = [];
  if (perGuest < 500) risks.push({ id: "budget-pressure", level: "high", title: "Per-guest budget is compressed", detail: "₹" + perGuest + " per guest leaves little room for food, venue and safety.", mitigation: "Reduce guests or move to a community-owned venue." });
  if (input.days < 21) risks.push({ id: "short-lead", level: "high", title: "Short vendor lead time", detail: input.days + " days limits vendor choice and negotiation power.", mitigation: "Lock venue and food in the next 48 hours." });
  if (input.guests > 200) risks.push({ id: "crowd-flow", level: "medium", title: "Crowd-flow plan required", detail: "The guest count needs entry, accessibility and emergency ownership.", mitigation: "Assign one safety lead and map two clear routes." });
  if (risks.length === 0) risks.push({ id: "quotes", level: "low", title: "Estimates are not quotes", detail: "The budget is healthy, but all category costs are planning estimates.", mitigation: "Confirm two vendor quotes for each critical category." });

  const health = risks.some((risk) => risk.level === "high") ? "at-risk" : input.days < 35 ? "watch" : "on-track";
  const tasks = [
    { id: "brief", title: "Approve event brief & non-negotiables", owner: "Organizer", due: Math.max(input.days - 2, 1), status: "ready", dependsOn: [] },
    { id: "venue", title: "Shortlist venue + verify permits", owner: "Logistics", due: Math.max(input.days - 7, 1), status: "blocked", dependsOn: ["brief"] },
    { id: "vendors", title: "Collect two comparable vendor quotes", owner: "Procurement", due: Math.max(input.days - 12, 1), status: "blocked", dependsOn: ["venue"] },
    { id: "guest-list", title: "Freeze guest list and accessibility needs", owner: "Guest lead", due: Math.max(input.days - 16, 1), status: "ready", dependsOn: ["brief"] },
    { id: "run-show", title: "Publish run-of-show and contact tree", owner: "Producer", due: Math.max(input.days - 5, 1), status: "blocked", dependsOn: ["vendors", "guest-list"] },
    { id: "rehearsal", title: "Run safety and contingency walkthrough", owner: "All leads", due: 1, status: "blocked", dependsOn: ["run-show"] },
  ];

  return {
    id: "CP-" + input.eventType.toUpperCase().slice(0, 3) + "-" + input.guests,
    input, reserve, usable, allocations, perGuest, risks, health, tasks,
    confidence: { planning: 82, cost: 45, reason: "Structure is deterministic; costs remain estimates until quotes are confirmed." },
  };
}

export function fallbackBriefing(plan) {
  const top = plan.allocations.reduce((a, b) => a.amount > b.amount ? a : b);
  const blocker = plan.tasks.find((task) => task.status === "ready");
  return {
    mode: "fallback",
    message: "Start with “" + blocker.title + "”. Your largest planning estimate is " + top.label + " at ₹" + top.amount.toLocaleString("en-IN") + ". Protect the ₹" + plan.reserve.toLocaleString("en-IN") + " contingency reserve until critical quotes are confirmed. " + plan.risks[0].mitigation,
    assumptions: ["No vendor quote has been confirmed", "10% contingency is protected", "Taxes and travel may vary by vendor"],
  };
}

function securityHeaders(contentType) {
  return {
    "content-type": contentType,
    "cache-control": contentType.startsWith("text/html") ? "no-store" : "public, max-age=3600",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...securityHeaders("application/json; charset=utf-8"), "cache-control": "no-store" } });
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 24000) throw new Error("Request is too large.");
  const text = await request.text();
  if (text.length > 24000) throw new Error("Request is too large.");
  return JSON.parse(text || "{}");
}

function allowRequest(request) {
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const now = Date.now();
  const previous = rateBuckets.get(ip) || [];
  const recent = previous.filter((time) => now - time < 60000);
  if (recent.length >= 12) return false;
  recent.push(now);
  rateBuckets.set(ip, recent);
  return true;
}

async function coordinateWithAI(plan, env) {
  if (!env.OPENAI_API_KEY) return fallbackBriefing(plan);
  const prompt = [
    "You coordinate a community event. Use only the supplied computed facts.",
    "Never invent a cost or vendor. Explicitly call unconfirmed costs estimates.",
    "Give a concise 3-sentence next-action briefing with one trade-off.",
    JSON.stringify(plan),
  ].join("\n");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "authorization": "Bearer " + env.OPENAI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_MODEL || "gpt-5-mini", input: prompt, max_output_tokens: 260 }),
    });
    if (!response.ok) return fallbackBriefing(plan);
    const data = await response.json();
    const message = typeof data.output_text === "string" ? data.output_text : "";
    if (!message.trim()) return fallbackBriefing(plan);
    return { mode: "ai", message: message.slice(0, 1800), assumptions: ["Costs remain estimates until confirmed by vendors", "The deterministic engine owns all calculations"] };
  } catch {
    return fallbackBriefing(plan);
  }
}

const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="CuePlan turns event constraints into an executable budget, timeline, vendor plan and risk register.">
  <title>CuePlan — AI Event Coordinator</title>
  <style>
    :root{--ink:#171727;--muted:#666577;--line:#e6e4ef;--paper:#fbfaf7;--white:#fff;--violet:#5146e5;--violet2:#7c3aed;--orange:#ff6b35;--green:#16845b;--red:#c73c4a;--shadow:0 16px 45px rgba(41,35,76,.09);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:linear-gradient(135deg,#fbfaf7 0%,#f8f6ff 50%,#fff8f2 100%);min-height:100vh}button,input,select{font:inherit}button{cursor:pointer}.skip{position:fixed;left:1rem;top:-5rem;background:var(--ink);color:#fff;padding:.8rem 1rem;z-index:50;border-radius:.5rem}.skip:focus{top:1rem}.shell{max-width:1440px;margin:auto;padding:0 32px}.topbar{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(85,79,110,.13)}.brand{display:flex;align-items:center;gap:11px;font-weight:800;font-size:20px;letter-spacing:-.03em}.mark{width:34px;height:34px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--violet),var(--violet2));border-radius:11px;box-shadow:0 8px 18px rgba(81,70,229,.25)}.top-actions{display:flex;gap:10px;align-items:center}.trust{font-size:12px;color:var(--green);background:#eaf8f2;border:1px solid #c6ebdc;padding:7px 10px;border-radius:99px;font-weight:700}.btn{min-height:42px;border-radius:10px;border:1px solid var(--line);background:#fff;color:var(--ink);padding:0 14px;font-weight:700}.btn:hover{border-color:#b9b4d0}.btn:focus-visible,.tab:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid rgba(81,70,229,.3);outline-offset:2px}.btn.primary{color:#fff;border-color:var(--violet);background:var(--violet)}.btn.primary:hover{background:#4137cd}.btn.ghost{background:transparent}.hero{padding:46px 0 26px;display:flex;justify-content:space-between;align-items:end;gap:28px}.eyebrow{text-transform:uppercase;letter-spacing:.14em;color:var(--violet);font-weight:800;font-size:11px;margin:0 0 10px}.hero h1{font-size:clamp(34px,4vw,58px);line-height:1;letter-spacing:-.055em;margin:0;max-width:750px}.hero h1 span{color:var(--violet)}.hero-copy{max-width:440px;color:var(--muted);line-height:1.6;margin:0 0 4px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:22px;padding-bottom:60px}.maincol{min-width:0}.card{background:rgba(255,255,255,.88);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}.setup{padding:20px;margin-bottom:18px}.section-head{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:17px}.section-head h2,.section-head h3{margin:0;letter-spacing:-.03em}.section-head p{margin:4px 0 0;color:var(--muted);font-size:13px}.constraint-grid{display:grid;grid-template-columns:1.2fr 1fr .7fr 1fr 1.05fr auto;gap:10px;align-items:end}.field label{display:block;color:var(--muted);font-weight:700;font-size:11px;margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em}.field input,.field select{width:100%;height:44px;border:1px solid var(--line);background:#fff;border-radius:10px;padding:0 11px;color:var(--ink)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}.metric{padding:17px 18px}.metric .label{color:var(--muted);font-size:12px;font-weight:650}.metric strong{display:block;font-size:25px;letter-spacing:-.04em;margin:6px 0 2px}.metric small{font-size:11px;color:var(--muted)}.metric .health{color:var(--green);text-transform:capitalize}.meter{height:6px;background:#eceaf2;border-radius:99px;overflow:hidden;margin-top:10px}.meter span{display:block;height:100%;background:linear-gradient(90deg,var(--violet),#a78bfa);border-radius:inherit}.workspace{overflow:hidden}.tabs{display:flex;gap:5px;padding:11px;border-bottom:1px solid var(--line);overflow:auto}.tab{border:0;background:transparent;color:var(--muted);padding:9px 13px;border-radius:9px;font-weight:750;white-space:nowrap}.tab[aria-selected="true"]{background:#efedff;color:var(--violet)}.pane{display:none;padding:22px}.pane.active{display:block}.overview-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:20px}.allocation{display:grid;grid-template-columns:14px minmax(130px,1fr) 2fr auto;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #efedf3}.allocation:last-child{border:0}.dot{width:10px;height:10px;border-radius:3px}.alloc-name{font-weight:700;font-size:13px}.alloc-bar{height:8px;background:#eeecf3;border-radius:99px;overflow:hidden}.alloc-bar span{display:block;height:100%;border-radius:inherit}.money{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}.estimate{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#7c5600;background:#fff3cc;border:1px solid #f1dc94;border-radius:99px;padding:3px 7px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.scenario{background:#191827;color:#fff;border-radius:14px;padding:19px}.scenario h3{margin:0 0 4px}.scenario p{margin:0 0 18px;color:#bdb9cd;font-size:12px;line-height:1.5}.scenario label{font-size:11px;font-weight:800;display:flex;justify-content:space-between;margin:15px 0 6px}.scenario input{width:100%;accent-color:#9b8cff}.impact{margin:17px 0;padding:12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px}.impact strong{display:block;font-size:19px}.impact span{color:#c9c5d7;font-size:11px}.scenario .btn{width:100%;margin-top:4px}.timeline{position:relative}.task{display:grid;grid-template-columns:36px 1fr auto;gap:14px;padding:12px 0;align-items:start}.task-icon{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#efedff;color:var(--violet);font-weight:900;font-size:12px;border:1px solid #d9d5ff}.task h4{margin:1px 0 4px;font-size:14px}.task p{margin:0;color:var(--muted);font-size:12px}.task-status{font-size:10px;border-radius:99px;padding:4px 8px;text-transform:uppercase;font-weight:800;background:#f1eff5;color:var(--muted)}.task-status.ready{background:#e5f7ef;color:var(--green)}.vendor-grid,.risk-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.vendor,.risk{border:1px solid var(--line);border-radius:13px;padding:15px}.vendor h4,.risk h4{margin:0 0 5px}.vendor p,.risk p{font-size:12px;color:var(--muted);line-height:1.5;margin:5px 0 12px}.vendor-top{display:flex;justify-content:space-between;align-items:start;gap:10px}.confirmed{background:#e7f8f0;color:var(--green);border-color:#bfe8d5}.risk-level{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.risk-level.high{color:var(--red)}.risk-level.medium{color:#9a6000}.risk-level.low{color:var(--green)}.rail{display:flex;flex-direction:column;gap:16px}.coach{padding:20px;position:sticky;top:18px;background:linear-gradient(165deg,#211f35,#171624);color:#fff;border-color:#2d2a43}.coach-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}.spark{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#8275ff,#ff7a45);display:grid;place-items:center;font-size:18px}.coach h2{font-size:17px;margin:0}.coach .mode{color:#a9a5bb;font-size:11px}.briefing{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:15px;border-radius:12px;line-height:1.55;font-size:13px;min-height:126px}.briefing p{margin:0}.coach .btn{width:100%;margin-top:12px;background:#fff}.coach-note{color:#9f9aac;font-size:10px;line-height:1.5;margin:10px 2px 0}.assumptions{padding:18px}.assumptions h3{font-size:14px;margin:0 0 12px}.assumptions ul{padding:0;margin:0;list-style:none}.assumptions li{font-size:11px;color:var(--muted);line-height:1.45;padding:8px 0;border-bottom:1px solid var(--line)}.assumptions li:last-child{border:0}.legend{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px;margin-top:12px}.legend i{width:8px;height:8px;border-radius:50%;background:var(--orange)}.footer{border-top:1px solid var(--line);padding:18px 0 35px;display:flex;justify-content:space-between;color:var(--muted);font-size:11px}.toast{position:fixed;bottom:20px;left:50%;transform:translate(-50%,20px);background:#171624;color:#fff;padding:11px 16px;border-radius:10px;font-size:12px;opacity:0;pointer-events:none;transition:.2s;z-index:20}.toast.show{opacity:1;transform:translate(-50%,0)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    @media(max-width:1100px){.layout{grid-template-columns:1fr}.rail{display:grid;grid-template-columns:1fr 1fr}.coach{position:static}.constraint-grid{grid-template-columns:repeat(3,1fr)}.constraint-grid .btn{width:100%}}
    @media(max-width:760px){.shell{padding:0 16px}.topbar{height:66px}.trust,.top-actions .ghost{display:none}.hero{padding:30px 0 20px;display:block}.hero-copy{margin-top:16px}.layout{gap:14px}.constraint-grid{grid-template-columns:1fr 1fr}.metrics{grid-template-columns:1fr 1fr}.overview-grid{grid-template-columns:1fr}.allocation{grid-template-columns:12px 1fr auto}.alloc-bar{grid-column:2/4}.rail{display:block}.rail>*{margin-bottom:14px}.vendor-grid,.risk-grid{grid-template-columns:1fr}.pane{padding:16px}.footer{display:block;line-height:1.7}}
    @media(max-width:430px){.constraint-grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.metric{padding:14px}.metric strong{font-size:20px}.hero h1{font-size:38px}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
    @media print{.top-actions,.setup,.tabs,.rail,.scenario,.footer{display:none!important}.layout,.overview-grid{display:block}.shell{max-width:none;padding:0}.card{box-shadow:none}.pane{display:block!important}.pane:not(#overview){page-break-before:always}}
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to plan</a>
  <header class="topbar shell"><div class="brand"><span class="mark" aria-hidden="true">C</span> CuePlan</div><div class="top-actions"><span class="trust">● Deterministic budget engine</span><button class="btn ghost" id="exportBtn">Export plan</button><button class="btn" id="printBtn">Print</button></div></header>
  <main class="shell" id="main">
    <section class="hero" aria-labelledby="hero-title"><div><p class="eyebrow">Your event command center</p><h1 id="hero-title">From constraints to a <span>confident run-of-show.</span></h1></div><p class="hero-copy">CuePlan coordinates budget, people, vendors and dependencies—then shows exactly what changes when your plan does.</p></section>
    <div class="layout"><div class="maincol">
      <section class="card setup" aria-labelledby="setup-title"><div class="section-head"><div><h2 id="setup-title">Plan constraints</h2><p>Five inputs. Every number stays traceable.</p></div><span class="estimate">● Estimates enabled</span></div>
        <form id="planForm" class="constraint-grid">
          <div class="field"><label for="eventType">Event type</label><select id="eventType"><option value="community-fest">Community fest</option><option value="birthday">Birthday</option><option value="wedding">Intimate wedding</option><option value="fundraiser">Fundraiser</option><option value="workshop">Workshop</option></select></div>
          <div class="field"><label for="budget">Budget (₹)</label><input id="budget" inputmode="numeric" type="number" min="10000" max="10000000" step="1000" value="120000" required></div>
          <div class="field"><label for="guests">Guests</label><input id="guests" inputmode="numeric" type="number" min="10" max="5000" value="120" required></div>
          <div class="field"><label for="eventDate">Event date</label><input id="eventDate" type="date" required></div>
          <div class="field"><label for="priority">Top priority</label><select id="priority"><option value="balanced">Balanced plan</option><option value="food">Food quality</option><option value="experience">Guest experience</option><option value="reach">Maximum reach</option><option value="comfort">Comfort & access</option></select></div>
          <button class="btn primary" type="submit">Rebuild plan</button>
        </form>
      </section>
      <section class="metrics" aria-label="Plan health">
        <article class="card metric"><span class="label">Total budget</span><strong id="metricBudget">—</strong><small>100% accounted for</small></article>
        <article class="card metric"><span class="label">Cost per guest</span><strong id="metricGuest">—</strong><small>Planning estimate</small></article>
        <article class="card metric"><span class="label">Protected reserve</span><strong id="metricReserve">—</strong><small>Do not allocate yet</small></article>
        <article class="card metric"><span class="label">Plan health</span><strong class="health" id="metricHealth">—</strong><small id="metricTasks">—</small><div class="meter"><span id="healthBar" style="width:72%"></span></div></article>
      </section>
      <section class="card workspace" aria-label="Event plan workspace">
        <div class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true" aria-controls="overview" data-tab="overview">Budget & trade-offs</button><button class="tab" role="tab" aria-selected="false" aria-controls="timeline" data-tab="timeline">Timeline</button><button class="tab" role="tab" aria-selected="false" aria-controls="vendors" data-tab="vendors">Vendors</button><button class="tab" role="tab" aria-selected="false" aria-controls="risks" data-tab="risks">Risks</button></div>
        <div class="pane active" id="overview" role="tabpanel"><div class="overview-grid"><div><div class="section-head"><div><h3>Where the money goes</h3><p>Reserve excluded from working allocations.</p></div><span class="estimate">Unconfirmed</span></div><div id="allocationList"></div></div><aside class="scenario" aria-labelledby="scenario-title"><h3 id="scenario-title">What-if studio</h3><p>Stress-test the plan without overwriting it.</p><label for="cutRange"><span>Budget change</span><output id="cutOutput">0%</output></label><input id="cutRange" type="range" min="-30" max="30" value="0"><label for="guestRange"><span>Guest change</span><output id="guestOutput">0</output></label><input id="guestRange" type="range" min="-50" max="100" value="0"><div class="impact"><strong id="impactValue">No change</strong><span id="impactText">Move the controls to compare a scenario.</span></div><button class="btn" id="applyScenario">Apply this scenario</button></aside></div></div>
        <div class="pane" id="timeline" role="tabpanel"><div class="section-head"><div><h3>Dependency-aware timeline</h3><p>Blocked tasks show exactly what must happen first.</p></div></div><div class="timeline" id="taskList"></div></div>
        <div class="pane" id="vendors" role="tabpanel"><div class="section-head"><div><h3>Vendor cost ledger</h3><p>Turn estimates into confirmed quotes one by one.</p></div></div><div class="vendor-grid" id="vendorList"></div></div>
        <div class="pane" id="risks" role="tabpanel"><div class="section-head"><div><h3>Active risk register</h3><p>Each risk is paired with a next action.</p></div></div><div class="risk-grid" id="riskList"></div></div>
      </section>
    </div>
    <aside class="rail" aria-label="AI coordinator and assumptions">
      <section class="card coach"><div class="coach-head"><span class="spark" aria-hidden="true">✦</span><div><h2>Coordinator briefing</h2><span class="mode" id="aiMode">Transparent fallback ready</span></div></div><div class="briefing" aria-live="polite" aria-busy="false" id="briefing"><p>Your plan is loading…</p></div><button class="btn" id="coachBtn">✦ Ask AI for next move</button><p class="coach-note">AI explains the plan. It cannot change calculated amounts or silently confirm a cost.</p></section>
      <section class="card assumptions"><h3>Assumptions ledger</h3><ul><li>All costs start as planning estimates</li><li>10% contingency remains protected</li><li>Vendor taxes and travel are not confirmed</li><li>Dates are dependency targets, not bookings</li></ul><div class="legend"><i></i> Explicit, reviewable, editable</div></section>
    </aside></div>
  </main>
  <footer class="footer shell"><span>CuePlan · Built for community organizers</span><span>Transparent AI: estimates are never presented as confirmed quotes.</span></footer>
  <div class="toast" role="status" aria-live="polite" id="toast"></div>
  <script src="/app.js" defer></script>
</body></html>`;

const APP = String.raw`(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let plan = null;
  let scenario = null;

  const future = new Date(); future.setDate(future.getDate() + 42);
  $("#eventDate").value = future.toISOString().slice(0, 10);
  $("#eventDate").min = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  function constraints() {
    const eventDay = new Date($("#eventDate").value + "T12:00:00");
    const days = Math.max(1, Math.ceil((eventDay - new Date()) / 86400000));
    return { eventType: $("#eventType").value, budget: Number($("#budget").value), guests: Number($("#guests").value), days, priority: $("#priority").value };
  }
  async function requestPlan(input) {
    const response = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    const data = await response.json();
    if (!response.ok) throw new Error((data.errors || ["Could not build plan."]).join(" "));
    return data.plan;
  }
  function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); }
  function render(next) {
    plan = next;
    $("#metricBudget").textContent = money(plan.input.budget);
    $("#metricGuest").textContent = money(plan.perGuest);
    $("#metricReserve").textContent = money(plan.reserve);
    $("#metricHealth").textContent = plan.health.replace("-", " ");
    $("#metricHealth").style.color = plan.health === "at-risk" ? "#c73c4a" : plan.health === "watch" ? "#9a6000" : "#16845b";
    $("#metricTasks").textContent = plan.tasks.filter((t) => t.status === "ready").length + " ready · " + plan.tasks.filter((t) => t.status === "blocked").length + " blocked";
    $("#healthBar").style.width = (plan.health === "on-track" ? 88 : plan.health === "watch" ? 65 : 38) + "%";
    $("#allocationList").innerHTML = plan.allocations.map((a) => '<div class="allocation"><span class="dot" style="background:' + esc(a.color) + '"></span><span class="alloc-name">' + esc(a.label) + '</span><span class="alloc-bar"><span style="width:' + a.percent + '%;background:' + esc(a.color) + '"></span></span><span class="money">' + money(a.amount) + '</span></div>').join("");
    $("#taskList").innerHTML = plan.tasks.map((t, i) => '<article class="task"><span class="task-icon">' + (i + 1) + '</span><div><h4>' + esc(t.title) + '</h4><p>Owner: ' + esc(t.owner) + ' · Due T−' + t.due + ' days' + (t.dependsOn.length ? ' · Depends on ' + t.dependsOn.join(", ") : '') + '</p></div><span class="task-status ' + esc(t.status) + '">' + esc(t.status) + '</span></article>').join("");
    $("#vendorList").innerHTML = plan.allocations.map((a) => '<article class="vendor"><div class="vendor-top"><div><h4>' + esc(a.label) + '</h4><span class="estimate">Estimate</span></div><strong>' + money(a.amount) + '</strong></div><p>Planning envelope only. Confirm scope, taxes, travel and cancellation terms.</p><button class="btn quote-btn" data-label="' + esc(a.label) + '">Record quote</button></article>').join("");
    $("#riskList").innerHTML = plan.risks.map((r) => '<article class="risk"><span class="risk-level ' + esc(r.level) + '">' + esc(r.level) + ' priority</span><h4>' + esc(r.title) + '</h4><p>' + esc(r.detail) + '</p><p><strong>Mitigation:</strong> ' + esc(r.mitigation) + '</p></article>').join("");
    $$(".quote-btn").forEach((button) => button.addEventListener("click", () => { const badge = button.parentElement.querySelector(".estimate"); badge.textContent = "Confirmed"; badge.classList.add("confirmed"); button.textContent = "Quote recorded"; button.disabled = true; toast(button.dataset.label + " marked confirmed in this demo"); }));
    updateScenario();
  }
  async function rebuild(input, notify) {
    try { render(await requestPlan(input)); if (notify) toast("Plan rebuilt from your constraints"); }
    catch (error) { toast(error.message); }
  }
  function updateScenario() {
    if (!plan) return;
    const cut = Number($("#cutRange").value), guestDelta = Number($("#guestRange").value);
    $("#cutOutput").textContent = (cut > 0 ? "+" : "") + cut + "%";
    $("#guestOutput").textContent = (guestDelta > 0 ? "+" : "") + guestDelta;
    const newBudget = Math.max(10000, Math.round(plan.input.budget * (1 + cut / 100)));
    const newGuests = Math.max(10, plan.input.guests + guestDelta);
    const perGuestDelta = Math.round(newBudget / newGuests) - plan.perGuest;
    scenario = { ...plan.input, budget: newBudget, guests: newGuests };
    $("#impactValue").textContent = (perGuestDelta >= 0 ? "+" : "−") + money(Math.abs(perGuestDelta)) + " / guest";
    $("#impactText").textContent = money(newBudget) + " total for " + newGuests + " guests. Reserve becomes " + money(Math.round(newBudget * .1)) + ".";
  }
  $("#planForm").addEventListener("submit", (event) => { event.preventDefault(); rebuild(constraints(), true); });
  ["#cutRange", "#guestRange"].forEach((id) => $(id).addEventListener("input", updateScenario));
  $("#applyScenario").addEventListener("click", async () => { if (!scenario) return; $("#budget").value = scenario.budget; $("#guests").value = scenario.guests; $("#cutRange").value = 0; $("#guestRange").value = 0; await rebuild(scenario, true); });
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => { $$(".tab").forEach((t) => t.setAttribute("aria-selected", "false")); $$(".pane").forEach((p) => p.classList.remove("active")); tab.setAttribute("aria-selected", "true"); $("#" + tab.dataset.tab).classList.add("active"); }));
  $("#coachBtn").addEventListener("click", async () => {
    const box = $("#briefing"); box.setAttribute("aria-busy", "true"); box.textContent = "Reviewing constraints, dependencies and risk…";
    try { const response = await fetch("/api/coordinate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Coordinator unavailable"); box.innerHTML = "<p>" + esc(data.message) + "</p>"; $("#aiMode").textContent = data.mode === "ai" ? "AI briefing · calculations locked" : "Deterministic fallback · AI optional"; }
    catch (error) { box.textContent = error.message; }
    finally { box.setAttribute("aria-busy", "false"); }
  });
  $("#exportBtn").addEventListener("click", () => { if (!plan) return; const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "cueplan-" + plan.id.toLowerCase() + ".json"; link.click(); URL.revokeObjectURL(link.href); });
  $("#printBtn").addEventListener("click", () => window.print());
  rebuild(constraints(), false).then(() => $("#coachBtn").click());
})();`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return new Response(PAGE, { headers: securityHeaders("text/html; charset=utf-8") });
    if (request.method === "GET" && url.pathname === "/app.js") return new Response(APP, { headers: securityHeaders("application/javascript; charset=utf-8") });
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "cueplan" });
    if (request.method === "POST" && url.pathname === "/api/plan") {
      try {
        const input = await readJson(request);
        const valid = validatePlanInput(input);
        if (!valid.ok) return json({ errors: valid.errors }, 400);
        return json({ plan: buildPlan(input) });
      } catch (error) { return json({ errors: [error.message || "Invalid request."] }, 400); }
    }
    if (request.method === "POST" && url.pathname === "/api/coordinate") {
      if (!allowRequest(request)) return json({ error: "Too many coordinator requests. Try again in one minute." }, 429);
      try {
        const body = await readJson(request);
        const input = body && body.plan && body.plan.input;
        const valid = validatePlanInput(input);
        if (!valid.ok) return json({ error: "Plan input is invalid." }, 400);
        const authoritativePlan = buildPlan(input);
        return json(await coordinateWithAI(authoritativePlan, env));
      } catch (error) { return json({ error: error.message || "Invalid request." }, 400); }
    }
    return new Response("Not found", { status: 404, headers: securityHeaders("text/plain; charset=utf-8") });
  },
};
