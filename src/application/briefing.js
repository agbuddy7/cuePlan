export function fallbackBriefing(plan) {
  const top = plan.allocations.reduce((a, b) => a.amount > b.amount ? a : b);
  const blocker = plan.tasks.find((task) => task.status === "ready");
  return {
    mode: "fallback",
    message: "Start with “" + blocker.title + "”. Your largest planning estimate is " + top.label + " at ₹" + top.amount.toLocaleString("en-IN") + ". Protect the ₹" + plan.reserve.toLocaleString("en-IN") + " contingency reserve until critical quotes are confirmed. " + plan.risks[0].mitigation,
    assumptions: ["No vendor quote has been confirmed", "10% contingency is protected", "Taxes and travel may vary by vendor"],
  };
}

