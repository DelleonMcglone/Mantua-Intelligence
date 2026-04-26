import { usePrivy } from "@privy-io/react-auth";
import { AppShell } from "./components/shell/AppShell.tsx";
import { Card } from "./components/shell/Card.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { SwapPanel } from "./features/swap/SwapPanel.tsx";

/**
 * Phase 3 — Swap Core: right column now hosts the SwapPanel. Login gates
 * the shell; placeholder Portfolio + Assets cards on the left are wired
 * to live data in Phase 8.
 */
export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return <LoginScreen onLogin={() => undefined} loading />;
  }
  if (!authenticated) {
    return <LoginScreen onLogin={login} />;
  }

  const walletAddress = user?.wallet?.address;

  return (
    <AppShell
      walletAddress={walletAddress}
      onDisconnect={() => {
        logout();
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
      right={<SwapPanel />}
    />
  );
}
