const ALLOWED_EVENTS = ["community-fest", "birthday", "wedding", "fundraiser", "workshop"];
const ALLOWED_PRIORITIES = ["balanced", "food", "experience", "reach", "comfort"];

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
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["A JSON object is required."] };
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
  const validation = validatePlanInput(raw);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
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
  const weightTotal = CATEGORY_META.reduce((total, category) => total + BASE_WEIGHTS[category.id] + (shifts[category.id] || 0), 0);
  let spent = 0;
  const allocations = CATEGORY_META.map((category, index) => {
    const amount = index === CATEGORY_META.length - 1
      ? usable - spent
      : roundMoney(usable * (BASE_WEIGHTS[category.id] + (shifts[category.id] || 0)) / weightTotal);
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
    { id: "brief", title: "Approve event brief & non-negotiables", owner: "Organizer", due: input.days, status: "ready", dependsOn: [] },
    { id: "venue", title: "Shortlist venue + verify permits", owner: "Logistics", due: Math.max(input.days - 7, 1), status: "blocked", dependsOn: ["brief"] },
    { id: "vendors", title: "Collect two comparable vendor quotes", owner: "Procurement", due: Math.max(input.days - 12, 1), status: "blocked", dependsOn: ["venue"] },
    { id: "guest-list", title: "Freeze guest list and accessibility needs", owner: "Guest lead", due: Math.max(input.days - 16, 1), status: "blocked", dependsOn: ["brief"] },
    { id: "run-show", title: "Publish run-of-show and contact tree", owner: "Producer", due: Math.max(Math.min(5, input.days - 16), 1), status: "blocked", dependsOn: ["vendors", "guest-list"] },
    { id: "rehearsal", title: "Run safety and contingency walkthrough", owner: "All leads", due: 1, status: "blocked", dependsOn: ["run-show"] },
  ];

  return {
    id: "CP-" + input.eventType.toUpperCase().slice(0, 3) + "-" + input.guests,
    input, reserve, usable, allocations, perGuest, risks, health, tasks,
    confidence: { planning: 82, cost: 45, reason: "Structure is deterministic; costs remain estimates until quotes are confirmed." },
  };
}

