import { invokeWorker } from "../lib/vercel-adapter.js";

export default function health(req, res) {
  return invokeWorker(req, res, "/health");
}
