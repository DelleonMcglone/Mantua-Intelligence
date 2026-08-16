# Spec — Dynamic Market Hook

> **STATUS: BLOCKED — this is not a spec yet.**
>
> **Task:** B0-003 in `docs/tasks/sports-pivot.md`, gated on decision DM-110.
> The hook specification has not been supplied, so this file records what the
> spec has to answer and what is already fixed by decisions that _are_ closed.
> Do not start B2 against this document.

---

## Why this blocks more than B0-003

Six P0 tasks in B2 depend on it (B2-001 … B2-005, B2-007), and B2 is scheduled
for W2. Every league page stays empty until this hook is deployed, so it is the
critical path for the prediction market as a whole.

**One decision inside it is irreversible.** Uniswap v4 encodes a hook's
permissions in its address, so B2-002 mines an address matching the callback
set. Choosing the wrong callbacks means redeploying at a new address and
re-pointing every pool. The callback list has to be right before deployment,
not discovered during it.

---

## What the spec must answer

### 1. Callback set

Which v4 callbacks the hook implements — `beforeSwap`, `afterSwap`,
`beforeAddLiquidity`, `afterAddLiquidity`, and their `*Return` variants.

This fixes the permission flags mined into the address (B2-002). Include any
callback that might plausibly be needed later: adding one afterwards is a
redeployment.

### 2. Fee behaviour

The plan (B2-004) calls for fee behaviour that varies with game state —
pre-game, in-play, near-resolution. The spec needs:

- how the hook learns the game state (stored on the hook, read from the market
  contract, or pushed by the resolver — each has a different trust and gas
  profile);
- the fee curve or table per state;
- the maximum fee, which B2-008's invariant test asserts against;
- whether fees are directional, as Stable Protection's are.

### 3. Freeze enforcement

B2-003 requires the hook to reject swaps once a market is `FROZEN`. The spec
needs to say how the hook reads that state, and what it does if the read fails
— fail closed (reject the swap) is almost certainly correct here, but it should
be stated rather than assumed.

### 4. Liquidity behaviour

Whether the hook constrains adding or removing liquidity, particularly between
freeze and resolution. B2-008 requires that the hook cannot block a legitimate
redeem; the spec must make clear that redemption is not a swap path the hook
can interfere with.

---

## Already fixed by closed decisions

These are settled and the spec must be consistent with them, not revisit them:

| Constraint                                                            | Source                     |
| --------------------------------------------------------------------- | -------------------------- |
| Pool is YES token vs USDC                                             | DM-101                     |
| YES/NO are plain ERC-20, 1:1 USDC-collateralised                      | DM-102                     |
| Arc Testnet, native-USDC gas, 18dp/6dp split                          | DM-104                     |
| Moneyline only — binary outcomes                                      | DM-106                     |
| Market states `OPEN → FROZEN → RESOLVED → SETTLED`, plus `INVALID`    | `market-lifecycle.md`      |
| Freeze fires at scheduled start, time-based                           | `market-lifecycle.md` §3.4 |
| `split`/`merge` are fee-free; fees are the hook's job, swap path only | `market-lifecycle.md` §3.3 |

---

## Interim position

Stable Protection and Dynamic Fee remain deployed and serve the non-market base
pools (B2-006). Nothing about the blocked state of this hook affects them.
