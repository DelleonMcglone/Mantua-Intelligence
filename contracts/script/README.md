# Foundry scripts

## DeployStableProtectionBaseSepolia.s.sol — Phase 5b-3

Preparation-only redeploy of the Stable Protection hook to Base Sepolia
(84532). The script is shipped here; **the on-chain deploy is a manual
run** — see procedure below.

### Why a Sepolia-specific script?

The upstream `hooks/stable-protection/script/Deploy.s.sol` (vendored
submodule) hardcodes Unichain Sepolia constants (PoolManager
`0x00B0…62AC`, test routers, mock-stablecoin pool setup). Re-targeting
Base Sepolia means changing the PoolManager and skipping the
mock/liquidity/test-swap path (we use real Circle testnet USDC/EURC
instead, separately, via the client pool-creation flow).

Rather than fork the submodule, this script imports the hook source
through the `stable-protection/` remapping (see `remappings.txt`) and
parameterizes the PoolManager + chain via env vars.

### Prerequisites

1. **Submodules initialized.** From the repo root:
   ```bash
   git submodule update --init --recursive
   ```
   Confirm `contracts/hooks/stable-protection/src/StableProtectionHook.sol` exists.

2. **Foundry deps installed** (one-time, in `contracts/`):
   ```bash
   cd contracts
   forge install foundry-rs/forge-std --no-git
   forge install OpenZeppelin/openzeppelin-contracts --no-git
   forge install Uniswap/v4-core --no-git
   forge install Uniswap/v4-periphery --no-git
   forge install transmissions11/solmate --no-git
   ```

3. **Env vars set** (in `contracts/.env` or your shell):
   - `BASE_SEPOLIA_RPC_URL` — e.g. `https://sepolia.base.org`
   - `PRIVATE_KEY` — deployer's hex private key (no `0x` prefix expected by `vm.envUint`)
   - `BASESCAN_API_KEY` — for `--verify` (BaseScan Sepolia uses the same key as mainnet BaseScan)
   - `POOL_MANAGER` (optional override) — defaults to the verified Base Sepolia v4 PoolManager
     `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` (per
     [developers.uniswap.org/contracts/v4/deployments](https://developers.uniswap.org/contracts/v4/deployments))

4. **Deployer wallet has Base Sepolia ETH.** Faucet:
   [coinbase.com/faucets/base-ethereum-sepolia-faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet).
   The deploy needs roughly 0.005–0.01 ETH for gas.

### Run

From `contracts/`:

```bash
forge script script/DeployStableProtectionBaseSepolia.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

The script prints the mined hook address before broadcasting and the
deployed address after, plus the lower-14-bit permission flags for
sanity-checking against `Hooks.sol`.

### After a successful run (PR #4)

Open follow-up PR titled **"Phase 5b-4: Stable Protection deployed to
Base Sepolia, address captured"** that:

1. Adds the deployed address to `server/src/lib/v4-contracts.ts`
   (Sepolia variant of `STABLE_PROTECTION_HOOK_*`).
2. Updates `docs/security/hook-deployments.md` via
   `npm run verify:hooks` — Stable Protection's row should now show
   Base Sepolia (84532) ✅ Deployed.
3. Updates `docs/security/sign-off.md` to mark the bytecode-verified
   column ✅ for Stable Protection on Base Sepolia.
4. Updates `contracts/README.md` hook table — remove the "Unichain
   Sepolia (deprecated)" row, replace with the Base Sepolia entry.

Tracking: see `docs/tech-debt.md` TD-002.

### Failure modes (stop-and-ask triggers)

- `PoolManager has no bytecode on this chain` — wrong RPC or wrong
  POOL_MANAGER address. Re-verify against Uniswap docs page.
- `Mined and deployed addresses diverged` — CREATE2 reverted, usually
  because the salt search exceeded the iteration budget or the hook
  flags don't match the contract's `getHookPermissions()`.
- BaseScan verification fails (source mismatch) — the submodule's
  `solc` version (0.8.26) differs from the monorepo's foundry config
  (0.8.27); compile metadata won't match. Resolve by aligning solc
  versions or skipping `--verify` and verifying manually post-deploy.
