/** Public entry point shared by Worker hosting and Vercel. */
export { buildPlan, validatePlanInput } from "../src/domain/planning.js";
export { fallbackBriefing } from "../src/application/briefing.js";
export { PAGE } from "../src/web/page.js";
export { APP } from "../src/web/client.js";
export { default } from "../src/http/router.js";
