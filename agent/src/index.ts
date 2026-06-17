/**
 * Entry point — builds the Arc agent's action registry and prints the
 * registered actions. Confirms the wallet/network layer + action providers
 * load against the configured env. Wire this registry into an LLM tool loop
 * (enumerate getActions(), dispatch invoke(args)) as the next step.
 */
import { createArcAgentKit } from "./agent.ts";

function main(): void {
  const agentkit = createArcAgentKit();
  const actions = agentkit.getActions();
  console.log(`Arc agent ready — ${String(actions.length)} actions registered:`);
  for (const action of actions) {
    console.log(`  • ${action.name}`);
  }
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
