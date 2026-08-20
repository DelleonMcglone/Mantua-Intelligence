# Dynamic Market Hook — Arc Testnet deploy

Deploys the Dynamic Market Hook stack: a dedicated Uniswap v4 `PoolManager`, the
`MarketStateRegistry`, and the hook itself at a mined CREATE2 address.

**Spec:** [`docs/specs/dynamic-market-hook.md`](../../docs/specs/dynamic-market-hook.md)
§37–§42.
**Task:** B2-005.
**Status: NOT DEPLOYED.** The script and the salt mine are written and tested;
the broadcast has not been run because it needs a funded Arc deployer key. Every
address below is blank until it has.

---

## Why the salt mine is the load-bearing step

Uniswap v4 does not store a hook's permissions — it reads them from the hook's
**address**. The low 14 bits are the permission bitmap. So the hook has to be
deployed to an address that already encodes exactly the four callbacks it
implements:

```
BEFORE_INITIALIZE    1 << 13
BEFORE_ADD_LIQUIDITY 1 << 11
BEFORE_SWAP          1 << 7
AFTER_SWAP           1 << 6
                     ------
                     0x28C0
```

The deployed address must satisfy `uint160(addr) & 0x3FFF == 0x28C0`.

`HookMiner.find` brute-forces a CREATE2 salt until the predicted address has
those bits. Because CREATE2 derives the address from
`(proxy, salt, keccak(initcode))` and **not** from the deployer's nonce, the
result is reproducible: same salt and same initcode always give the same
address, on any chain, regardless of deploy order.

**The initcode includes the constructor arguments.** A salt mined against one
`(poolManager, registry)` pair is worthless for another, so the registry and
PoolManager must be deployed _before_ mining. The script does this in order.

This is verified in [`SaltMine.t.sol`](../../contracts/test/hooks/dynamic-market/SaltMine.t.sol),
which mines against the real initcode, deploys through a CREATE2 proxy, and
asserts the deployed address equals the mined one and carries the right bits.

> **Getting this wrong is not recoverable in place.** Adding a callback later
> changes the required bitmap, which changes the address, which means a
> redeploy and re-pointing every pool. The four permissions are fixed before
> deployment, not discovered during it.

---

## Prerequisites

- Foundry, and `contracts/lib/` populated — it is gitignored, so a fresh
  checkout has no dependencies:
  ```bash
  cd contracts && mkdir -p lib
  git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
  git clone --depth 1 https://github.com/transmissions11/solmate lib/solmate
  git clone --depth 1 https://github.com/OpenZeppelin/openzeppelin-contracts lib/openzeppelin-contracts
  git clone --depth 1 https://github.com/Uniswap/v4-core lib/v4-core
  git clone --depth 1 https://github.com/Uniswap/v4-periphery lib/v4-periphery
  (cd lib/v4-core && git submodule update --init --recursive --depth 1)
  (cd lib/v4-periphery && git submodule update --init --recursive --depth 1)
  ```
- An Arc Testnet deployer funded with USDC — Arc uses **USDC as the native gas
  token**, so there is no separate ETH to acquire. Top up at
  <https://faucet.circle.com>.

- **The deployer key in an encrypted keystore, not a plaintext variable.**
  `--interactive` prompts for the key so it never lands in shell history, a
  dotfile, or a repo file:

  ```bash
  cast wallet import mantua-deployer --interactive
  cast wallet address --account mantua-deployer   # fund this
  ```

  > Do not put a private key in `PRIVATE_KEY=`, in a command line, in a chat, or
  > anywhere it is stored as text. A key that has been pasted somewhere is spent:
  > rotate it and move the funds rather than hoping. Only the two **public**
  > addresses below belong in environment variables.

- Environment — public addresses only:
  ```bash
  export MARKET_OPERATOR=0x...   # registers pools, pauses, rotates roles
  export MARKET_RESOLVER=0x...   # the keeper — same key as the market resolver (spec §0.1)
  ```

---

## Run

From the repo root (the script lives inside the Foundry project at
`contracts/script/`; running it from anywhere else can't resolve the
remappings — verified by dry run 2026-08-17, ~0.33 USDC gas at 41 gwei):

```bash
cd contracts && forge script script/DeployDynamicMarket.s.sol \
  --rpc-url https://rpc.testnet.arc.network \
  --account mantua-deployer \
  --sender "$(cast wallet address --account mantua-deployer)" \
  --broadcast \
  --verify --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api
```

