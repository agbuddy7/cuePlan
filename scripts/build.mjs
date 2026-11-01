import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP, PAGE } from "../worker/index.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distRoot = resolve(projectRoot, "dist");
const publicRoot = resolve(projectRoot, "public");

await rm(distRoot, { recursive: true, force: true });
await rm(publicRoot, { recursive: true, force: true });
await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
await mkdir(publicRoot, { recursive: true });
await cp(resolve(projectRoot, "worker/index.js"), resolve(distRoot, "server/index.js"));
await cp(resolve(projectRoot, "src"), resolve(distRoot, "src"), { recursive: true });
await writeFile(resolve(distRoot, "package.json"), JSON.stringify({ type: "module" }));
await cp(resolve(projectRoot, ".openai/hosting.json"), resolve(distRoot, ".openai/hosting.json"));
await writeFile(resolve(publicRoot, "index.html"), PAGE, "utf8");
await writeFile(resolve(publicRoot, "app.js"), APP, "utf8");
console.log(`Built ${distRoot} and ${publicRoot}`);
