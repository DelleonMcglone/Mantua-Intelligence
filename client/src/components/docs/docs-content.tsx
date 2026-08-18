import type { ReactNode } from "react";
import { P, H, UL, OL, B, Code, A, Note, Table } from "./docs-primitives.tsx";

/**
 * Documentation content, one entry per sidebar page. Kept as data so the
 * page shell stays dumb and adding a topic is a single array entry.
 *
 * Everything factual here is drawn from the deployed system: hook
 * addresses from `features/liquidity/hook-recommendations.ts`, fee tiers
 * from `features/liquidity/fee-tiers.ts`, chain and token details from
 * `docs/architecture.md`. Update this file when those change.
 */

export interface DocsPage {
  id: string;
  title: string;
  /** Sub-title under the page heading. */
  summary: string;
  body: ReactNode;
}

export interface DocsGroup {
  label: string;
  pages: DocsPage[];
}

const ARC_EXPLORER = "https://testnet.arcscan.app/address";

export const DOCS_GROUPS: DocsGroup[] = [
  {
    label: "Overview",
    pages: [
      {
        id: "introduction",
        title: "Introduction",
        summary: "What Mantua is and how the pieces fit together.",
        body: (
          <>
            <P>
              Mantua is an agent-driven prediction market for sports. Bettors and market makers open
              positions, provide liquidity, and run automated strategies — expressed in natural
              language and executed on-chain through Uniswap v4 pools with custom Mantua hooks.
            </P>
            <P>
              Three parts do the work. <B>Hooks</B> put logic inside the pool itself: pricing, fees,
              and risk controls that vanilla AMMs can&apos;t express. <B>Agents</B> turn intent into
              action, buying the intelligence they need per call in USDC and executing on the
              result. The <B>interface</B> ties them together with a portfolio, analytics, and a
              command bar that routes plain-language instructions to the right surface.
            </P>

            <H>Non-custodial by design</H>
            <P>
              Mantua never holds your assets. You connect a wallet, you sign every transaction, and
              settlement happens in smart contracts. Nothing in this documentation implies we can
              move, freeze, reverse, or recover funds — we cannot.
            </P>

            <H>Where to start</H>
            <UL>
              <li>
                New here? <B>Getting started</B> covers connecting a wallet and funding it on Arc
                Testnet.
              </li>
              <li>
                Want the mechanics? <B>Hooks</B> explains what each hook does to a swap.
              </li>
              <li>
                Building or automating? <B>Agents</B> and <B>Networks &amp; contracts</B> have the
                addresses and behavior you need.
              </li>
            </UL>
          </>
        ),
      },
      {
        id: "getting-started",
        title: "Getting started",
        summary: "Connect a wallet, get testnet funds, place your first action.",
        body: (
          <>
            <H>1. Open the app</H>
            <P>
              Select <B>Launch App</B> from anywhere on the site. Browsing markets, pools, and
              analytics is open to everyone — no wallet required.
            </P>

            <H>2. Sign in</H>
            <P>
              Any on-chain transaction needs a logged-in wallet. Sign in with email, a social
              account, a passkey, or an external wallet; a wallet address is created or connected
              for you. Keep your recovery method safe — we can never restore it, and we will never
              ask you for a seed phrase or private key.
            </P>

            <H>3. Fund the wallet</H>
            <P>
              Mantua currently runs on Arc Testnet. Get test tokens from the Circle faucet, which
              issues roughly 20 USDC per address per chain every two hours:
            </P>
            <UL>
              <li>
                <A href="https://faucet.circle.com/">Circle Faucet</A> — USDC, EURC, and cirBTC on
                Arc Testnet.
              </li>
            </UL>
            <Note>
              On Arc, <B>USDC is the native gas token</B>. There is no separate ETH to acquire — the
              same USDC pays for gas and trades.
            </Note>

            <H>4. Do something</H>
            <OL>
              <li>
                Pick a league from the header nav to browse its markets, or open <B>Trading</B> to
                swap and provide liquidity.
              </li>
              <li>
                Type an instruction into the command bar — &ldquo;swap 10 USDC for EURC with Stable
                Protection&rdquo; — and it routes to the right panel, pre-filled.
              </li>
              <li>Review the quote, confirm, and sign in your wallet.</li>
            </OL>
          </>
        ),
      },
    ],
  },
  {
    label: "Core concepts",
    pages: [
      {
        id: "hooks",
        title: "Hooks",
        summary: "The three Mantua hooks and what each one changes about a swap.",
        body: (
          <>
            <P>
              A Uniswap v4 hook is a contract the pool calls at defined points in its lifecycle —
              before and after a swap, or a liquidity change. Mantua ships three, each attaching
              behavior a plain pool has no way to express.
            </P>

            <H>Dynamic Market Hook</H>
            <P>
              Powers the prediction markets. It adapts pricing, fees, liquidity, and risk parameters
              in real time from market conditions, volatility, and trading activity, so quoted odds
              track the state of the event rather than sitting still between trades.
            </P>
            <Note>
              Live on Arc Testnet at{" "}
              <A href={`${ARC_EXPLORER}/0xbb5D42DC40128fa681882cA49f9A74d50D15E8c0`}>
                0xbb5D42…E8c0
              </A>
              . Each day&apos;s games mint their markets automatically; their pools open at the
              implied odds and trade under this hook until kickoff freezes them.
            </Note>

            <H>Stable Protection Hook</H>
            <P>
              For stablecoin and dollar-pegged pools. It measures how far the pool has drifted from
              its reference rate on every swap and sorts that deviation into five zones, raising the
              LP fee as the depeg gets worse and halting swaps entirely past 5%.
            </P>
            <Table
              head={["Zone", "Deviation", "Base fee"]}
              rows={[
                ["Healthy", "at peg", "—"],
                ["Minor", "small drift", "5 bps"],
                ["Moderate", "growing", "15 bps"],
                ["Severe", "up to 5.00%", "50 bps"],
                ["Critical", "over 5.00%", "circuit breaker — swaps blocked"],
              ]}
            />
            <P>
              Fees are also directional: a trade pushing the pool back toward its peg pays half the
              zone&apos;s base fee, while one pushing it further away pays more. Traders who help
              restore the peg are subsidised by those who strain it.
            </P>

            <H>Dynamic Fee Hook</H>
            <P>
              For volatile pairs. It reads Chainlink price feeds and applies Nezlobin directional
              fees across five deviation zones, charging the toxic side of a trade more — so the
              spread accrues to liquidity providers instead of arbitrageurs.
            </P>
          </>
        ),
      },
      {
        id: "agents",
        title: "Agents",
        summary: "How autonomous agents research, decide, and execute.",
        body: (
          <>
            <P>
              An agent turns an instruction into on-chain action. Give it a goal in plain language
              and it researches, decides, and executes — including while you are away.
            </P>

            <H>Buying intelligence</H>
            <P>
              When an agent hits a question it can&apos;t answer from what it already has, it
              searches the x402 marketplace and pays per call in USDC. No API keys to provision, no
              accounts to create, no subscriptions to prefund. Every purchase is capped and written
              to an audit log.
            </P>

            <H>Acting on it</H>
            <P>
              The agent combines what it bought with live on-chain signals — pool health, peg
              status, flow — and executes: take a position, swap, provide liquidity, bridge, or exit
              on a signal-gated schedule.
            </P>

            <Note tone="warn">
              You are responsible for everything your agent signs, whether or not you reviewed it
              first. Set spending limits deliberately, and check them.
            </Note>
          </>
        ),
      },
      {
        id: "markets",
        title: "Markets and settlement",
        summary: "How a market prices, halts, and resolves.",
        body: (
          <>
            <H>Pricing</H>
            <P>
              Prices come from the pool, not from a bookmaker. Each outcome trades against
              liquidity, and the Dynamic Market Hook adjusts fees and parameters as conditions
              change. A quoted price is the market&apos;s current forecast — it moves when
              participants disagree with it.
            </P>

            <H>Halts</H>
            <P>
              Pools can stop accepting swaps under conditions defined in advance. The Stable
              Protection Hook&apos;s circuit breaker is the clearest case: past 5% deviation, swaps
              are blocked until the pool recovers. This is deliberate — it protects LPs from
              absorbing a depeg — and it is enforced by the contract, not by an operator decision.
            </P>

            <H>Resolution</H>
            <P>
              Each market names its own resolution terms and settlement source before it opens. Read
              them before taking a position. Settlement follows those terms and the contract logic.
              Postponed or cancelled events, and failures at a data source, can delay resolution.
            </P>
            <P>
              Outcomes are submitted on-chain by a <B>Mantua-operated resolver</B> reading live
              sports data, with a manual override for cases where the data is missing, delayed, or
              contradictory — two independent sources disagreeing on a result stops automatic
              settlement and escalates to review rather than picking a side. There is currently no
              dispute window: a resolution, once on-chain, is final. Every resolution is publicly
              recorded with its data source, signer, and transaction.
            </P>
            <Note tone="warn">
              A tie, a postponed game, or a cancelled game voids the market. Voided markets settle
              at 0.50 USDC per outcome token — a full YES/NO set returns exactly what it was minted
              with.
            </Note>

            <Note>
              Everything settles on a public blockchain. Once a transaction is confirmed it cannot
              be reversed, cancelled, or refunded by anyone, including us.
            </Note>
          </>
        ),
      },
    ],
  },
  {
    label: "Guides",
    pages: [
      {
        id: "trading",
        title: "Trading",
        summary: "Swapping assets through hook-powered pools.",
        body: (
          <>
            <OL>
              <li>
                Open <B>Trading</B> from the header, or type a swap instruction into the command
                bar.
              </li>
              <li>Choose the pair and the amount you want to sell.</li>
              <li>
                Pick a venue: a hook-powered pool, a plain pool with no hook, or the bridge for
                moving USDC across chains.
              </li>
              <li>
                Review the quote. Hook pools price the fee at execution, so what you see reflects
                current conditions, not a fixed tier.
              </li>
              <li>Confirm and sign. The transaction hash appears when it lands.</li>
            </OL>

            <H>If a quote fails</H>
            <UL>
              <li>
                <B>Insufficient liquidity</B> — the pool returned almost nothing for that size. Try
                a smaller amount, a different fee tier, or the no-hook venue.
              </li>
              <li>
                <B>Hook unavailable for this pair</B> — that hook doesn&apos;t serve those tokens.
                Stable Protection is for stable pairs; Dynamic Fee is for volatile ones.
              </li>
              <li>
                <B>Swaps blocked</B> — Stable Protection&apos;s circuit breaker has tripped on a
                real depeg. This clears when the pool returns inside the threshold.
              </li>
            </UL>
          </>
        ),
      },
      {
        id: "liquidity",
        title: "Providing liquidity",
        summary: "Creating a pool or adding to one.",
        body: (
          <>
            <OL>
              <li>Sign in and open the Liquidity surface from the home menu or the command bar.</li>
              <li>
                Select an existing pool, or create one by choosing a pair, fee tier, and hook.
              </li>
              <li>Enter amounts for both sides and review the position.</li>
              <li>
                Approve the tokens if prompted, then confirm. Creating a pool initialises it and
                adds liquidity in the same flow.
              </li>
            </OL>

            <H>Fee tiers</H>
            <Table
              head={["Tier", "Fee", "Typical use"]}
              rows={[
                [<Code key="a">100</Code>, "0.01%", "Stable pairs"],
                [<Code key="b">500</Code>, "0.05%", "cirBTC / stable"],
                [<Code key="c">3000</Code>, "0.30%", "cirBTC pairs"],
                [<Code key="d">10000</Code>, "1.00%", "Wide range"],
              ]}
            />
            <Note>
              On a hook-powered pool the tier is a starting point — the hook sets the fee actually
              charged at execution, which is the point of using one.
            </Note>

            <H>Risk</H>
            <P>
              Providing liquidity exposes you to impermanent loss, to the assets in the pair, and to
              the contracts involved. Fees earned may not offset price divergence. Manage positions
              from the Positions view, where you can also remove liquidity.
            </P>
          </>
        ),
      },
    ],
  },
  {
    label: "Reference",
    pages: [
      {
        id: "networks",
        title: "Networks and contracts",
        summary: "Chain details, deployed hooks, and token addresses.",
        body: (
          <>
            <H>Arc Testnet</H>
            <Table
              head={["Field", "Value"]}
              rows={[
                ["Chain ID", <Code key="id">5042002</Code>],
                ["RPC", <Code key="rpc">https://rpc.testnet.arc.network</Code>],
                [
                  "Explorer",
                  <A key="ex" href="https://testnet.arcscan.app">
                    testnet.arcscan.app
                  </A>,
                ],
                ["Gas token", "USDC (native)"],
              ]}
            />
            <Note>
              Arc&apos;s native gas token uses 18 decimals while the USDC ERC-20 interface uses 6.
              Balances, transfers, and escrow use the 6-decimal interface; only gas math is in
              18-decimal units. Mixing them is the single most common integration bug on Arc.
            </Note>

            <H>Deployed hooks</H>
            <Table
              head={["Hook", "Address"]}
              rows={[
                [
                  "Stable Protection",
                  <A key="sp" href={`${ARC_EXPLORER}/0xd1Deea248850BFc239Cb282b793b076357Cb20c0`}>
                    0xd1Deea…20c0
                  </A>,
                ],
                [
                  "Dynamic Fee",
                  <A key="df" href={`${ARC_EXPLORER}/0xA1Be807481F532c074380FCcF05be5e2A3ec80C0`}>
                    0xA1Be80…80C0
                  </A>,
                ],
                [
                  "Dynamic Market",
                  <A key="dm" href={`${ARC_EXPLORER}/0xbb5D42DC40128fa681882cA49f9A74d50D15E8c0`}>
                    0xbb5D42…E8c0
                  </A>,
                ],
              ]}
            />

            <H>Tokens</H>
            <Table
              head={["Token", "Decimals", "Address"]}
              rows={[
                ["USDC", "6", <Code key="u">0x3600…0000</Code>],
                ["EURC", "6", <Code key="e">0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a</Code>],
                ["cirBTC", "8", <Code key="c">0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF</Code>],
              ]}
            />
            <Note tone="warn">
              Testnet deployment. Addresses change between environments — always read them from
              configuration rather than hardcoding, and re-verify before any mainnet use.
            </Note>
          </>
        ),
      },
      {
        id: "support",
        title: "Support",
        summary: "Where to ask, report, and follow along.",
        body: (
          <>
            <UL>
              <li>
                <B>Discord</B> — <A href="https://discord.gg/kUfEpzvaFf">join the server</A> for
                questions and product discussion.
              </li>
              <li>
                <B>Market integrity</B> — report manipulation or insider activity to{" "}
                <A href="mailto:info@mantua.ai">info@mantua.ai</A>. See the Market Integrity policy
                for what&apos;s prohibited.
              </li>
              <li>
                <B>Updates</B> — <A href="https://substack.com/@mantuanews">Substack</A> and{" "}
                <A href="https://x.com/Mantua_AI">X</A>.
              </li>
            </UL>
            <Note tone="warn">
              Nobody from Mantua will ever ask for your seed phrase, private key, or passkey. Treat
              any such request as an attack, wherever it comes from.
            </Note>
          </>
        ),
      },
    ],
  },
];

export const DOCS_PAGES: DocsPage[] = DOCS_GROUPS.flatMap((g) => g.pages);
