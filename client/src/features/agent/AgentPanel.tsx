import { CircleAgentChat } from "./CircleAgentChat.tsx";

interface AgentPanelProps {
  onClose: () => void;
}

/**
 * Agent panel entry point — "Your Circle Agent", a free-form autonomous
 * conversational surface. The user types in the global bar; each turn streams
 * from `/api/agent/chat`, with the agent executing tools (swap / send / data /
 * portfolio) on its Circle wallet on Arc. No forms, no confirmation.
 */
export function AgentPanel({ onClose }: AgentPanelProps) {
  return <CircleAgentChat onClose={onClose} />;
}
