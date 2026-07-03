import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowLeft, Bot, X } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import { AgentWalletStrip, shortAddr } from "./agent-gate.tsx";
import {
  Banner,
  DetailRows,
  PANEL_HEAD,
  PANEL_TITLE,
  Spinner,
  TxRow,
  X_CLOSE,
} from "./agent-primitives.tsx";
import { streamAgentChat, AgentStreamError, type AgentChatEvent } from "./agent-stream.ts";
import { UserBubble, RichText, Caret } from "./chat-text.tsx";

/**
 * "Your Circle Agent" — a free-form, autonomous conversational agent.
 *
 * The user types in the global "Ask Mantua" bar (App.tsx forwards it via the
 * `mantua:agent-input` event). Each turn streams from `POST /api/agent/chat`:
 * assistant text tokens arrive live, and tool steps (swap / send / portfolio /
 * market data) render as result cards as the server executes them on the
 * Circle wallet. There are no forms and no confirmation — the agent acts.
 */

interface Props {
  onClose: () => void;
  /** Command forwarded from another panel — auto-sent once on mount. */
  initialMessage?: string;
}

interface ToolStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "running" | "ok" | "error";
  data?: unknown;
  error?: string;
}

interface UserMsg {
  id: string;
  role: "user";
  text: string;
}
interface AssistantMsg {
  id: string;
  role: "assistant";
  text: string;
  steps: ToolStep[];
  streaming: boolean;
  failed?: string;
}
type Msg = UserMsg | AssistantMsg;

const SUGGESTIONS = [
  "Create and manage agent wallet",
  "Fund wallet",
  "Query on-chain data",
  "Swap Tokens",
  "Send Tokens",
];

const TOOL_VERB: Record<string, string> = {
  get_portfolio: "Reading portfolio",
  manage_wallet: "Checking wallet",
  get_swap_quote: "Fetching a quote",
  swap: "Executing swap",
  send: "Sending tokens",
  get_market_data: "Pulling market data",
};

let seq = 0;
const uid = () => {
  seq += 1;
  return `m${String(seq)}`;
};

export function CircleAgentChat({ onClose, initialMessage }: Props) {
  const agent = useAgentPortfolio();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const patchAssistant = useCallback((id: string, fn: (m: AssistantMsg) => AssistantMsg) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.role === "assistant" ? fn(m) : m)));
  }, []);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;

      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text },
        { id: assistantId, role: "assistant", text: "", steps: [], streaming: true },
      ]);
      setBusy(true);
      busyRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const onEvent = (ev: AgentChatEvent) => {
        switch (ev.type) {
          case "session":
            sessionIdRef.current = ev.sessionId;
            break;
          case "text":
            patchAssistant(assistantId, (m) => ({ ...m, text: m.text + ev.delta }));
            break;
          case "tool_start":
            patchAssistant(assistantId, (m) => ({
              ...m,
              steps: [...m.steps, { id: ev.id, tool: ev.tool, args: ev.args, status: "running" }],
            }));
            break;
          case "tool_result":
            patchAssistant(assistantId, (m) => ({
              ...m,
              steps: m.steps.map((s) =>
                s.id === ev.id
                  ? {
                      ...s,
                      status: ev.ok ? "ok" : "error",
                      ...(ev.data !== undefined ? { data: ev.data } : {}),
                      ...(ev.error !== undefined ? { error: ev.error } : {}),
                    }
                  : s,
              ),
            }));
            break;
          case "error":
            patchAssistant(assistantId, (m) => ({ ...m, failed: ev.message }));
            break;
          case "done":
            break;
        }
      };

      streamAgentChat(
        { message: text, sessionId: sessionIdRef.current },
        onEvent,
        controller.signal,
      )
        .catch((err: unknown) => {
          const msg =
            err instanceof AgentStreamError
              ? err.status === 401
                ? "Please sign in to use the agent."
                : err.message
              : err instanceof DOMException && err.name === "AbortError"
                ? null
                : "The agent connection dropped.";
          if (msg) patchAssistant(assistantId, (m) => ({ ...m, failed: msg }));
        })
        .finally(() => {
          patchAssistant(assistantId, (m) => ({ ...m, streaming: false }));
          setBusy(false);
          busyRef.current = false;
          abortRef.current = null;
        });
    },
    [patchAssistant],
  );

  // Always call the latest `send` from the window listener (no stale closure).
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);
  useEffect(() => {
    const onInput = (e: Event) => {
      sendRef.current((e as CustomEvent<string>).detail);
    };
    window.addEventListener("mantua:agent-input", onInput);
    return () => {
      window.removeEventListener("mantua:agent-input", onInput);
    };
  }, []);

  // Seed the first turn from a command typed in another panel (App.tsx routes
  // hookless / agent commands here). Fires once on mount; `send` owns its own
  // setState so this stays lint-clean.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !initialMessage) return;
    seededRef.current = true;
    sendRef.current(initialMessage);
  }, [initialMessage]);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    sessionIdRef.current = undefined;
    busyRef.current = false;
    setBusy(false);
    setMessages([]);
  }, []);

  return (
    <>
      <PanelHeader onNewChat={newChat} />

      <div style={PANEL_HEAD}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {messages.length > 0 && (
            <button
              type="button"
              style={X_CLOSE}
              onClick={newChat}
              aria-label="Back to suggestions"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <div style={PANEL_TITLE}>
            <Bot className="h-4 w-4" aria-hidden /> Your Circle Agent
          </div>
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
          gap: 14,
        }}
      >
        {messages.length === 0 ? (
          <EmptyState onPick={send} disabled={busy} />
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} text={m.text} />
            ) : (
              <AssistantBubble key={m.id} msg={m} />
            ),
          )
        )}
        <div ref={endRef} />
      </div>
    </>
  );
}

