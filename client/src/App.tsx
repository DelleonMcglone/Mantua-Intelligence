import { useState } from "react";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { Button } from "./components/ui/button.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { useConfirmedAction } from "./hooks/use-confirmed-action.tsx";

/**
 * Phase D placeholder app — exercises the design system primitives so we
 * can visually QA tokens, shell layout, and the confirmation modal.
 *
 * Real Privy auth wiring comes from Phase 2 (lands when phase-2 PR rebases
 * onto main). Here we use a local boolean to flip between login and shell.
 */
export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const confirm = useConfirmedAction();

  if (!loggedIn) {
    return (
      <LoginScreen
        onLogin={() => {
          setLoggedIn(true);
          setWalletAddress("0x8f4a5b2c19d3e7f6a1b4c8d9e2f3a4b5c6d7e8f9");
        }}
      />
    );
  }

  return (
    <AppShell
      walletAddress={walletAddress}
      onConnect={() => setWalletAddress("0x8f4a5b2c19d3e7f6a1b4c8d9e2f3a4b5c6d7e8f9")}
      onDisconnect={() => {
        setWalletAddress(undefined);
        setLoggedIn(false);
      }}
      left={
        <>
          <Card>
            <p className="text-xs text-text-mute uppercase tracking-wider">Portfolio</p>
            <p className="text-3xl font-semibold mt-1 font-mono">$72,697.83</p>
            <p className="text-sm text-green mt-1">↗ 3.51% past week</p>
            <p className="text-xs text-text-dim mt-4">
              Real chart + balances arrive in Phase 8 (Portfolio).
            </p>
          </Card>
          <Card>
            <p className="text-xs text-text-mute uppercase tracking-wider">Assets</p>
            <p className="text-sm text-text-dim mt-2">
              ETH · cbBTC · USDC · EURC · LINK
            </p>
            <p className="text-xs text-text-mute mt-4">
              Wired to live balances in Phase 8.
            </p>
          </Card>
        </>
      }
      right={
        <Card className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
          <p className="text-sm text-text-dim">
            Phase D shell scaffold. The right column hosts route panels (chat, swap,
            liquidity, agent, settings) starting in Phase 3.
          </p>
          <Button
            variant="primary"
            onClick={async () => {
              const ok = await confirm({
                title: "Test confirmation modal",
                description:
                  "This is what every Phase 3+ on-chain action will route through. Cancel and Confirm both close the modal.",
                confirmLabel: "Confirm",
              });
              if (ok) alert("Confirmed (placeholder)");
            }}
          >
            Open confirmation modal
          </Button>
        </Card>
      }
    />
  );
}
