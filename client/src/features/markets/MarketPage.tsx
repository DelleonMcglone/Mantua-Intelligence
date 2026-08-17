import { usePrivy } from "@privy-io/react-auth";
import { PanelHeader } from "@/components/shell/PanelHeader.tsx";
import { PanelSubHeader } from "@/components/shell/PanelSubHeader.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SPORTS, getSport, type SportId } from "./sports.ts";

interface Props {
  sport: SportId;
  onSelectSport: (id: SportId) => void;
  onClose?: () => void;
}

/**
 * Per-league market page — the landing header's league nav lands here.
 *
 * The market list itself isn't built yet: the Dynamic Market Hook has to
 * be deployed and its games indexed before there's anything to price. So
 * this renders the league's identity, a league switcher, and the trading
 * gate, and says plainly that markets aren't open. Swap the empty state
 * for the real list when the hook goes live; the route, nav, and gate
 * around it stay as they are.
 */
export function MarketPage({ sport, onSelectSport, onClose }: Props) {
  const { authenticated, login } = usePrivy();
  const active = getSport(sport);
  const Icon = active.icon;
  const isCovered = active.coverage === "launch";
  const launchSports = SPORTS.filter((s) => s.coverage === "launch");
  const launchLabels = launchSports.map((s) => s.label).join(" and ");
  const handleLogin = () => {
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator, @typescript-eslint/no-confusing-void-expression
    void login();
  };

  return (
    <>
      <PanelHeader />
      <PanelSubHeader
        title={`${active.label} markets`}
        subtitle={active.blurb}
        {...(onClose ? { onClose } : {})}
      />

      <nav aria-label="Leagues" className="px-5 pb-4">
        <ul className="flex flex-wrap gap-2">
          {SPORTS.map((s) => {
            const isActive = s.id === active.id;
            const SportIcon = s.icon;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectSport(s.id);
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border-soft bg-transparent text-text-dim hover:text-text"
                  }`}
                >
                  <SportIcon className="h-4 w-4" />
                  {s.label}
                  {s.coverage === "soon" && (
                    <span className="ml-0.5 rounded-[3px] bg-chip px-1 py-px font-mono text-[9px] uppercase tracking-wider text-text-mute">
                      Soon
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex-1 overflow-auto px-5 pb-6">
        <div className="rounded-md border border-border-soft bg-panel-solid px-5 py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
            <Icon className="h-6 w-6" />
          </div>
          {isCovered ? (
            <>
              <h3 className="text-[15px] font-semibold">No open {active.label} markets yet</h3>
              <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-text-dim">
                The Dynamic Market Hook adapts pricing, fees, liquidity, and risk parameters in real
                time as conditions move. {active.label} games will list here as markets open.
              </p>
              <p className="mx-auto mt-3 max-w-sm text-[11px] leading-relaxed text-text-mute">
                Markets resolve from live game data via a Mantua-operated resolver with manual
                override; resolutions are final and publicly logged. Postponed, cancelled, or tied
                games void and settle at 0.50 per token. See the docs and Terms for details.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-[15px] font-semibold">{active.label} — coming soon</h3>
              <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-text-dim">
                {launchLabels} are covered first. {active.label} joins once those markets are
                running.
              </p>
              {launchSports.length > 0 && (
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {launchSports.map((s) => {
                    const SportIcon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectSport(s.id);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent/20 cursor-pointer"
                      >
                        <SportIcon className="h-4 w-4" />
                        Go to {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {isCovered && (
          <div className="mt-4 rounded-md border border-border-soft px-5 py-4">
            {authenticated ? (
              <p className="text-[12.5px] leading-relaxed text-text-dim">
                You&apos;re logged in — you can take a position as soon as {active.label} markets
                open.
              </p>
            ) : (
              <>
                <p className="text-[12.5px] leading-relaxed text-text-dim">
                  Browsing is open to everyone. Placing a trade, or any other on-chain transaction,
                  needs a logged-in wallet.
                </p>
                <Button variant="primary" size="lg" className="mt-4 w-full" onClick={handleLogin}>
                  Log in to trade
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
