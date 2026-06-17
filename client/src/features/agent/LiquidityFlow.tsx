import { useState, type CSSProperties } from "react";
import { api } from "@/lib/api.ts";
import { ACTIVE_CHAIN_ID, getUserFacingTokenSymbols } from "@/lib/tokens.ts";
import { useAgentPortfolio } from "./use-agent-portfolio.ts";
import {
  AgentActionError,
  AgentActionSuccess,
  AgentNotReady,
  AgentWalletStrip,
  useAgentAction,
} from "./agent-gate.tsx";
import {
  BTN_PRIMARY,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  TokenChip,
  X_CLOSE,
} from "./agent-primitives.tsx";

/**
 * F-liquidity — "Add liquidity" from the agent wallet. Pick a pair + fee
 * tier + amounts and mint a Uniswap v4 position through the agent's Circle
 * wallet on Arc (`POST /api/agent/liquidity/add`). Removing agent liquidity
 * is a separate flow (needs an agent-positions list endpoint).
 */

interface Props {
  onClose: () => void;
}

interface AddLiquidityResult {
  txHash: string;
  explorerUrl: string;
  tokenId: string | null;
}

const FEE_TIERS = [
  { v: 100, label: "0.01%" },
  { v: 500, label: "0.05%" },
  { v: 3000, label: "0.3%" },
  { v: 10_000, label: "1%" },
] as const;

const SYMBOLS = getUserFacingTokenSymbols(ACTIVE_CHAIN_ID);

const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  color: "var(--text-mute)",
  letterSpacing: ".06em",
  marginBottom: 6,
};

const ROW_STYLE: CSSProperties = {
  background: "var(--bg-elev)",
  border: "1px solid var(--border-soft)",
  borderRadius: 12,
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const AMOUNT_STYLE: CSSProperties = {
  fontSize: 20,
  fontWeight: 500,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "var(--text)",
  minWidth: 0,
  flex: 1,
};

const SELECT_STYLE: CSSProperties = {
  background: "var(--chip)",
  border: "1px solid var(--border-soft)",
  borderRadius: 99,
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 500,
  padding: "6px 8px",
  fontFamily: "inherit",
  cursor: "pointer",
  flexShrink: 0,
};

export function LiquidityFlow({ onClose }: Props) {
  const agent = useAgentPortfolio();
  const [tokenA, setTokenA] = useState<string>(SYMBOLS[0] ?? "USDC");
  const [tokenB, setTokenB] = useState<string>(SYMBOLS[1] ?? "EURC");
  const [fee, setFee] = useState<number>(500);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const add = useAgentAction<AddLiquidityResult>();
  const busy = add.status === "loading";
  const valid = tokenA !== tokenB && amountA !== "" && amountB !== "";

  // Keep the pair distinct: picking a token equal to the other side swaps them.
  const pickA = (v: string) => {
    setTokenA(v);
    if (v === tokenB) setTokenB(tokenA);
    if (add.status !== "idle") add.reset();
  };
  const pickB = (v: string) => {
    setTokenB(v);
    if (v === tokenA) setTokenA(tokenB);
    if (add.status !== "idle") add.reset();
  };

  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_TITLE}>Add liquidity</div>
        <button type="button" style={X_CLOSE} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {!agent.agentAddress ? (
        <AgentNotReady agent={agent} />
      ) : (
        <>
          <AgentWalletStrip agent={agent} label="From agent wallet" />
          <div style={{ ...PANEL_BODY, gap: 10 }}>
            <div>
              <div style={LABEL_STYLE}>TOKEN A</div>
              <div style={ROW_STYLE}>
                <input
                  className="mono"
                  style={AMOUNT_STYLE}
                  value={amountA}
                  onChange={(e) => {
                    setAmountA(e.target.value);
                    if (add.status !== "idle") add.reset();
                  }}
                  placeholder="0.00"
                />
                <TokenChip sym={tokenA} size={18} />
                <select
                  value={tokenA}
                  onChange={(e) => {
                    pickA(e.target.value);
                  }}
                  style={SELECT_STYLE}
                  aria-label="Token A"
                >
                  {SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div style={LABEL_STYLE}>TOKEN B</div>
              <div style={ROW_STYLE}>
                <input
                  className="mono"
                  style={AMOUNT_STYLE}
                  value={amountB}
                  onChange={(e) => {
                    setAmountB(e.target.value);
                    if (add.status !== "idle") add.reset();
                  }}
                  placeholder="0.00"
                />
                <TokenChip sym={tokenB} size={18} />
                <select
                  value={tokenB}
                  onChange={(e) => {
                    pickB(e.target.value);
                  }}
                  style={SELECT_STYLE}
                  aria-label="Token B"
                >
                  {SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div style={LABEL_STYLE}>FEE TIER</div>
              <div style={{ display: "flex", gap: 8 }}>
                {FEE_TIERS.map((t) => (
                  <button
                    key={t.v}
                    type="button"
                    onClick={() => {
                      setFee(t.v);
                      if (add.status !== "idle") add.reset();
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      background: fee === t.v ? "var(--accent)" : "var(--bg-elev)",
                      color: fee === t.v ? "#fff" : "var(--text-dim)",
                      border: `1px solid ${fee === t.v ? "var(--accent)" : "var(--border-soft)"}`,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!valid || busy}
              style={{
                ...BTN_PRIMARY,
                width: "100%",
                padding: 12,
                marginTop: 4,
                opacity: valid && !busy ? 1 : 0.5,
              }}
              onClick={() => {
                void add.run(() =>
                  api.post<AddLiquidityResult>("/api/agent/liquidity/add", {
                    tokenA,
                    tokenB,
                    fee,
                    amountA,
                    amountB,
                  }),
                );
              }}
            >
              {busy ? "Adding liquidity…" : "Add liquidity"}
            </button>

            {add.status === "success" && add.result && (
              <AgentActionSuccess
                title={`Added ${amountA} ${tokenA} + ${amountB} ${tokenB}`}
                detail={
                  add.result.tokenId
                    ? `Minted position #${add.result.tokenId} on Arc.`
                    : "Position minted on Arc."
                }
                txHash={add.result.txHash}
                explorerUrl={add.result.explorerUrl}
              />
            )}
            {add.status === "error" && add.error && <AgentActionError message={add.error} />}
          </div>
        </>
      )}
    </>
  );
}
