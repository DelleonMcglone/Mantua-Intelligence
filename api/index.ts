import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../server/src/app.ts";

/**
 * Vercel serverless entrypoint. `vercel.json` rewrites /api/* here.
 *
 * Vercel invokes the default export as a Node `(req, res)` handler, and an
 * Express app *is* exactly that — so we hand the app over directly. (The
 * old `serverless-http` wrapper produced an AWS-Lambda-shaped
 * `(event, context)` handler, which Vercel mis-invoked → opaque
 * FUNCTION_INVOCATION_FAILED.)
 *
 * The import is STATIC (not a dynamic `import()`) so Vercel's esbuild
 * bundler inlines the whole server tree at build time — the `.ts` extension
 * imports must be resolved during bundling, never at runtime (a dynamic
 * import left them as runtime `.ts` paths that don't exist on the lambda).
 */
const handler = app as unknown as (req: IncomingMessage, res: ServerResponse) => void;

export default handler;
