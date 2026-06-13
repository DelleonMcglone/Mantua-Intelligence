import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { BridgeView } from "./BridgeView.tsx";
import { SendView } from "./SendView.tsx";
import { BalanceView } from "./BalanceView.tsx";

type Tab = "bridge" | "send" | "balance";

const TABS: { id: Tab; label: string; title: string; subtitle: string }[] = [
  { id: "bridge", label: "Bridge", title: "Bridge", subtitle: "Move USDC across chains via CCTP" },
  { id: "send", label: "Send", title: "Send", subtitle: "Send USDC or EURC to an address" },
  {
    id: "balance",
    label: "Balance",
    title: "Unified balance",
    subtitle: "One USDC balance across chains (Gateway)",
  },
];

/**
 * Transfer hub — hosts the App Kit Bridge (CCTP v2), Send (same-chain
 * transfer), and Unified Balance (Gateway v1) tabs, all signed by the
 * user's Privy wallet.
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

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="flex flex-col h-full min-h-0">
      <PanelHeader />
      <PanelSubHeader title={active.title} subtitle={active.subtitle} onClose={onClose} />

      <div className="px-5 flex gap-2 border-b border-border-soft">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
            }}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-accent text-text"
                : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bridge" && <BridgeView authenticated={authenticated} onConnect={onConnect} />}
      {tab === "send" && <SendView authenticated={authenticated} onConnect={onConnect} />}
      {tab === "balance" && <BalanceView authenticated={authenticated} onConnect={onConnect} />}
    </div>
  );
}
