# Phase 4e — StateView (live slot0)

This slice replaces the price-at-mint approximation with a live read of
`StateView.getSlot0` on Base mainnet. Two consumers:

- `POST /api/liquidity/remove/calldata` — server reads slot0 from the
  position's PoolKey before computing slippage bounds.
- `POST /api/liquidity/add/calldata` — `sqrtPriceX96` is now optional
  in the request; when omitted the server reads slot0. Pool-create
  flow keeps passing the freshly-initialized price to skip the RPC.

A read-only `GET /api/pool-state?tokenA=…&tokenB=…&fee=…` route is
exposed for clients that need to probe a pool's live state without
building calldata.

## Setup

Same as `phase-4-liquidity.md`, plus:

- Set `BASE_RPC_URL` in `server/.env` to a paid endpoint
  (Alchemy / QuickNode). The default `https://mainnet.base.org` is
  fine for dev but rate-limits aggressively.

## Live remove (live price)

After Phase 4d's "Add liquidity" step:

- [ ] Open **Positions** → **Remove** on the open position. Modal opens
      without the previous "no price reference" gate.
- [ ] Set 50% / 50 bps → **Remove** → confirm → wallet signs.
- [ ] Server log shows a single `eth_call` to `0xa3c0…7a71` (StateView)
      between request receipt and response.
- [ ] DB: `portfolio_transactions.params.isFullExit=false`. Position
      row's `liquidity` decremented.
- [ ] Move the price (run a swap on the same pool from another tab),
      then remove again. The new slippage bounds reflect the post-swap
      price — verify by inspecting `amount0Min/amount1Min` in the
      response.

## Pool-state probe

- [ ] `curl 'http://localhost:3001/api/pool-state?tokenA=ETH&tokenB=USDC&fee=500'`
      returns `{ exists: true, sqrtPriceX96, tick }` for a live pool.
- [ ] Same query against an uninitialized pair (e.g. `tokenA=LINK&tokenB=EURC`)
      returns `{ exists: false }`.
- [ ] Bad fee tier (e.g. `fee=123`) returns 400 with `BAD_REQUEST`.

## Add without client-supplied price

- [ ] On a Mantua-created pool, call
      `POST /api/liquidity/add/calldata` without `sqrtPriceX96` in the
      body — response includes `sqrtPriceX96` matching the on-chain
      slot0 and the rest of the calldata is unchanged.
- [ ] Same call against an uninitialized pool returns 400 with
      `POOL_NOT_INITIALIZED`.

## What this slice deliberately does NOT cover

- DefiLlama → PoolKey translation + enabling the **PoolDetailPage** Add
  button. The server is now ready; the UI plumbing comes in the next
  follow-up.
- Permit2 batch approvals — still pending.
- Subgraph indexing for pre-Mantua positions — still pending.
