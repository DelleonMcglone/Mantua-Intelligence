import type { ReactNode } from "react";
import { P, H, UL, OL, B, A, Note } from "./docs-primitives.tsx";

/**
 * Documentation content, one entry per sidebar page. Kept as data so the
 * page shell stays dumb and adding a topic is a single array entry.
 *
 * Everything factual here is drawn from the deployed system; see
 * `docs/architecture.md`. Update this file when that changes.
 *
 * Two rules this file follows (task 001). It does not describe swapping or
 * providing liquidity, which are not part of the product. And it does not
 * name the chain, the deployment, or a block explorer: which network the
 * contracts sit on is configuration, not documentation, and contract
 * addresses are read from configuration rather than published here.
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
              Mantua is an agent-driven prediction market for NFL games. Bettors and market makers
              open positions and run automated strategies, expressed in natural language and
              executed on-chain through Uniswap v4 pools with a custom Mantua hook.
            </P>
            <P>
              Three parts do the work. The <B>Dynamic Market Hook</B> puts logic inside the pool
              itself: pricing, fees, and risk controls that vanilla AMMs can&apos;t express.{" "}
              <B>Agents</B> turn intent into action, buying the intelligence they need per call in
              USDC and executing on the result. The <B>interface</B> ties them together with a
              portfolio, analytics, and a chatbot that routes plain-language instructions to the
              right surface. Every command, including placing bets, can be run from the chatbot.
            </P>

            <H>What problem it solves</H>
            <P>
              Prediction markets are static. Odds and liquidity sit passively while the world moves,
              so market makers get picked off the moment news breaks and bettors trade against stale
              depth. Mantua makes the market itself programmable: fees adapt to order-flow
              imbalance, access is enforced at execution, and trading halts under conditions the
              market defines in advance — all of it set from natural-language instructions and
              executed on-chain through agent-managed Mantua hooks.
            </P>

            <H>Non-custodial by design</H>
            <P>
              Mantua never holds your assets. You connect a wallet, you sign every transaction, and
              settlement happens in smart contracts. Nothing in this documentation implies we can
              move, freeze, reverse, or recover funds. We cannot.
            </P>

            <H>Where to start</H>
            <UL>
              <li>
                New here? <B>Getting started</B> covers connecting a wallet and funding it.
              </li>
              <li>
                Want the mechanics? <B>The Dynamic Market Hook</B> explains what the hook does to a
                market.
              </li>
              <li>
                Building or automating? <B>Agents</B> and <B>Markets and settlement</B> have the
                behavior you need.
              </li>
            </UL>
          </>
        ),
      },
      {
        id: "getting-started",
        title: "Getting started",
        summary: "Connect a wallet, fund it, place your first position.",
        body: (
          <>
            <H>1. Open the app</H>
            <P>
              Mantua opens on the board: today&apos;s NFL games, prices, and the analyst. Browsing
              is open to everyone. No wallet required.
            </P>

            <H>2. Sign in</H>
            <P>
              Any on-chain transaction needs a logged-in wallet. Sign in with email, a social
              account, a passkey, or an external wallet; a wallet address is created or connected
              for you. Keep your recovery method safe. We can never restore it, and we will never
              ask you for a seed phrase or private key.
            </P>

            <H>3. Fund the wallet</H>
            <P>
              Markets are denominated in USDC. Get USDC from the{" "}
              <A href="https://faucet.circle.com/">Circle faucet</A>, which issues roughly 20 USDC
              per address per chain every two hours.
            </P>

            <H>4. Take a position</H>
            <OL>
              <li>
                Pick a game from the board, or open <B>NFL</B> from the header nav for the full
                week.
              </li>
              <li>
                Choose a side. The ticket quotes the price in cents per outcome token and shows what
                a win pays.
              </li>
              <li>Review the quote, confirm, and sign in your wallet.</li>
              <li>
                Or type the instruction into the chatbot — &ldquo;bet on the Chiefs&rdquo; opens the
                same ticket, pre-filled.
              </li>
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
        title: "The Dynamic Market Hook",
        summary: "What the hook changes about a prediction market.",
        body: (
          <>
            <P>
              A Uniswap v4 hook is a contract the pool calls at defined points in its lifecycle:
              before and after a trade, or a liquidity change. It attaches behavior a plain pool has
              no way to express.
            </P>

            <H>What it does</H>
            <P>
              The Dynamic Market Hook powers every Mantua market. It adapts pricing, fees,
              liquidity, and risk parameters in real time from market conditions, volatility, and
              trading activity, so quoted odds track the state of the event rather than sitting
              still between trades.
            </P>
            <Note>
              Each day&apos;s games mint their markets automatically. Their pools open at the
              implied odds and trade under this hook until kickoff freezes them.
            </Note>

            <H>Why it matters</H>
            <P>
              Prediction markets today are passive. Embedding this behavior directly in AMM
              execution logic makes them state-aware, fee-adaptive, oracle-enforced, and
              agent-managed — turning prediction-market liquidity from static capital into an
              automated control system for access, market making, and event settlement.
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
              and it researches, decides, and executes, including while you are away.
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
              The agent combines what it bought with live sports and on-chain signals and executes:
              take a position, manage it, or exit on a signal-gated schedule.
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
              change. A quoted price is the market&apos;s current forecast. It moves when
              participants disagree with it.
            </P>

            <H>Halts</H>
            <P>
              Trading on a game freezes at kickoff. More generally, a pool can stop accepting trades
              under conditions defined in advance, enforced by the contract rather than by an
              operator decision.
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
              contradictory. Two independent sources disagreeing on a result stops automatic
              settlement and escalates to review rather than picking a side. There is currently no
              dispute window: a resolution, once on-chain, is final. Every resolution is publicly
              recorded with its data source, signer, and transaction.
            </P>
            <Note tone="warn">
              A tie, a postponed game, or a cancelled game voids the market. Voided markets settle
              at 0.50 USDC per outcome token, so a full YES/NO set returns exactly what it was
              minted with.
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
    label: "Reference",
    pages: [
      {
        id: "contracts",
        title: "Contracts",
        summary: "Where the addresses live and how to read them.",
        body: (
          <>
            <P>
              Mantua&apos;s markets, hook, and token addresses are deployment configuration, not
              constants. They differ between environments and they change when a deployment does, so
              this page deliberately does not publish a list that would go stale.
            </P>
            <UL>
              <li>
                Every transaction the app performs links to its block explorer record when it lands
                — that is the authoritative view of the contract you just interacted with.
              </li>
              <li>The connected-wallet menu links to your own address on the same explorer.</li>
              <li>
                Integrating? Read addresses from configuration rather than hardcoding them, and
                re-verify before any mainnet use.
              </li>
            </UL>

            <H>Tokens</H>
            <P>
              Markets are denominated in <B>USDC</B>, which uses 6 decimals. Outcome tokens (YES/NO)
              are minted per market and redeem at 1 USDC for the winning side, or 0.50 USDC per side
              on a void.
            </P>
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
                <B>Discord</B>: <A href="https://discord.gg/kUfEpzvaFf">join the server</A> for
                questions and product discussion.
              </li>
              <li>
                <B>Updates</B>: <A href="https://substack.com/@mantuanews">Substack</A> and{" "}
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
