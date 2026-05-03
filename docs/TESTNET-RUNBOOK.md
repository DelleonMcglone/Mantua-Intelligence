# Mantua testnet end-to-end runbook (Base Sepolia)

This walks one wallet through every transaction needed to confirm the
four Mantua hooks are live on Base Sepolia and that the UI surfaces them
correctly. Each step ends with a BaseScan Sepolia transaction link you
should record in the PR description (or paste back into chat) so the
flow is auditable.

> Test wallet (used by the Mantua team for v2 verification):
> `0xbaacDCFfA93B984C914014F83Ee28B68dF88DC87`
>
> Any wallet works — substitute your own address everywhere `${WALLET}`
> appears below.

## 0. Prerequisites

1. `client/.env.local` and `server/.env` set to **testnet**:
   - `VITE_MANTUA_NETWORK=testnet` (client; defaults to testnet)
   - `MANTUA_NETWORK=testnet` (server; defaults to testnet)
2. Servers running locally (`npm run dev:client`, `npm run dev:server`).
3. Wallet funded on Base Sepolia with:
   - Base Sepolia ETH (for gas + ETH leg). Faucet:
     <https://www.alchemy.com/faucets/base-sepolia>
   - Test USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   - Test EURC: `0x808456652fdb597867f38412077A9182bf77359F`
   - Test cbBTC: `0xcbB7C0006F23900c38EB856149F799620fcb8A4a`

The Coinbase faucet (<https://faucet.coinbase.com>) and Circle's testnet
mint UIs are the fastest sources for stablecoins on Base Sepolia.

## 1. Connect the wallet → confirm balances live-update

1. Open <http://localhost:5173/>.
2. Click **Connect** (Privy modal). Pick the wallet provider that holds
   `${WALLET}`.
3. Watch the **Assets** card on the left. It hits `/api/portfolio` once
   on connect and then every 15 s — receive a token to the wallet and
   the row should refresh without reloading the page.

Pass criteria: ETH/USDC/EURC/cbBTC balances match
`https://sepolia.basescan.org/address/${WALLET}#tokentxns`.

## 2. Create the four design pools (one tx each)

Each pool creates a v4 PoolKey with the listed hook attached and writes
the pool to the local db once the receipt confirms. The Mantua-
recommended hook auto-fills when you pick the matching pair on the
**Create pool** screen.

| # | Pair        | Fee tier  | Hook                | Hook contract |
| - | ----------- | --------- | ------------------- | ------------- |
| 1 | USDC/EURC   | 0.01%     | Stable Protection   | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` |
| 2 | ETH/USDC    | 0.05%     | Dynamic Fee         | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` |
| 3 | USDC/cbBTC  | 0.05%     | RWA Gate            | `0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80` |
| 4 | ETH/cbBTC   | 0.30%     | Async Limit Order   | `0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8` |

For each row:

1. From the right panel, click the **Pool** prompt → **+ Create Pool**.
2. Set **Token A** / **Token B** to the pair. The hook dropdown should
   auto-suggest the row's hook (override via dropdown if needed).
3. Set the fee tier and an initial price (any sensible ratio).
4. Click **Initialize pool** and sign in your wallet.
5. Copy the BaseScan link from the result row and paste it into the PR.

Expected BaseScan record (any of the 4):

- `to: 0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408` (PoolManager)
- Calldata starts with `0x695c5bf5` (PoolManager.initialize selector)
- Logs include the v4 `Initialize` event with `hooks` set to the row's
  hook contract address.

Open the hook contract's BaseScan page — its `Internal Txns` /
`Events` tab will gain a `BeforeInitialize` (Stable Protection) or
`AfterInitialize` (ALO) event, proving the hook executed during the
init.

| Pool | BaseScan tx | Hook BaseScan |
| ---- | ----------- | ------------- |
| USDC/EURC + Stable Protection | _fill in_ | <https://sepolia.basescan.org/address/0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0> |
| ETH/USDC + Dynamic Fee        | _fill in_ | <https://sepolia.basescan.org/address/0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0> |
| USDC/cbBTC + RWA Gate         | _fill in_ | <https://sepolia.basescan.org/address/0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80> |
| ETH/cbBTC + ALO               | _fill in_ | <https://sepolia.basescan.org/address/0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8> |

> **If `initialize` reverts on row 4 (ETH/cbBTC + ALO):** ALO is
> registered in `v4-contracts.ts` but the deployed contract may not
> expose v4 hook permissions in its address salt. If the receipt
> reverts with `HookPermissionsValidationFailed`, we'll redeploy the
> ALO hook with the correct permission flags before retrying. Capture
> the failing tx hash in the PR.

## 3. Add liquidity to one pool (so swap routes)

The Uniswap v4 quoter on Base Sepolia needs liquidity to return a
non-zero output. Pick the pool you want to swap on (recommend
**ETH/USDC + Dynamic Fee**) and:

1. From the Pools list, click the row you just created → **Add
   liquidity to this pool**.
2. Enter modest amounts (e.g. 0.001 ETH + 4 USDC) and pick **Full** range.
3. Sign Permit2 approval (one-time per token, ever) + sign the
   `modifyLiquidities` tx.
4. Record the BaseScan link.

| Pool | Add-liquidity tx |
| ---- | ---------------- |
| ETH/USDC + Dynamic Fee | _fill in_ |

## 4. Swap through the hooked pool

1. Open **Swap** from the right panel.
2. Sell `ETH`, buy `USDC`, amount `0.0005`.
3. Confirm the **Exchange Rate (Incl. Fees)** row populates with a real
   number (proves the quote endpoint hit a real Base Sepolia pool).
4. Set the **Swap Hook** dropdown to **Dynamic Fee** so the warning
   logic is visible.
5. Click **Review Swap** → sign in your wallet.
6. Record the BaseScan link.

| Direction | Tx |
| --------- | -- |
| 0.0005 ETH → USDC via Dynamic Fee pool | _fill in_ |

The Dynamic Fee hook's BaseScan page should show a new `BeforeSwap`
event referencing the same tx hash.

## 5. Verifying hook-call history on BaseScan

For each hook contract:

1. Open `https://sepolia.basescan.org/address/<HOOK_ADDRESS>`.
2. Click **Events**.
3. Filter for the lifecycle event(s) you expect (`BeforeInitialize`,
   `BeforeSwap`, etc., per `HOOK_PERMISSIONS` in
   `server/src/lib/v4-contracts.ts`).

A non-empty event list with `tx hash` matching the receipts you
captured above is the verification we need.

## Quick reference: contract addresses on Base Sepolia

| Contract | Address |
| -------- | ------- |
| PoolManager v4 | `0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408` |
| PositionManager v4 | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` |
| StateView v4 | `0x571291b572ed32ce6751a2cb2486ebee8defb9b4` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| StableProtection hook | `0xe5e6a9E09Ad1e536788f0c142AD5bc69e8B020C0` |
| DynamicFee hook | `0x9788B8495ebcEC1C1D1436681B0F56C6fc0140c0` |
| RWAGate hook | `0xbba7cf860b47e16b9b83d8185878ec0fad0d4a80` |
| AsyncLimitOrder hook | `0xb9e29f39bbf01c9d0ff6f1c72859f0ef550fd0c8` |

(See `server/src/lib/v4-contracts.ts` for the source of truth.)
