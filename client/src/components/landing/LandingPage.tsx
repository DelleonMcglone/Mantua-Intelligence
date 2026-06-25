import { useState, type ReactNode } from "react";
import { Sun, Moon, ChevronDown, ShieldCheck, Bot, Wallet, BarChart3, Trophy } from "lucide-react";
import { useTheme } from "@/hooks/use-theme.tsx";
import { Logo } from "@/components/shell/Logo.tsx";
import { NetworkLogo } from "@/components/shell/network-icons.tsx";

interface Props {
  /** Called when the user clicks any "Launch Demo" CTA. Hands off
   *  to the in-app shell (App.tsx swaps to `kind: "home"`). */
  onLaunch: () => void;
}

/**
 * Marketing landing page — matches the artist-delivered design at
 * https://1fef8c0e-…spock.replit.dev/. Header (logo + theme toggle
 * + Launch Demo) → hero → demo video placeholder → feature card
 * grid → FAQ accordion → footer. All "Launch Demo" buttons hand
 * off to the in-app shell via the `onLaunch` prop, which flips the
 * top-level route in App.tsx.
 *
 * The page is self-contained: no Privy auth, no API calls, no
 * routing library. Tailwind tokens follow the existing palette
 * (bg / text / panel-solid / accent / border-soft).
 */
export function LandingPage({ onLaunch }: Props) {
  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Header onLaunch={onLaunch} />
      <main className="flex-1 flex flex-col items-center px-5 sm:px-8 pt-10 pb-16">
        <Hero onLaunch={onLaunch} />
        <DemoVideo />
        <FeatureGrid />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

function Header({ onLaunch }: { onLaunch: () => void }) {
  const { theme, toggle } = useTheme();
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  return (
    <header className="relative flex items-center justify-between px-5 sm:px-8 py-4 border-b border-border-soft">
      <div className="flex items-center gap-2.5">
        <Logo size={28} />
        <span className="text-[15px] font-semibold tracking-tight">Mantua.AI</span>
      </div>
      <span className="absolute left-1/2 -translate-x-1/2 hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border-soft bg-bg-elev text-text-dim text-[11px] font-medium">
        <span>Built on Arc</span>
        <NetworkLogo network="arc" size={14} />
        <span>Testnet</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle theme"
          className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border-soft bg-transparent text-text-dim hover:text-text transition-colors"
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onLaunch}
          className="px-4 py-2 rounded-md bg-accent text-white text-[13px] font-semibold hover:bg-accent-2 transition-colors cursor-pointer"
        >
          Launch Demo
        </button>
      </div>
    </header>
  );
}

function Hero({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="text-center max-w-3xl pt-12 pb-10">
      <h1
        className="text-5xl sm:text-6xl font-bold tracking-tight bg-clip-text text-transparent leading-[1.05]"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #b48bff 0%, #a87aff 30%, #6fdb9c 60%, #5fc78a 100%)",
        }}
      >
        Mantua.AI
      </h1>
      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mt-4 text-text leading-[1.1]">
        Agent driven liquidity for Stablecoins
      </h2>
      <p className="mt-6 text-[15px] text-text-dim">
        Hooks for logic. Agents for action. AI for intelligence.
      </p>
      <button
        type="button"
        onClick={onLaunch}
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent text-white text-[14px] font-semibold hover:bg-accent-2 transition-colors cursor-pointer"
      >
        Launch Demo
      </button>
    </section>
  );
}

function DemoVideo() {
  return (
    <section className="w-full max-w-4xl mt-6">
      <div
        className="relative rounded-xl border border-border-soft overflow-hidden"
        style={{
          aspectRatio: "16 / 8.5",
          background: "radial-gradient(circle at 50% 50%, rgba(139,108,240,0.08), rgba(0,0,0,0))",
        }}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          controls
          playsInline
          preload="metadata"
          aria-label="Mantua demo video"
        >
          <source src="/assets/demo.mp4" type="video/mp4" />
          Your browser doesn&apos;t support embedded video.
        </video>
      </div>
    </section>
  );
}