function AssistantBubble({ msg }: { msg: AssistantMsg }) {
  const showThinking = msg.streaming && msg.text === "" && msg.steps.length === 0;
  return (
    <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 10 }}>
      {showThinking && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spinner agent />
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>Thinking…</span>
        </div>
      )}

      {msg.steps.map((step) => (
        <StepCard key={step.id} step={step} />
      ))}

      {msg.text && (
        <div
          style={{
            fontSize: 13,
            color: "var(--text)",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            maxWidth: "92%",
          }}
        >
          <RichText text={msg.text} />
          {msg.streaming && <Caret />}
        </div>
      )}

      {msg.failed && (
        <Banner tone="error" icon="⊘" title="Something went wrong">
          {msg.failed}
        </Banner>
      )}
    </div>
  );
}

const CARD: CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  padding: 14,
};

function StepCard({ step }: { step: ToolStep }) {
  if (step.status === "running") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Spinner agent />
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {TOOL_VERB[step.tool] ?? "Working"}…
        </span>
      </div>
    );
  }
  if (step.status === "error") {
    return (
      <Banner tone="error" icon="⊘" title={`${TOOL_VERB[step.tool] ?? step.tool} failed`}>
        {step.error ?? "Unknown error"}
      </Banner>
    );
  }
  return <div style={CARD}>{renderResult(step)}</div>;
}

// ── Result renderers (read-only views of the server tool results) ──

interface SwapData {
  txHash: string;
  explorerUrl: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}
interface SendData {
  txHash: string;
  explorerUrl: string;
  amount: string;
  symbol: string;
  to: string;
}
interface PortfolioData {
  address: string;
  balances: { symbol: string; balance: string; usdValue: number }[];
}
interface QuoteData {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}
interface WalletData {
  address: string;
  dailyCapUsd: string | number;
  status: string;
}
interface AnalyzeData {
  title: string;
  summary: string;
  metrics?: { label: string; value: string }[];
  bullets?: string[];
  sources?: { name: string; url?: string }[];
}

function fmtNum(s: string): string {
  const n = Number(s);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : s;
}

