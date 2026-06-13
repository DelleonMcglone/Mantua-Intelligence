/**
 * Entry point — boots the Arc AgentKit instance and prints the registered
 * actions. Confirms the wallet/network layer + custom action providers
 * load against the configured env. Wire this AgentKit into your LLM loop
 * (e.g. getLangChainTools) as the next step.
 */
import { createArcAgentKit } from "./agent.ts";

async function main(): Promise<void> {
  const agentkit = await createArcAgentKit();
  const actions = agentkit.getActions();
  console.log(`Arc AgentKit ready — ${String(actions.length)} actions registered:`);
  for (const action of actions) {
    console.log(`  • ${action.name}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
