import serverless from "serverless-http";
import { app } from "../server/src/app.ts";

export default serverless(app);
