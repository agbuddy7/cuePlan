import { invokeWorker } from "../lib/vercel-adapter.js";

export default function plan(req, res) {
  return invokeWorker(req, res, "/api/plan");
}