(`--via-ir --optimizer-runs 200` are already the project defaults in
`contracts/foundry.toml`, so they're not repeated on the command line.)

`--account` reads the encrypted keystore and prompts for its password; the key is
never passed as an argument. `--sender` is required alongside it so the script
simulates against the right address.

`--via-ir --optimizer-runs 200` matches the rest of the repo (spec §39).
Blockscout verification needs no API key (spec §40).

The script asserts the mined address matches the deployed one and that the
permission bits equal `0x28C0`, so a bad deploy fails in the transaction rather
than at the first pool initialize.

---

## Deployment record

Broadcast 2026-08-17 by the project operator from the `mantua-deployer`
encrypted keystore. Total cost 0.1237 USDC (blocks 57496929–57496930).

| Field                | Value                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chain                | Arc Testnet                                                                                                                                      |
| Chain ID             | `5042002`                                                                                                                                        |
| RPC                  | `https://rpc.testnet.arc.network`                                                                                                                |
| Explorer             | <https://testnet.arcscan.app>                                                                                                                    |
| PoolManager          | `0xee196B3F83Fe6f57E074C399DBdeFe07e1407636` (tx `0x8eed1a30…4881ec5`)                                                                           |
| PositionManager      | `0xd288EE632fb58101211C7c87b3FCF44328C6866d` (periphery broadcast 2026-08-17; + PositionDescriptor `0x52e8c370Ff772408b925f8524f49BFd1B96Beb93`) |
| StateView            | `0x17a69A23F3c0F7F0dCA6391f967C020BaC0906da`                                                                                                     |
| V4Quoter             | `0x448E16702C19fF0b0AF7b51D675Cc40f1b2D5281`                                                                                                     |
| PoolSwapTest         | `0x1791972C76a8Bcb9da83E50B9435612590a0102f` (+ PoolModifyLiquidityTest `0x6A8Ce701aB14a2909F22a18063426fEE016A36da`)                            |
| MarketStateRegistry  | `0xEA8c2f329E7eBD9a67FA7E502CEcc938bE3ec7a6` (tx `0xf526161c…4cf92dd`)                                                                           |
| DynamicMarketHook    | `0xbb5D42DC40128fa681882cA49f9A74d50D15E8c0` (tx `0xd25badda…8bd258ad`)                                                                          |
| Deployment salt      | `0x…6e13`                                                                                                                                        |
| Hook permission bits | `0x28C0` ✅ (asserted in-tx and re-derived from the address post-deploy)                                                                         |
| Operator             | `0x4EF85782DE0826BeaF9B40Cc534C9aAf849312C3`                                                                                                     |
| Keeper               | `0x4EF85782DE0826BeaF9B40Cc534C9aAf849312C3` (same key, spec §0.1)                                                                               |
| Verification status  | all three verified on ArcScan (Blockscout), 2026-08-17                                                                                           |

> **Receipt-label caveat.** Foundry's console receipts printed the
> PoolManager/registry names swapped; the broadcast JSON `contractName` fields
> and on-chain probes (`hook.poolManager()`, `hook.registry()`, code sizes)
> confirm the addresses above. Trust the script's own logs, not the receipt
> banner.
>
> **Verification gotcha.** The repo's `[etherscan]` config block references
> `${BASESCAN_API_KEY}`, which fails config parsing when unset — export any
> dummy value (`BASESCAN_API_KEY=unused`) before `forge verify-contract`
> against Blockscout.

> **Periphery is a second step.** This script deploys the `PoolManager` only.
> `PositionManager`, `StateView`, `V4Quoter`, and `PoolSwapTest` follow the same
> pattern as [`deploy/arc-dynamicfee-periphery`](../arc-dynamicfee-periphery)
> against this stack's PoolManager. Until they exist, `getV4StackForHook` will
> throw for this hook rather than route to a half-built stack.

---

## After deploying

1. **Register a market** before initializing its pool — `beforeInitialize`
   rejects an unregistered pool (spec §8):

   ```bash
   cast send $REGISTRY \
     "registerPool(bytes32,uint64,uint64,bool,uint8)" \
     $MARKET_ID $KICKOFF $RESOLUTION $YES_IS_TOKEN0 6 \
     --rpc-url https://rpc.testnet.arc.network
   ```

   - `MARKET_ID` — from `server/src/lib/market-id.ts` (spec §0.4 / B0-004).
   - `YES_IS_TOKEN0` — whether YES sorts below USDC by address. **Getting this
     wrong does not revert**; it inverts every probability the hook reads, so a
     25% market prices as a near-certainty. Compute it, do not guess it.
   - `6` — outcome-token decimals, confirmed in spec §0.1.

2. **Initialize the pool** with `fee = 0x800000` (`DYNAMIC_FEE_FLAG`). A static
   fee is rejected: without the flag the PoolManager ignores the hook's fee
   override and the pool would silently run at a fixed tier.

3. **Feed the keeper state.** Until the first `updateMarket`, the market reads
   as stale, so the fee sits at `MAX_FEE` (5%) and the cap at `MIN_TRADE_CAP`
   ($100). That is the intended fail-closed posture (spec §22), not a bug.

4. **Record addresses** in the table above, then add the entry to
   `HOOK_DEPLOYMENTS_ARC` in `server/src/lib/v4-contracts.ts` and extend
   `HOOK_NAMES` with `"dynamic-market"`. A test in
   `server/src/lib/v4-contracts.test.ts` currently asserts that entry is
   **absent** — update it in the same commit, deliberately.

---

## Keeper permissions

The keeper may write exactly three fields, via one function:

```
updateMarket(poolId, modelProbability, confidence, eventState)
```

Both bps values are bounds-checked before storage and revert above `10_000`. The
keeper cannot register pools, pause, move a kickoff timestamp, change risk
limits, or rotate any role — those are the operator's, and the split is what
contains a compromised keeper (spec §25).

Nothing the keeper writes can breach the immutable bounds in `RiskPolicy`, and
the kickoff freeze reads the registration timestamp, so it fires whether or not
the keeper is alive.

## Fee decomposition event

Every swap emits, for the UI market-adaptation panel (spec §29):

```solidity
event MarketFeeUpdated(PoolId indexed poolId, Breakdown breakdown, uint24 effectiveFee);
```

`Breakdown` carries `baseFee`, `volatilityPremium`, `imbalancePremium`,
`liquidityPremium`, `eventRiskPremium`, `deviationPremium`, and
`directionalAdjustment`. It is emitted as a struct rather than seven flat
parameters so adding a premium later does not change the signature.

---

## Base Sepolia deploy (2026-08-20)

Deployed by `mantua-deployer-2` (deployer/operator/keeper
`0x9215594bdA3fE6c029155566B9c9DA75dFC1024D`) — a fresh key created after
the original Arc keystore passphrase was lost; the server signs Base
market operations with `BASE_MARKET_SIGNER_PRIVATE_KEY`.

| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| PoolManager         | `0x53AA23D6B81562E75505EA25e015650a2BB8fDCa` |
| MarketStateRegistry | `0x1c03020a160ad4558414235c90F305F010Baf086` |
| DynamicMarketHook   | `0xff94F6319d3A67682147c997D1323D0f0B1768c0` |
| MarketFactory       | `0x9aB104e89F8de7bc240a134Dc6adBCe7124D3d84` |
| Resolver            | `0x0FEAf3BA53E9F163c8060F4d437bcC77F86E4270` |
| USDC (collateral)   | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

Periphery (against the PoolManager above): PoolSwapTest
`0x4357c1d769fc94278ae85b36e22dd494cca078b4`, PoolModifyLiquidityTest
`0x37fbd7e25de3259340e0879ec15f19c56abcc55b`, StateView
`0xc352dc25d3ab4748cce6600efb3d5edf42613a45`, V4Quoter
`0xbb91b69d888afb30eebd373023480d2007d37cd6`, PositionDescriptor
`0x5f30b3ff7b65e3c06a02a2e120c9a2478ea26be9`, PositionManager
`0x275dc77b579b56eb493732f177b1109141ad9a67`.

Verified on-chain post-deploy: `hook & 0x3FFF == 0x28C0`,
`hook.poolManager()` == PoolManager, `registry.operator()` == deployer,
`resolver.factory()` == MarketFactory, and every periphery contract's
`poolManager()`/`manager()` == PoolManager. NOTE: the Foundry receipt
labels were scrambled (same quirk as the Arc deploy) — the mapping above
is from the simulation logs + on-chain probes. Server registration:
`DYNAMIC_MARKET_BY_CHAIN[84532]`, `MARKETS_BY_CHAIN[84532]`,
`MARKETS_PERIPHERY_BY_CHAIN[84532]`. Base market ids mix the chain id
into the hash (see `server/src/lib/market-id.ts`).
