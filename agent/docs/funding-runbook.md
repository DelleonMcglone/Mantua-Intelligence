<!--
Purpose: Manual runbook for funding the Arc agent's wallet on testnet.
Arc gas is paid in native USDC (no test ETH); funding is via the Circle
faucet. This is a human runbook, not an automated loop.
-->

# Arc Agent — Funding Runbook (testnet)

Arc pays gas in its **native USDC** token — there is **no test ETH** on Arc, and
AgentKit's built-in CDP faucet action targets Base/CDP networks only, so it is
**not** used here. Fund the agent manually via the Circle faucet.

## One-time / top-up steps

1. Get the agent address. With `agent/.env` configured, run:
   ```bash
   npm run start -w @mantua/agent
   ```
   It prints the registered actions; the wallet address is the account derived
   from `AGENT_PRIVATE_KEY`. (Or run the `check_balances` action.)
2. Open the **Circle faucet**: https://faucet.circle.com
3. Select **Arc testnet** and request **USDC** (also EURC / cirBTC if needed).
   - Limit: ~**20 USDC per address per chain every 2 hours**.
4. Wait for confirmation, then verify with the `check_balances` action — it
   reports USDC/EURC/cirBTC (6/6/8-dp ERC-20) plus the native USDC gas balance
   (18-dp) and warns when gas is below `LOW_GAS_WARN_USDC`.

## Low-gas handling

- The `check_balances` action emits a `⚠️ Low gas` warning when the native USDC
  balance drops below `LOW_GAS_WARN_USDC` (default 1 USDC).
- On a warning, repeat the faucet steps above. Do **not** script an automated
  faucet loop — respect the rate limit; top up manually.

## Notes

- Decimals trap: gas math uses 18-decimal native USDC; balances/transfers/escrow
  use the 6-decimal USDC ERC-20 interface. The two are never mixed (see
  `src/lib/decimals.ts`).
- Allowlisted assets only: USDC, EURC, cirBTC.
