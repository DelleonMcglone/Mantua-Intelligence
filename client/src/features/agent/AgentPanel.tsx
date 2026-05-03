import { useState } from "react";
import { AgentChatGrid, type ChatActionKey } from "./AgentChatGrid.tsx";
import { AgentModePicker } from "./AgentModePicker.tsx";
import { AutonomousFlow } from "./AutonomousFlow.tsx";
import { SendFlow } from "./SendFlow.tsx";
import { SwapFlow } from "./SwapFlow.tsx";
import { WalletFlow } from "./WalletFlow.tsx";

interface AgentPanelProps {
  onClose: () => void;
}

type Step = "mode" | "chat" | "auto" | "wallet" | "send" | "swap";

/**
 * Mantua Prototype — `AgentPanel`. Entry point for the Phase 6 agent
 * flows. Handles top-level routing between the mode picker, the
 * Chat-mode action grid, and each individual flow (F1–F3, F7) per
 * `mantua-ai/project/Mantua Agent Flows.html`.
 *
 * Pass-1 scope: WalletFlow, SendFlow, SwapFlow, AutonomousFlow,
 * AgentStrip, IntentCard. F4 / F5 / F6 / F8 / F9 / F10 / F11 land in
 * later passes (intentional split — see roadmap).
 */
export function AgentPanel({ onClose }: AgentPanelProps) {
  const [step, setStep] = useState<Step>("mode");

  const backToChat = () => {
    setStep("chat");
  };

  const handleChatPick = (k: ChatActionKey) => {
    if (k === "wallet" || k === "fund") {
      setStep("wallet");
      return;
    }
    if (k === "send") {
      setStep("send");
      return;
    }
    if (k === "swap") {
      setStep("swap");
      return;
    }
    // liq + query don't have flows in pass 1; no-op.
  };

  if (step === "mode") {
    return (
      <AgentModePicker
        onClose={onClose}
        onPickChat={() => {
          setStep("chat");
        }}
        onPickAutonomous={() => {
          setStep("auto");
        }}
      />
    );
  }

  if (step === "chat") {
    return (
      <AgentChatGrid
        onBackToMode={() => {
          setStep("mode");
        }}
        onClose={onClose}
        onPick={handleChatPick}
      />
    );
  }

  if (step === "wallet") return <WalletFlow onClose={backToChat} />;
  if (step === "send") return <SendFlow onClose={backToChat} />;
  if (step === "swap") return <SwapFlow onClose={backToChat} />;
  // step === "auto" — default arm; TS narrows the union for us.
  return (
    <AutonomousFlow
      onClose={onClose}
      onBack={() => {
        setStep("mode");
      }}
    />
  );
}