function renderResult(step: ToolStep): ReactNode {
  switch (step.tool) {
    case "swap": {
      const d = step.data as SwapData;
      return (
        <Success
          title={`Swapped ${fmtNum(d.amountIn)} ${d.tokenIn} → ${fmtNum(d.amountOut)} ${d.tokenOut}`}
          txHash={d.txHash}
          explorerUrl={d.explorerUrl}
        />
      );
    }
    case "send": {
      const d = step.data as SendData;
      return (
        <Success
          title={`Sent ${fmtNum(d.amount)} ${d.symbol}`}
          detail={`To ${shortAddr(d.to)}`}
          txHash={d.txHash}
          explorerUrl={d.explorerUrl}
        />
      );
    }
    case "get_portfolio": {
      const d = step.data as PortfolioData;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Heading>Agent wallet balances</Heading>
          <DetailRows
            rows={d.balances.map((b) => ({
              label: b.symbol,
              value: `${fmtNum(b.balance)}${b.usdValue ? ` · $${b.usdValue.toFixed(2)}` : ""}`,
            }))}
          />
        </div>
      );
    }
    case "get_swap_quote": {
      const d = step.data as QuoteData;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Heading>Quote</Heading>
          <DetailRows
            rows={[
              { label: "Pay", value: `${fmtNum(d.amountIn)} ${d.tokenIn}` },
              { label: "Receive", value: `${fmtNum(d.amountOut)} ${d.tokenOut}` },
            ]}
          />
        </div>
      );
    }
    case "manage_wallet": {
      const d = step.data as WalletData;
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Heading>Agent wallet</Heading>
          <DetailRows
            rows={[
              { label: "Address", value: shortAddr(d.address) },
              { label: "Daily cap", value: `$${String(d.dailyCapUsd)}` },
              { label: "Status", value: d.status },
            ]}
          />
        </div>
      );
    }
    case "get_market_data": {
      const d = step.data as AnalyzeData;
      return <AnalyzeView data={d} />;
    }
    case "get_user_wallet": {
      const d = step.data as {
        connected: boolean;
        address?: string;
        balances?: { symbol: string; balance: string; usdValue: number }[];
      };
      if (!d.connected) {
        return <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No wallet connected.</span>;
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Heading>Your wallet balances</Heading>
          <DetailRows
            rows={(d.balances ?? []).map((b) => ({
              label: b.symbol,
              value: `${fmtNum(b.balance)}${b.usdValue ? ` · $${b.usdValue.toFixed(2)}` : ""}`,
            }))}
          />
        </div>
      );
    }
    case "fund_wallet": {
      const d = step.data as {
        requested: boolean;
        agentAddress: string;
        faucet?: string;
        note?: string;
      };
      return d.requested ? (
        <Banner tone="success" icon="✓" title="Testnet USDC requested">
          Circle&apos;s faucet is sending USDC to {shortAddr(d.agentAddress)} — balances refresh
          once it lands.
        </Banner>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Heading>Fund the agent wallet</Heading>
          <DetailRows
            rows={[
              { label: "Agent address", value: shortAddr(d.agentAddress) },
              { label: "Faucet", value: d.faucet ?? "https://faucet.circle.com" },
            ]}
          />
        </div>
      );
    }
    case "bridge": {
      const d = step.data as {
        amount: string;
        destinationChain: string;
        recipient: string;
        burnTxHash?: string;
        mintTxHash?: string;
      };
      const label = d.destinationChain.replace(/_/g, " ");
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Banner tone="success" icon="✓" title={`Bridged ${fmtNum(d.amount)} USDC → ${label}`}>
            Recipient {shortAddr(d.recipient)} on {label}. Circle&apos;s forwarding fee is deducted
            from the minted amount.
          </Banner>
          {d.burnTxHash && (
            <TxRow
              hash={d.burnTxHash}
              explorerUrl={`https://testnet.arcscan.app/tx/${d.burnTxHash}`}
            />
          )}
        </div>
      );
    }
    case "create_pool": {
      const d = step.data as {
        alreadyExists: boolean;
        tokenA: string;
        tokenB: string;
        fee: number;
        txHash?: string;
        explorerUrl?: string;
      };
      if (d.alreadyExists) {
        return (
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {d.tokenA}/{d.tokenB} pool already exists — adding liquidity instead.
          </span>
        );
      }
      return d.txHash && d.explorerUrl ? (
        <Success
          title={`Created ${d.tokenA}/${d.tokenB} pool (${(d.fee / 10000).toFixed(2)}%)`}
          txHash={d.txHash}
          explorerUrl={d.explorerUrl}
        />
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Pool created.</span>
      );
    }
    case "get_positions": {
      const d = step.data as {
        positions: { id: string; pair: string; fee: number; liquidity: string }[];
      };
      if (d.positions.length === 0) {
        return <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No open positions.</span>;
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Heading>Agent LP positions</Heading>
          <DetailRows
            rows={d.positions.map((p) => ({
              label: p.pair,
              value: `${(p.fee / 10000).toFixed(2)}% · L ${fmtNum(p.liquidity)}`,
            }))}
          />
        </div>
      );
    }
    case "add_liquidity":
    case "remove_liquidity": {
      const d = step.data as { txHash?: string; explorerUrl?: string };
      return d.txHash && d.explorerUrl ? (
        <Success
          title={step.tool === "add_liquidity" ? "Liquidity added" : "Liquidity removed"}
          txHash={d.txHash}
          explorerUrl={d.explorerUrl}
        />
      ) : (
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Done.</span>
      );
    }
    default:
      return <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Done.</span>;
  }
}

function Heading({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 600 }}>{children}</div>;
}

function Success({
  title,
  detail,
  txHash,
  explorerUrl,
}: {
  title: string;
  detail?: string;
  txHash: string;
  explorerUrl: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Banner tone="success" icon="✓" title={title}>
        {detail ?? "Executed through your agent wallet on Arc."}
      </Banner>
      <TxRow hash={txHash} explorerUrl={explorerUrl} />
    </div>
  );
}

function AnalyzeView({ data }: { data: AnalyzeData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{data.title}</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55, marginTop: 6 }}>
          {data.summary}
        </p>
      </div>
      {data.metrics && data.metrics.length > 0 && (
        <DetailRows rows={data.metrics.map((m) => ({ label: m.label, value: m.value }))} />
      )}
      {data.bullets && data.bullets.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 13,
            color: "var(--text)",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {data.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {data.sources && data.sources.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--text-mute)" }}>
          Sources:{" "}
          {data.sources.map((s, i, arr) => (
            <span key={`${s.name}-${String(i)}`}>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--text-dim)" }}
                >
                  {s.name} ↗
                </a>
              ) : (
                s.name
              )}
              {i < arr.length - 1 ? ", " : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (s: string) => void; disabled: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
        Hi — I'm your Circle agent on Arc. Tell me what to do in plain language and I'll handle it:
        check balances, swap or send tokens, or look up market &amp; on-chain data. I act
        autonomously within your daily spending cap.
      </div>
      <div
        style={{ display: "flex", flexWrap: "nowrap", gap: 8, overflowX: "auto", paddingBottom: 2 }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => {
              onPick(s);
            }}
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              background: "var(--chip)",
              border: "1px solid var(--border-soft)",
              borderRadius: 99,
              padding: "6px 12px",
              cursor: disabled ? "default" : "pointer",
              fontFamily: "inherit",
              opacity: disabled ? 0.5 : 1,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
