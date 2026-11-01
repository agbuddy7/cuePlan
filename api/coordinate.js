import { invokeWorker } from "../lib/vercel-adapter.js";

export default function coordinate(req, res) {
  return invokeWorker(req, res, "/api/coordinate");
}
