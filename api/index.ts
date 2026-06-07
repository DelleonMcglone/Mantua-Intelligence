import serverless from "serverless-http";
import { app } from "../server/src/app.ts";

// Vercel serverless entrypoint. `vercel.json` rewrites /api/* to this
// function; serverless-http adapts the Express app to the Vercel
// (Node/AWS-Lambda-style) request/response signature.
export default serverless(app);
