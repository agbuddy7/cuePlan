import { createServer } from "node:http";
import worker from "../worker/index.js";

const port = 4173;
createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(`http://127.0.0.1:${port}${req.url}`, { method: req.method, headers: req.headers, body });
  const response = await worker.fetch(request, {}, {});
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log(`Local: http://127.0.0.1:${port}`));
