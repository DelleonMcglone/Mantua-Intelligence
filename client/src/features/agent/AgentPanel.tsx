import { CircleAgentChat } from "./CircleAgentChat.tsx";

interface AgentPanelProps {
  onClose: () => void;
}

/**
 * Agent panel entry point — "Your Circle Agent", a single conversational
 * surface. Selecting a quick action (or typing a command) runs the
 * corresponding flow inline in the chat (wallet, fund, query, swap, send,
 * add liquidity) against the agent's Circle wallet on Arc. The old
 * mode-picker + Autonomous mode were removed.
 */
export function AgentPanel({ onClose }: AgentPanelProps) {
  return <CircleAgentChat onClose={onClose} />;
}
