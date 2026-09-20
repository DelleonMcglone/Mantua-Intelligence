# 001 — Public surface reduction: NFL-only, no landing page, no trading, no chain chrome

## Task description

Reduce what `https://www.mantua.ai/` shows the public to a single coherent product:
browse today's NFL games, ask the analyst, trade the market, run your agent.

Five removals, requested together:

1. **Trading** — swaps and LPing leave the product entirely.
2. **Arc testnet** — no Arc as a selectable network, no Arc naming in the UI.
3. **Base Sepolia** — the app stays on Base Sepolia, but nothing public says so.
4. **Leagues** — NFL only. WNBA and the four "coming soon" leagues go.
5. **Landing page** — deleted; `/` resolves to the home page (the Discover board),
   with the surviving landing content moved into a home-page footer (HP-001…HP-009).

## Scope decision (owner, 2026-09-20)

**Client surface only.** `server/`, `agent/` and `contracts/` keep their swap /
liquidity / pool routes and Arc configuration; they are simply no longer reachable
from the public app. A backend pass is a separate task.

**The Circle Agent stays as-is.** Its panel, header nav entry and home card remain,
and it keeps its own tool set (swap / send / liquidity) and its Arc wallet
internally. Two consequences follow, both deliberate:

- Arc cannot be deleted from `client/src/lib/chains.ts`: the agent's wallet,
  portfolio and unified-balance surfaces read it. Arc is therefore removed as a
  _selectable, named_ network — the chain selector is gone and no copy names a
  chain — while the chain definition stays under the hood, exactly as Base Sepolia
  does.
- The agent can still be asked to swap inside its own chat. That is the owner's
  call; what is removed is Mantua's own trading UI, not the agent's capability.

## Success criteria

- No route, nav item, card, prompt or chat intent in `client/` opens a swap,
  pool, add-liquidity, remove-liquidity, bridge or LP-position surface.
- No user-visible string in `client/` reads "Arc", "ArcScan", "Base Sepolia",
  "Sepolia", "testnet" or names a network chip.
- `SPORTS` is NFL alone; the board, the league nav and the league page agree.
- `/` renders the home page for every visitor, logged in or out, in zero clicks.
- Terms, Privacy and Market Integrity stay reachable in one click from `/`.
- `npm run typecheck`, `npm run lint`, `npm run build` and the node test runner
  all pass.

## Failure conditions

- A dangling import, dead route or orphaned link to a removed surface.
- The login gate moving in front of browsing (it stays at the trade ticket, B5-007).
- Legal pages becoming unreachable (L-004 requires them live before mainnet).
- The agent panel or the NFL market flow regressing.

## Edge cases

- A `sessionStorage` route persisted by an older build (`swap`, `pools`,
  `trading`, …) must not blank the app — `loadStoredRoute` has to reject
  route kinds this build no longer knows.
- A `localStorage` chain id of Arc persisted by an older build must not strand
  the user on a chain the UI no longer switches away from.
- `extractLeague` still has to recognise the league words the analyst's corpus
  uses, even for leagues that no longer have a market page.

## HP-001 — content inventory of the landing page

Every block on `components/landing/LandingPage.tsx`, and where it went.

| Block                                                                  | Disposition                                                                                                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header: logo + wordmark                                                | **Dropped** — the app shell header already carries it.                                                                                                                                 |
| Header: `MarketNav` league row                                         | **Dropped** — same nav, already in the shell header.                                                                                                                                   |
| Header: theme toggle                                                   | **Dropped** — already in the shell header.                                                                                                                                             |
| Header: "Launch App" CTA                                               | **Dropped** — nothing to launch into; `/` _is_ the app.                                                                                                                                |
| Hero banner (`hero-banner.png`, `hero-banner-light.png`)               | **Dropped** — marketing art with no home on a board-first page. The two PNGs (2.0 MB) are deleted from `client/public/assets/`; they remain in git history if the art is wanted again. |
| Demo video (`demo.mp4`, 32 MB)                                         | **Dropped**, and the file deleted — nothing referenced it any more and every deploy was shipping it. Recoverable from git history.                                                     |
| Feature card: Hooks (Dynamic Market / Stable Protection / Dynamic Fee) | **Relocated** — the docs "Hooks" topic already carries this text, reachable from the footer. Stable Protection and Dynamic Fee entries dropped as trading hooks.                       |
| Feature card: Agents                                                   | **Relocated** — docs "Agents" topic.                                                                                                                                                   |
| Feature card: Analytics                                                | **Dropped** — the analyst is the surface; a card describing it adds nothing.                                                                                                           |
| Feature card: Portfolio Management                                     | **Dropped** — the portfolio panel is the surface.                                                                                                                                      |
| Feature card: Trading & Liquidity                                      | **Dropped** — the feature itself is being removed.                                                                                                                                     |
| FAQ: "What is Mantua?"                                                 | **Relocated** — docs "Introduction".                                                                                                                                                   |
| FAQ: "What problem does Mantua solve?"                                 | **Relocated** — docs "Introduction".                                                                                                                                                   |
| FAQ: "Why is Mantua better?"                                           | **Relocated** — docs "Introduction".                                                                                                                                                   |
| FAQ: "How do Mantua hooks work?"                                       | **Relocated** — docs "Hooks".                                                                                                                                                          |
| Footer: Documentation link                                             | **Moved to the home-page footer.**                                                                                                                                                     |
| Footer: social row (X, Discord, Substack, Reddit, LinkedIn)            | **Moved to the home-page footer**, order preserved.                                                                                                                                    |
| Footer: copyright line                                                 | **Moved to the home-page footer.**                                                                                                                                                     |
| Footer: Privacy / Terms of Use / Market Integrity                      | **Moved to the home-page footer** (HP-005).                                                                                                                                            |
| `social-icons.tsx`                                                     | **Relocated** to `components/shell/social-icons.tsx`.                                                                                                                                  |