interface Feature {
  icon: ReactNode;
  title: string;
  body: string;
  status: "Live" | "Soon" | "Flagship";
}
const FEATURES: Feature[] = [
  {
    icon: <ShieldCheck className="h-4 w-4 text-accent" />,
    title: "Stable Protection Hook",
    body: "A Uniswap v4 hook that dynamically adjusts swap fees across five depeg zones to protect stablecoin LPs from adverse selection. Fees scale from 0.05% in healthy conditions to 1% during severe depeg, with a circuit breaker for extreme events.",
    status: "Flagship",
  },
  {
    icon: <Bot className="h-4 w-4 text-accent" />,
    title: "AI Agents",
    body: "Autonomous AI agents that manage trading and liquidity strategies collaboratively or independently, executing on-chain actions through natural-language commands.",
    status: "Live",
  },
  {
    icon: <Wallet className="h-4 w-4 text-accent" />,
    title: "Portfolio Management",
    body: "Unified portfolio tracking and analytics for users and agents, with real-time performance insights and on-chain position management.",
    status: "Live",
  },
  {
    icon: <BarChart3 className="h-4 w-4 text-accent" />,
    title: "Analytics",
    body: "Real-time on-chain analytics delivering actionable blockchain insights across markets and liquidity.",
    status: "Live",
  },
];

