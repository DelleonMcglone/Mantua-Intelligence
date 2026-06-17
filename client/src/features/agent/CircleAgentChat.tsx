import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import { AgentNotReady, AgentWalletStrip, shortAddr } from "./agent-gate.tsx";
import { CopyButton, PANEL_HEAD, PANEL_TITLE, X_CLOSE } from "./agent-primitives.tsx";
import { WalletFlow } from "./WalletFlow.tsx";
import { SendFlow } from "./SendFlow.tsx";
import { SwapFlow } from "./SwapFlow.tsx";
import { QueryFlow } from "./QueryFlow.tsx";
import { LiquidityFlow } from "./LiquidityFlow.tsx";

/**
 * "Your Circle Agent" — a conversational shell over the agent actions.
 * Selecting a quick action (or typing a matching command) drops a user
 * bubble + an agent reply into the transcript; for actions that need input
 * (send / swap / add liquidity / query) the existing flow form renders
 * inline (embedded) inside the agent bubble, with real validation +
 * on-chain execution through the agent's Circle wallet on Arc.
 */

interface Props {
  onClose: () => void;
}

type ActionKey = "wallet" | "fund" | "query" | "liq" | "swap" | "send";

interface ChatMessage {
  id: number;
  role: "user" | "agent";
  text?: string;
  node?: ReactNode;
}

const NOOP = () => {
  /* embedded flows render no header, so onClose is never called */
};

const ACTIONS: { key: ActionKey; label: string; keywords: string[]; intro: string }[] = [
  {
    key: "wallet",
    label: "Create & manage wallet",
    keywords: ["wallet", "create", "manage", "address", "balance"],
    intro: "Here's your Circle agent wallet on Arc.",
  },
  {
    key: "fund",
    label: "Fund agent wallet",
    keywords: ["fund", "deposit", "faucet", "top up", "topup", "add funds"],
    intro:
      "To fund your agent wallet, copy the address below and request testnet USDC at faucet.circle.com (choose Arc Testnet). Balances refresh automatically once it lands.",
  },
  {
    key: "query",
    label: "Query on-chain data",
    keywords: ["query", "data", "price", "pool", "market", "analyze", "research", "peg", "volume"],
    intro: "What would you like to look up?",
  },
  {
    key: "swap",
    label: "Swap tokens",
    keywords: ["swap", "exchange", "trade", "convert"],
    intro: "Let's swap tokens from your agent wallet — set the amount and review.",
  },
  {
    key: "send",
    label: "Send tokens",
    keywords: ["send", "transfer", "pay"],
    intro: "Sure — who are you sending to, and how much?",
  },
  {
    key: "liq",
    label: "Add liquidity",
    keywords: ["liquidity", "lp", "add liquidity", "provide"],
    intro: "Let's add liquidity from your agent wallet — pick the pair, fee tier, and amounts.",
  },
];

function renderAction(key: ActionKey): ReactNode {
  switch (key) {
    case "wallet":
      return <WalletFlow embedded onClose={NOOP} />;
    case "fund":
      return <FundInline />;
    case "query":
      return <QueryFlow embedded onClose={NOOP} />;
    case "swap":
      return <SwapFlow embedded onClose={NOOP} />;
    case "send":
      return <SendFlow embedded onClose={NOOP} />;
    case "liq":
      return <LiquidityFlow embedded onClose={NOOP} />;
  }
}

const INPUT_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "10px 12px",
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
};

const CHIP_STYLE: CSSProperties = {
  fontSize: 12,
  color: "var(--text-dim)",
  background: "var(--chip)",
  border: "1px solid var(--border-soft)",
  borderRadius: 99,
  padding: "6px 12px",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function CircleAgentChat({ onClose }: Props) {
  const agent = useAgentPortfolio();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const trigger = (key: ActionKey, userText: string) => {
    const action = ACTIONS.find((a) => a.key === key);
    if (!action) return;
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", text: userText },
      { id: nextId(), role: "agent", text: action.intro, node: renderAction(key) },
    ]);
  };

  const submitText = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const lower = text.toLowerCase();
    const match = ACTIONS.find((a) => a.keywords.some((k) => lower.includes(k)));
    if (match) {
      trigger(match.key, text);
      return;
    }
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "user", text },
      {
        id: nextId(),
        role: "agent",
        text: "I can create or fund your agent wallet, query on-chain data, swap, send, or add liquidity. Pick one below or rephrase.",
      },
    ]);
  };

  return (
    <>
      <PanelHeader
        onNewChat={() => {
          setMessages([]);
        }}
      />

      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>
          <span aria-hidden>🤖</span> Your Circle Agent
        </div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {agent.agentAddress && (
        <AgentWalletStrip agent={agent} label={`Agent · ${shortAddr(agent.agentAddress)}`} />
      )}

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>
            Hi — I'm your Circle agent on Arc. Pick an action below or type what you'd like to do.
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
              <div
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {m.text}
              </div>
            </div>
          ) : (
            <div
              key={m.id}
              style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 8 }}
            >
              {m.text && (
                <div
                  style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.55, maxWidth: "85%" }}
                >
                  {m.text}
                </div>
              )}
              {m.node && (
                <div
                  style={{
                    background: "var(--bg-elev)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  {m.node}
                </div>
              )}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: "1px solid var(--border-soft)", padding: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              style={CHIP_STYLE}
              onClick={() => {
                trigger(a.key, a.label);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={INPUT_STYLE}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitText();
            }}
            placeholder="Ask your agent… e.g. “fund agent wallet”"
          />
        </div>
      </div>
    </>
  );
}

/** Inline funding instructions for the chat — copy the agent address + a
 *  link to the public Circle faucet (the programmatic faucet needs a
 *  mainnet-upgraded account). */
function FundInline() {
  const agent = useAgentPortfolio();
  if (!agent.agentAddress) return <AgentNotReady agent={agent} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        className="mono"
        style={{ fontSize: 12, color: "var(--text-dim)", wordBreak: "break-all" }}
      >
        {agent.agentAddress}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <CopyButton value={agent.agentAddress} label="Copy agent address" />
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "none", fontSize: 12 }}
        >
          Open faucet.circle.com ↗
        </a>
      </div>
    </div>
  );
}