## Decision D-121 — what a logged-out visitor sees at `/`

No landing interstitial. The board is visible at `/` in zero clicks, logged out or
in. The login gate does not move: it stays at the trade ticket (B5-007), never in
front of browsing. The dock keeps its freemium analyst placeholder.

## Implementation checklist

- [x] HP-001 — content inventory recorded above; every block dispositioned.
- [x] HP-002 — `LandingPage.tsx` and the `landing` route deleted; `/` is the home page.
- [x] HP-003 — `components/shell/Footer.tsx` built: docs link, social row, copyright, legal links.
- [x] HP-004 — D-121 recorded; logged-out `/` is the board.
- [x] HP-005 — Terms, Privacy, Market Integrity reachable from `/` in one click.
- [x] HP-006 — no orphaned link, stale redirect or dead import to a removed page.
- [x] HP-007 — no chain branding and no gas / network / explorer wording left in the client.
- [x] HP-008 — bundle measured before and after (numbers under "Testing"); the footer uses no fixed widths, so nothing new can overflow at 360 px.
- [x] HP-009 — no browser E2E suite exists in this repository (see "Testing" below).
- [x] Trading removed: `features/swap/`, `features/liquidity/`, `features/bridge/` deleted.
- [x] Arc removed as a selectable, named network; chain selector deleted.
- [x] NFL-only `SPORTS`; board, nav and league page agree.
- [x] `chat-intent.ts` no longer produces trading intents; its tests updated.
- [x] Docs "Trading" and "Providing liquidity" topics removed; "Networks" de-branded.
- [x] typecheck / lint / build / unit tests green.

## Testing

The HP-009 brief refers to a browser E2E suite (`harness.ts`, `legal.spec.ts`, a
logged-out spec, 360 px / 430 px mobile specs, a critical-JS budget). **No such
suite exists in this repository** — there is no Playwright or Puppeteer dependency
and no `*.spec.ts` anywhere. Nothing was updated because there is nothing to
update; the claim is recorded here rather than silently dropped.

What the repository does have, and what was run:

- `npm test -w @mantua/client` — 47 tests, 47 pass. (`error-mapping.test.ts` went
  with `features/liquidity/`.)
- `npm test -w @mantua/agent` — 19 tests, 19 pass.
- `npm test -w @mantua/server` — 233 tests, 233 pass, run the way CI runs it.
  `server/src/env.ts` parses its required vars at module load, so the suite must
  be given the same stubs `.github/workflows/ci.yml` sets
  (`DATABASE_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`); without them twelve test
  files abort at import and the runner reports 116 tests / 12 failures on this
  branch and on `main` alike. That is an environment artifact, not a test
  failure.
- `npm run typecheck` and `npm run lint` across all three workspaces: clean.
- `npm run build -w @mantua/client`: clean.
- A grep sweep for the removed vocabulary as the stand-in for PF-018 / T-005. The
  only remaining hits in `client/` are code identifiers (`ARC_TESTNET_CHAIN_ID`,
  `SupportedTestnetChainId`), source comments, and two test fixtures that assert
  a non-NFL league does _not_ open a market page.

### HP-008 — bundle, measured

Built from this branch and from `main` with the same toolchain:

| Chunk     | `main`                       | this branch                  | Δ                                |
| --------- | ---------------------------- | ---------------------------- | -------------------------------- |
| app JS    | 313.19 kB (85.91 kB gz)      | 197.06 kB (56.40 kB gz)      | **−116.13 kB (−29.51 kB gz)**    |
| vendor JS | 5,445.80 kB (1,574.22 kB gz) | 4,355.59 kB (1,293.53 kB gz) | **−1,090.21 kB (−280.69 kB gz)** |
| CSS       | 44.31 kB (8.46 kB gz)        | 36.17 kB (7.36 kB gz)        | **−8.14 kB (−1.10 kB gz)**       |

Plus 34 MB of unreferenced media (`demo.mp4` and the two hero banners) no longer
shipped with the deploy.

The footer introduces no fixed widths, no `min-width`, and no non-wrapping row —
its social and legal rows both use `flex-wrap` — so it cannot overflow at 360 px.
