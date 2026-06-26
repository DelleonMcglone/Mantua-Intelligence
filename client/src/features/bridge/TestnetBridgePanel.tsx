import { useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { ExternalLink } from "lucide-react";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ARC_TESTNET_CHAIN_ID, getExplorerTxUrl } from "@/lib/chains.ts";
import { TOKENS } from "@/lib/tokens.ts";
import { usePortfolio } from "@/features/portfolio/use-portfolio.ts";
import { useConfirmedAction } from "@/hooks/use-confirmed-action.tsx";
import { BRIDGE_DESTINATIONS, type BridgeDestination } from "./bridge-chains.ts";
import { useBridge } from "./use-bridge.ts";

const USDC_DECIMALS = TOKENS.USDC.decimals; // 6

function fmtBalance(raw: bigint): string {
  const n = Number(formatUnits(raw, USDC_DECIMALS));
  if (n === 0) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function TestnetBridgePanel({ onClose }: { onClose?: () => void }) {
  const portfolio = usePortfolio();
  const confirm = useConfirmedAction();
  const bridge = useBridge();
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState<BridgeDestination>(BRIDGE_DESTINATIONS[0]);

  const walletAddress = portfolio.walletAddress;
  const balanceRaw = useMemo(() => {
    const b = portfolio.balances.find((x) => x.symbol === "USDC");
    return b ? BigInt(b.balanceRaw) : 0n;
  }, [portfolio.balances]);

  const amountRaw = useMemo(() => {
    try {
      return amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const { status } = bridge.state;
  const busy =
    status === "preparing" ||
    status === "approving" ||
    status === "burning" ||
    status === "attesting" ||
    status === "minting";
  const overBalance = amountRaw > balanceRaw;
  const canBridge = !busy && amountRaw > 0n && !overBalance;

  async function onBridge() {
    if (!canBridge) return;
    const ok = await confirm({
      title: `Bridge ${amount} USDC → ${destination.label}`,
      description: `From Arc Testnet via Circle CCTP. You sign approve + burn on Arc; Circle mints USDC to your address on ${destination.label}.`,
      confirmLabel: "Bridge",
    });
    if (!ok) return;
    await bridge.execute({ amount, destination });
  }

  const buttonLabel = (() => {
    switch (status) {
      case "preparing":
        return "Preparing…";
      case "approving":
        return "Approve in wallet…";
      case "burning":
        return "Burning on Arc…";
      case "attesting":
        return "Awaiting attestation…";
      case "minting":
        return "Minting on destination…";
      case "success":
        return "Bridge complete";
      default:
        return amountRaw === 0n
          ? "Enter amount"
          : overBalance
            ? "Insufficient USDC"
            : "Review bridge";
    }
  })();

  if (!walletAddress) {
    return (
      <>
        <PanelHeader />
        <PanelSubHeader
          title="Bridge"
          subtitle="Move USDC to another network."
          {...(onClose ? { onClose } : {})}
        />
        <div className="px-5 py-8 text-center text-[12px] text-text-dim">
          Connect a wallet to bridge USDC.
        </div>
      </>
    );
  }

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title="Bridge"
        subtitle="Move USDC from Arc to another network (Circle CCTP)."
        {...(onClose ? { onClose } : {})}
      />

      <div className="px-5 py-3.5 flex-1 overflow-auto space-y-4">
        {/* From: USDC on Arc + amount */}
        <div className="bg-panel-solid border border-border-soft rounded-md p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-text-dim">
            <span>From · Arc Testnet</span>
            <span>
              Balance: {fmtBalance(balanceRaw)} USDC
              {balanceRaw > 0n && (
                <button
                  type="button"
                  onClick={() => {
                    setAmount(formatUnits(balanceRaw, USDC_DECIMALS));
                  }}
                  className="ml-2 text-accent hover:text-accent-2 font-medium uppercase tracking-wider text-[10px]"
                >
                  Max
                </button>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
              }}
              disabled={busy}
              className="border-0 bg-transparent text-2xl font-mono p-0 h-auto"
            />
            <span className="px-3 py-1.5 rounded-full bg-bg-elev border border-border-soft text-[13px] font-medium">
              USDC
            </span>
          </div>
        </div>

        {/* To: destination network */}
        <div className="space-y-2">
          <div className="text-[11px] text-text-mute tracking-[0.08em] font-semibold">
            TO NETWORK
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BRIDGE_DESTINATIONS.map((d) => (
              <button
                key={d.sdkName}
                type="button"
                disabled={busy}
                onClick={() => {
                  setDestination(d);
                }}
                className={`px-3 py-2.5 rounded-md border text-left text-[13px] font-medium transition-colors ${
                  d.sdkName === destination.sdkName
                    ? "border-accent bg-accent/10 text-text"
                    : "border-border-soft bg-bg-elev text-text-dim hover:border-accent"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-text-mute">
          Via Circle CCTP + Forwarding Service — you sign approve and burn on Arc; Circle mints USDC
          to your address on {destination.label}. No destination gas required.
        </p>

        <Button
          variant="primary"
          size="md"
          disabled={!canBridge}
          onClick={() => {
            void onBridge();
          }}
          className="w-full"
        >
          {buttonLabel}
        </Button>

        {bridge.state.message && status !== "success" && status !== "error" && (
          <p className="text-[12px] text-text-dim text-center">{bridge.state.message}</p>
        )}
        {status === "error" && bridge.state.error && (
          <p className="text-[12px] text-red text-center">{bridge.state.error}</p>
        )}

        {(bridge.state.burnTx ?? bridge.state.mintTx) && (
          <div className="space-y-1.5 text-[12px]">
            {bridge.state.burnTx && (
              <a
                href={getExplorerTxUrl(ARC_TESTNET_CHAIN_ID, bridge.state.burnTx)}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:text-accent-2 inline-flex items-center gap-1 font-mono"
              >
                Burn on Arc <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {bridge.state.mintTx && (
              <a
                href={destination.explorerTxUrl(bridge.state.mintTx)}
                target="_blank"
                rel="noreferrer"
                className="block text-accent hover:text-accent-2 font-mono"
              >
                Mint on {destination.label} ↗
              </a>
            )}
          </div>
        )}

        {status === "success" && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setAmount("");
              bridge.reset();
            }}
            className="w-full"
          >
            Bridge again
          </Button>
        )}
      </div>
    </>
  );
}
