# x402 nanopayments (agent marketplace access) — setup

The conversational agent can pay tiny USDC fees per call to Circle's **x402
agent marketplace** ([agents.circle.com/services](https://agents.circle.com/services)) —
the full catalog, not just data: web search, news, weather, sports stats,
prediction-market odds, social lookups, academic papers, SMS/communication APIs,
domain lookups, and more. When the agent lacks a capability, it searches the
marketplace before declining. This runs through the **Circle CLI** and is
**local-only** by design — it needs the CLI installed, logged in, and a funded
CLI wallet, none of which exist in the Vercel serverless runtime.

When x402 is disabled or the CLI is unavailable (e.g. on Vercel), the agent's
`search_paid_services` / `call_paid_service` tools report "unavailable" and the
agent falls back to the free `get_market_data` / `get_signals` tools — so nothing
breaks in production; the paid path simply stays dark.

## How it works

- New module `server/src/lib/x402-cli.ts` wraps the Circle CLI
  (`circle services search/inspect/pay`) with `execFile` (arg arrays — no shell,
  injection-safe), input validation, a timeout, and `--output json`.
- Two agent tools in `server/src/lib/agent-chat.ts`:
  - `search_paid_services({ keyword })` — discover paid endpoints (no payment).
  - `call_paid_service({ url, data?, chain? })` — inspect → budget check → pay
    (method from inspect; one chain-hint retry) → return data + the USD cost.
- Guardrails: per-call cap (`X402_MAX_CALL_USD`, passed to the CLI as
  `--max-amount`) and a daily cap (`X402_DAILY_CAP_USD`) summed from the audit
  log. Every paid call is recorded via `logAudit({ action: "agent_x402", ... })`.

The CLI's wallet (Base/Polygon) is **separate** from the app's Arc agent wallet;
x402 spend never touches Arc balances or the Arc daily cap.

## One-time setup (local)

1. **Install the Circle CLI** (see Circle's docs) and verify:
   ```bash
   circle --version
   ```
2. **Log in and accept terms:**
   ```bash
   circle login
   circle wallet status
   ```
3. **Get the agent wallet + fund it** with testnet USDC on a chain the
   marketplace accepts (commonly Base or Polygon):
   ```bash
   circle wallet list --type agent --output json
   ```
   Use the built-in funding flow / faucet for the chosen chain. (See the
   `fund-agent-wallet` skill for the on-ramp / deposit options.)
4. **Enable it for the server** — in `server/.env`:
   ```bash
   X402_ENABLED=1
   # Optional — auto-discovered from the CLI if omitted:
   X402_WALLET_ADDRESS=0xYourCliWalletAddress
   X402_DEFAULT_CHAIN=BASE      # CLI chain code (BASE, MATIC, ...)
   X402_MAX_CALL_USD=0.10       # per-call hard ceiling (USDC)
   X402_DAILY_CAP_USD=1.00      # daily ceiling (USDC), summed from the audit log
   CIRCLE_CLI_PATH=circle       # path/name of the CLI binary
   ```
5. Restart the dev server. Ask the agent a premium-data question; it will
   `search_paid_services` then `call_paid_service` and report the cost it paid.

## Agent-to-agent demo — Mantua SELLS its analysis via x402

Mantua is also an x402 **seller**: `GET /api/x402/analyst-brief` returns the
agent's live analyst brief (pegs, market pulse, narratives, TVL movers) for a
**$0.01 USDC** micro-payment, settled on Base Sepolia via the public x402
facilitator. Payment is the auth — no login. Enable by setting
`X402_SELLER_ADDRESS` (the 0x address that receives the USDC) in the server env;
unset → the endpoint reports 503.

1. **See the paywall** (no payment):
   ```bash
   curl -i https://test-mantua.vercel.app/api/x402/analyst-brief
   # → HTTP 402 with an accepts[] payment requirement (exact / eip155:84532 / USDC)
   ```
2. **Pay it from the Circle CLI agent wallet** (one-time CLI setup above; the
   buyer wallet needs USDC on Base Sepolia):
   ```bash
   circle services pay "https://test-mantua.vercel.app/api/x402/analyst-brief" \
     -X GET --address <your-cli-wallet> --chain BASE --output json
   ```
   USDC settles to `X402_SELLER_ADDRESS`; the response is the analyst brief.
3. **Or agent-to-agent via chat**: tell the Mantua agent
   `call the paid service at https://test-mantua.vercel.app/api/x402/analyst-brief`
   — the agent (buyer) pays the Mantua service (seller): one agent paying
   another in USDC, end to end.

## Notes

- Sub-cent micropayments don't require explicit confirmation; the per-call +
  daily caps bound risk. The agent states the cost it paid in its reply.
- CLI payment debug logs live in `~/.circle-cli/payments/` and may include the
  paid URL/payload — they are never surfaced by the server.
- Leave `X402_ENABLED` unset (off) for deploys; the feature stays disabled and the
  agent uses free data.
