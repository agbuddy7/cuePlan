export const APP = String.raw`(() => {
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
    $("#taskList").innerHTML = plan.tasks.map((t, i) => '<article class="task"><span class="task-icon">' + (i + 1) + '</span><div><h4>' + esc(t.title) + '</h4><p>Owner: ' + esc(t.owner) + ' · Due T−' + t.due + ' days' + (t.dependsOn.length ? ' · Depends on ' + t.dependsOn.join(", ") : '') + '</p></div><button class="btn task-action" data-task="' + esc(t.id) + '" ' + (t.status !== "ready" ? 'disabled' : '') + '>' + (t.status === "ready" ? "Complete task" : esc(t.status)) + '</button></article>').join("");
    $$(".task-action").forEach(button => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const completedIds = plan.tasks.filter(task => task.status === "completed").map(task => task.id).concat(button.dataset.task);
        const response = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: plan.input, completedIds }) });
        const result = await response.json();
        if (!response.ok) throw new Error((result.errors || ["Could not update tasks"]).join(" "));
        render({ ...plan, tasks: result.tasks });
        toast("Task completed; dependent tasks updated");
      } catch (error) { button.disabled = false; toast(error.message); }
    }));
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

