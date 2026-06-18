import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Vercel serverless entrypoint. `vercel.json` rewrites /api/* here.
 *
 * Vercel invokes the default export as a Node `(req, res)` handler, and an
 * Express app *is* exactly that — so we hand the app over directly. (The
 * previous `serverless-http` wrapper produced an AWS-Lambda-shaped
 * `(event, context)` handler, which Vercel mis-invoked and crashed with an
 * opaque `FUNCTION_INVOCATION_FAILED`.)
 *
 * The app is imported lazily inside the handler so a boot/config failure —
 * e.g. env validation throwing on a missing var — is caught and returned as
 * readable JSON instead of an opaque 500.
 */
type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

let cached: NodeHandler | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!cached) {
      const mod = await import("../server/src/app.ts");
      cached = mod.app as unknown as NodeHandler;
    }
    await cached(req, res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "server_boot_failed", message }));
  }
}