function FeatureGrid() {
  return (
    <section className="w-full max-w-4xl mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {FEATURES.map((f) => (
        <div key={f.title} className="bg-panel-solid border border-border-soft rounded-md p-5">
          <div className="h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center mb-3">
            {f.icon}
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">{f.title}</h3>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-[4px] font-mono uppercase tracking-wider ${
                f.status === "Live"
                  ? "bg-green/10 text-green border border-green/30"
                  : f.status === "Flagship"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "bg-chip text-text-mute border border-border-soft"
              }`}
            >
              {f.status}
            </span>
          </div>
          <p className="text-[12.5px] text-text-dim leading-relaxed mt-2">{f.body}</p>
        </div>
      ))}
    </section>
  );
}

interface FAQItem {
  q: string;
  a: ReactNode;
}
const FAQS: FAQItem[] = [
  {
    q: "What is Mantua?",
    a: "Mantua.AI is an agent-driven liquidity protocol for stablecoins that allows users and institutions to manage stablecoin positions, deploy liquidity, and execute automated rebalancing strategies through natural language. It combines Uniswap v4 hooks, autonomous AI agents, and real-time onchain execution to transform user intent into automated liquidity actions. The result is a programmable liquidity layer optimized for stablecoins, RWAs, and yield-bearing dollar assets.",
  },
  {
    q: "What problem does Mantua solve?",
    a: "Managing stablecoin liquidity today is operationally manual, interface-fragmented, strategy-dependent, and exposed to peg risk across pools, venues, and market conditions. Mantua.AI enables liquidity providers, stablecoin issuers, fintech platforms, and RWA protocols to deploy peg-aware liquidity, automated rebalancing strategies, and yield-seeking routing logic directly from natural-language instructions, executed onchain via agent-managed Uniswap v4 hook strategies.",
  },
  {
    q: "How do the Hooks work?",
    a: (
      <>
        <p>
          Mantua ships two Uniswap v4 hooks on Arc Testnet. Each plugs into the pool lifecycle to
          add behavior vanilla pools can&apos;t — and each is live on-chain:
        </p>
        <ul className="mt-3 space-y-2.5 list-disc list-outside pl-5 marker:text-text-mute">
          <li>
            <strong className="text-text">Stable Protection</strong> — dynamically adjusts swap fees
            across five depeg zones (with a circuit breaker for extreme events) to protect
            stablecoin LPs. Pair: USDC/EURC.{" "}
            <a
              href="https://testnet.arcscan.app/address/0xF131A048875E578A0F89393e858C0442fcD7e0C0"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-2 underline"
            >
              View on ArcScan
            </a>
          </li>
          <li>
            <strong className="text-text">Dynamic Fee</strong> — scales the per-swap fee in real
            time from a TWAP-derived volatility signal: cheaper for stable flow, costlier in
            turbulence. Pairs: USDC/cirBTC, EURC/cirBTC.{" "}
            <a
              href="https://testnet.arcscan.app/address/0xA1Be807481F532c074380FCcF05be5e2A3ec80C0"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-2 underline"
            >
              View on ArcScan
            </a>
          </li>
        </ul>
      </>
    ),
  },
  {
    q: "How can I provide liquidity?",
    a: (
      <>
        <p>
          Connect your wallet in the app and navigate to the Liquidity tab to create a pool or add
          to an existing one. To get testnet tokens on Arc Testnet, use the Circle Faucet:
        </p>
        <ul className="mt-3 space-y-1.5 list-disc list-outside pl-5 marker:text-text-mute">
          <li>
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-2 underline"
            >
              Circle Faucet
            </a>{" "}
            — USDC, EURC and cirBTC on Arc Testnet (Arc USDC also pays for gas).
          </li>
        </ul>
      </>
    ),
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="w-full max-w-3xl mt-20">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center mb-6">
        Frequently Asked Questions
      </h2>
      <div className="space-y-2">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="border border-border-soft rounded-md bg-panel-solid">
              <button
                type="button"
                onClick={() => {
                  setOpen(isOpen ? null : i);
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left cursor-pointer"
                aria-expanded={isOpen}
              >
                <span className="text-[14px] font-semibold">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-text-dim transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-[13px] text-text-dim leading-relaxed">{item.a}</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface TrustedTeam {
  name: string;
  /** Transparent-background logo in `client/public/assets/`. */
  logo: string;
  href: string;
  /** Monochrome mark — recolor per theme (white in dark, black in
   *  light) via an invert filter. Colored marks (e.g. Uniswap's pink
   *  shield) leave this off and render as-is. */
  mono?: boolean;
}
const TRUSTED_BY: TrustedTeam[] = [
  {
    name: "Uniswap Foundation",
    logo: "/assets/uniswap-foundation.png",
    href: "https://www.uniswapfoundation.org/",
  },
  {
    name: "Crecimiento",
    logo: "/assets/crecimiento.png",
    href: "https://www.crecimiento.build/",
    mono: true,
  },
];

interface FooterCard {
  title: string;
  subtitle: string;
  href: string;
  /** Event logo in `client/public/assets/`. Falls back to the Trophy
   *  icon if the file is missing. */
  logo: string;
}
const FOOTER_CARDS: FooterCard[] = [
  {
    title: "Base Batches 001",
    subtitle: "DEFI AI CATEGORY",
    href: "https://devfolio.co/projects/mantua-protocol-98d6",
    logo: "/assets/base-batches.png",
  },
  {
    title: "Atrium Academy UH18 Hook Incubator",
    subtitle: "Pioneer of the Stable Protection Hook",
    href: "https://atriumacademy.notion.site/hook-directory?p=3285f0444abe81e599f8c4a4a2e2b9f7&pm=c",
    logo: "/assets/atrium-academy.png",
  },
];

function Footer() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <footer className="border-t border-border-soft px-5 sm:px-8 py-8">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FOOTER_CARDS.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target="_blank"
            rel="noreferrer"
            className="border border-border-soft rounded-md px-4 py-3.5 flex items-center gap-3 transition-colors hover:border-amber/60 hover:bg-bg-elev"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
              <img
                src={c.logo}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
                onError={(e) => {
                  // No logo file yet — fall back to the Trophy icon.
                  const img = e.currentTarget;
                  const icon = img.nextElementSibling as HTMLElement | null;
                  img.style.display = "none";
                  if (icon) icon.style.display = "block";
                }}
              />
              <Trophy className="hidden h-5 w-5" style={{ color: "var(--amber)" }} />
            </span>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: "var(--amber)" }}>
                {c.title}
              </div>
              <div className="text-[11px] text-text-dim mt-0.5 uppercase tracking-wider">
                {c.subtitle}
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="max-w-4xl mx-auto mt-12 text-center">
        <p
          className={`text-[11px] uppercase tracking-[0.2em] ${
            isDark ? "text-white" : "text-black"
          }`}
        >
          Trusted by leading teams
        </p>
        <div className="mt-8 flex flex-wrap items-start justify-center gap-x-16 gap-y-8">
          {TRUSTED_BY.map((t) => (
            <a
              key={t.name}
              href={t.href}
              target="_blank"
              rel="noreferrer"
              className="group flex w-40 flex-col items-center gap-3"
            >
              <img
                src={t.logo}
                alt={t.name}
                className="h-14 w-auto object-contain transition-transform group-hover:scale-105"
                style={t.mono && isDark ? { filter: "invert(1)" } : undefined}
                onError={(e) => {
                  // Hide a broken image — the name label below still shows.
                  e.currentTarget.style.display = "none";
                }}
              />
              <span
                className={`text-sm font-semibold tracking-wide ${
                  isDark ? "text-white" : "text-black"
                }`}
              >
                {t.name}
              </span>
            </a>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-text-mute text-center mt-10">
        © 2026 Mantua.AI. All rights reserved.
      </p>
    </footer>
  );
}
