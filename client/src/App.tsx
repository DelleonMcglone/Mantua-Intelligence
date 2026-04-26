import { usePrivy } from "@privy-io/react-auth";
import { LoginScreen } from "./components/LoginScreen.tsx";

export default function App() {
  const { ready, authenticated, user, logout } = usePrivy();

  if (!ready || !authenticated) return <LoginScreen />;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Mantua.AI</h1>
        <p className="text-sm text-neutral-400">
          Logged in as{" "}
          <span className="font-mono text-xs">
            {user?.wallet?.address ?? user?.email?.address ?? user?.id}
          </span>
        </p>
        <p className="text-xs text-neutral-500">
          Shell + Portfolio land in Phase D (PD-004). Swap UI in Phase 3.
        </p>
        <button
          onClick={() => {
            logout();
          }}
          className="text-xs text-neutral-500 hover:text-neutral-300 underline"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
