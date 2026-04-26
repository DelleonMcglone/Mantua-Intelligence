import { usePrivy } from "@privy-io/react-auth";

/**
 * P2-012 — minimal login screen. Visual styling is a placeholder until
 * Phase D (PD-006) extracts design tokens from the prototype.
 */
export function LoginScreen() {
  const { login, ready, authenticated } = usePrivy();

  if (!ready) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
        <div className="text-sm text-neutral-400">Loading…</div>
      </main>
    );
  }

  if (authenticated) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 flex items-center justify-center">
      <div className="w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mantua.AI</h1>
          <p className="text-sm text-neutral-400 mt-2">
            A liquidity copilot that researches, routes, and executes with you — on Base.
          </p>
        </div>
        <button
          onClick={() => {
            login();
          }}
          className="w-full rounded-lg bg-[#8b6cf0] hover:bg-[#7a5be0] text-white font-medium py-3 px-4 transition-colors"
        >
          Continue
        </button>
        <p className="text-xs text-neutral-500">
          Email · Google · Apple · Passkey · External wallet
        </p>
      </div>
    </main>
  );
}
