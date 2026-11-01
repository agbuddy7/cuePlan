import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handle, type Route } from './src/server/http';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const headersSchema = z.object({
  headers: z.array(
    z.object({ headers: z.array(z.object({ key: z.string(), value: z.string() })) }),
  ),
});
const raw: unknown = JSON.parse(readFileSync('vercel.json', 'utf8'));
const headers = Object.fromEntries(
  headersSchema.parse(raw).headers.flatMap((rule) => rule.headers.map((h) => [h.key, h.value])),
);
// Vite injects its refresh preamble and CSS during development. Production preview
// and Vercel use the strict tracked CSP; the dev-only HMR server omits that header.
const developmentHeaders = { ...headers };
delete developmentHeaders['Content-Security-Policy'];
function localApi(): Plugin {
  return {
    name: 'cueplan-local-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const route = req.url?.split('?')[0]?.slice('/api/'.length);
        if (
          !req.url?.startsWith('/api/') ||
          !['health', 'plan', 'coordinate'].includes(route ?? '')
        ) {
          next();
          return;
        }
        void (async () => {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
            size += buffer.length;
            if (size > 64000) {
              res.statusCode = 413;
              res.end(JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE' } }));
              return;
            }
            chunks.push(buffer);
          }
          await handle(
            route as Route,
            { method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() },
            res,
          );
        })().catch(() => {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { code: 'INTERNAL' } }));
        });
      });
    },
  };
}
export default defineConfig({
  plugins: [react(), localApi()],
  server: { headers: developmentHeaders },
  preview: { headers },
  build: { outDir: 'dist', target: 'es2022' },
});
