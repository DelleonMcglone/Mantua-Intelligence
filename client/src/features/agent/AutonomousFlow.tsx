import { useState, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { api } from "@/lib/api.ts";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import {
  AgentActionError,
  AgentActionSuccess,
  AgentNotReady,
  AgentWalletStrip,
  shortAddr,
  useAgentAction,
} from "./agent-gate.tsx";
import { Banner, BTN_GHOST, BTN_PRIMARY, DetailRows, PANEL_BODY } from "./agent-primitives.tsx";

/**
 * F7 — Autonomous mode. A natural-language instruction is parsed into a
 * structured intent by `POST /api/agent/instruction`, then the user
 * confirms execution: `send` and `swap` intents run through their real
 * agent endpoints (the Circle wallet on Arc). Other intent kinds are
 * surfaced honestly — the server defers their auto-execution — and
 * `clarify`/`reject` show the model's question/reason. Nothing fires
 * without an explicit confirm; spending caps are enforced server-side.
 */

interface Props {
  onClose: () => void;
  /** Back returns to the agent mode picker. */
  onBack?: () => void;
}

type AgentIntent =
  | {
      kind: "swap";
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      slippageTolerance?: number;
    }
  | { kind: "send"; to: string; token: string; amount: string }
  | {
      kind: "add_liquidity";
      tokenA: string;
      tokenB: string;
      fee: number;
      amountA: string;
      amountB: string;
    }
  | { kind: "remove_liquidity"; positionId: string; percentage: number }
  | { kind: "query"; type: "pools" | "pool" | "chart"; poolId?: string; days?: number }
  | { kind: "wallet"; action: "create" | "info" | "set_cap"; dailyCapUsd?: number }
  | { kind: "clarify"; question: string }
  | { kind: "reject"; reason: string };

interface ParseResult {
  intent: AgentIntent;
  raw: string;
  model: string;
}

interface ExecResult {
  txHash: string;
  explorerUrl: string;
}

const AUTONOMOUS_PROMPTS = [
  "Swap 25 USDC to EURC",
  "Send 10 USDC to 0x0000000000000000000000000000000000000000",
  "Show me the available pools",
  "Set my daily spend cap to 250 USDC",
];

const INTENT_LABEL: Record<AgentIntent["kind"], string> = {
  swap: "Swap",
  send: "Send",
  add_liquidity: "Add liquidity",
  remove_liquidity: "Remove liquidity",
  query: "Query",
  wallet: "Wallet",
  clarify: "Needs clarification",
  reject: "Out of scope",
};

function intentRows(intent: AgentIntent): { label: string; value: ReactNode }[] {
  switch (intent.kind) {
    case "send":
      return [
        { label: "To", value: shortAddr(intent.to) },
        { label: "Amount", value: `${intent.amount} ${intent.token}` },
      ];
    case "swap":
      return [
        { label: "Pay", value: `${intent.amountIn} ${intent.tokenIn}` },
        { label: "Receive", value: intent.tokenOut },
      ];
    case "add_liquidity":
      return [
        { label: "Pair", value: `${intent.tokenA} / ${intent.tokenB}` },
        { label: "Amounts", value: `${intent.amountA} / ${intent.amountB}` },
        { label: "Fee", value: `${String(intent.fee / 10_000)}%` },
      ];
    case "remove_liquidity":
      return [
        { label: "Position", value: intent.positionId },
        { label: "Remove", value: `${String(intent.percentage)}%` },
      ];
    case "query":
      return [{ label: "Type", value: intent.type }];
    case "wallet":
      return [
        { label: "Action", value: intent.action },
        ...(intent.dailyCapUsd !== undefined
          ? [{ label: "Daily cap", value: `$${String(intent.dailyCapUsd)}` }]
          : []),
      ];
    case "clarify":
      return [{ label: "Question", value: intent.question }];
    case "reject":
      return [{ label: "Reason", value: intent.reason }];
  }
}

export function AutonomousFlow({ onClose, onBack }: Props) {
  const agent = useAgentPortfolio();
  const [text, setText] = useState("");
  const parse = useAgentAction<ParseResult>();
  const exec = useAgentAction<ExecResult>();

  const intent = parse.status === "success" ? (parse.result?.intent ?? null) : null;
  const parsing = parse.status === "loading";
  const executing = exec.status === "loading";

  const resetAll = () => {
    parse.reset();
    exec.reset();
  };

  const runExec = (intent: AgentIntent) => {
    if (intent.kind === "send") {
      void exec.run(() =>
        api.post<ExecResult>("/api/agent/send", {
          to: intent.to,
          amount: intent.amount,
          token: intent.token,
        }),
      );
    } else if (intent.kind === "swap") {
      void exec.run(() =>
        api.post<ExecResult>("/api/agent/swap", {
          tokenIn: intent.tokenIn,
          tokenOut: intent.tokenOut,
          amountIn: intent.amountIn,
        }),
      );
    }
  };

  return (
    <>
      <PanelHeader />

      <div className="px-5 pt-4 pb-3.5 flex items-center justify-between gap-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="h-7 px-2 inline-flex items-center gap-1 rounded-xs border border-border-soft bg-transparent text-text-dim text-[12px] hover:text-text"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : (
          <span className="w-[60px]" />
        )}
        <div className="text-[15px] font-semibold inline-flex items-center gap-2">
          <span aria-hidden>🤖</span> Autonomous Mode
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="h-7 w-7 inline-flex items-center justify-center rounded-xs border border-border-soft bg-transparent text-text-dim hover:text-text"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          <AgentWalletStrip agent={agent} />
          {intent === null ? (
            <div style={PANEL_BODY}>
              <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
                INSTRUCTION
              </div>
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (parse.status !== "idle") parse.reset();
                }}
                placeholder="Tell the agent what to do — e.g. “Swap 25 USDC to EURC”."
                rows={3}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: "10px 12px",
                  background: "var(--bg-elev)",
                  border: "1px solid var(--border-soft)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AUTONOMOUS_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setText(p);
                      parse.reset();
                    }}
                    style={{
                      fontSize: 11,
                      color: "var(--text-dim)",
                      background: "var(--chip)",
                      border: "1px solid var(--border-soft)",
                      borderRadius: 99,
                      padding: "5px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!text.trim() || parsing}
                style={{
                  ...BTN_PRIMARY,
                  width: "100%",
                  padding: 12,
                  opacity: text.trim() && !parsing ? 1 : 0.5,
                }}
                onClick={() => {
                  void parse.run(() =>
                    api.post<ParseResult>("/api/agent/instruction", { text: text.trim() }),
                  );
                }}
              >
                {parsing ? "Interpreting…" : "Interpret instruction"}
              </button>
              {parse.status === "error" && parse.error && (
                <AgentActionError message={parse.error} />
              )}
            </div>
          ) : (
            <div style={PANEL_BODY}>
              <div style={{ fontSize: 11, color: "var(--text-mute)", letterSpacing: ".06em" }}>
                INTERPRETED AS · {INTENT_LABEL[intent.kind]}
              </div>
              <DetailRows rows={intentRows(intent)} />

              {exec.status === "success" && exec.result ? (
                <AgentActionSuccess
                  title="Executed"
                  txHash={exec.result.txHash}
                  explorerUrl={exec.result.explorerUrl}
                />
              ) : intent.kind === "send" || intent.kind === "swap" ? (
                <>
                  {exec.status === "error" && exec.error && (
                    <AgentActionError message={exec.error} />
                  )}
                  <button
                    type="button"
                    disabled={executing}
                    style={{
                      ...BTN_PRIMARY,
                      width: "100%",
                      padding: 12,
                      opacity: executing ? 0.6 : 1,
                    }}
                    onClick={() => {
                      runExec(intent);
                    }}
                  >
                    {executing
                      ? "Executing…"
                      : `Confirm ${intent.kind === "send" ? "send" : "swap"}`}
                  </button>
                </>
              ) : intent.kind === "clarify" ? (
                <Banner tone="warn" icon="?" title="Needs more detail">
                  {intent.question}
                </Banner>
              ) : intent.kind === "reject" ? (
                <Banner tone="error" icon="⊘" title="Can't do that one">
                  {intent.reason}
                </Banner>
              ) : (
                <Banner tone="info" icon="ℹ" title="Parsed, but not auto-executed here">
                  {INTENT_LABEL[intent.kind]} actions run from their own panel — autonomous mode
                  executes sends and swaps directly.
                </Banner>
              )}

              <button
                type="button"
                style={{ ...BTN_GHOST, alignSelf: "flex-start" }}
                onClick={resetAll}
              >
                New instruction
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
