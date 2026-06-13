import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { BridgeView } from "./BridgeView.tsx";
import { SendView } from "./SendView.tsx";

type Tab = "bridge" | "send";

/**
 * Transfer hub — hosts the App Kit Bridge (CCTP v2) and Send (same-chain
 * transfer) tabs, both signed by the user's Privy wallet. Unified Balance
 * (Gateway) will join as a third tab in a later phase.
 */
export function TransferPanel({
  onClose,
  initialTab = "bridge",
}: {
  onClose: () => void;
  initialTab?: Tab;
}) {
  const { authenticated, login } = usePrivy();
  const [tab, setTab] = useState<Tab>(initialTab);

  function onConnect() {
    login();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader />
      <PanelSubHeader
        title={tab === "bridge" ? "Bridge" : "Send"}
        subtitle={
          tab === "bridge" ? "Move USDC across chains via CCTP" : "Send USDC or EURC to an address"
        }
        onClose={onClose}
      />

      <div className="px-5 flex gap-2 border-b border-border-soft">
        {(["bridge", "send"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
            }}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-accent text-text"
                : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            {t === "bridge" ? "Bridge" : "Send"}
          </button>
        ))}
      </div>

      {tab === "bridge" ? (
        <BridgeView authenticated={authenticated} onConnect={onConnect} />
      ) : (
        <SendView authenticated={authenticated} onConnect={onConnect} />
      )}
    </div>
  );
}
