import { invokeWorker } from "../lib/vercel-adapter.js";

export default function tasks(req, res) {
  return invokeWorker(req, res, "/api/tasks");
}
