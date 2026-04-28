# Hook integration tests (Phase 5 fork harness)

Foundry-native integration tests that fork **Base Sepolia** and exercise
each Mantua hook against the live `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`
PoolManager.

## Running

```bash
# From repo root.
# Optional: set BASE_SEPOLIA_RPC_URL in .env for a faster, non-rate-limited
# endpoint. Otherwise the harness falls back to https://sepolia.base.org.
forge test --root contracts --match-path "test/integration/*.t.sol" -vv
```

`HookBaseline.t.sol` runs unconditionally — it asserts each of the four
hooks has bytecode at its documented address and that the lower-14-bit
permission flags match what the hook source declares. This is the
foundry-native counterpart to `npm run verify:hooks`.

## Stub coverage

The four `*E2E.t.sol` files are **scaffolds**. Every test function calls
`vm.skip(true)` until its prerequisites land. See each file's docblock
for the unblock checklist.

| File | Roadmap ID | Blocked on |
|---|---|---|
| `StableProtectionE2E.t.sol` | P5-006 | P5-005 (USDC/EURC pool creation) |
| `DynamicFeeE2E.t.sol` | P5-010 | P5-008 (TWAP volatility source) + DynamicFee pool route |
| `RWAGateE2E.t.sol` | P5-013 | P5-011 (KYC-list admin path) |
| `AsyncLimitOrderE2E.t.sol` | P5-016 | ALO pool creation route + order-encoding fixtures |

When unblocking a stub, replace `vm.skip(true)` with the actual test
body and remove the corresponding row from this table.

## Conventions

- All integration tests inherit from `BaseSepoliaFork`, which handles
  fork setup and exposes the four hook addresses + permission-flag
  constants.
- Default fork is `latest` — no pinned block. Pin per-test with
  `vm.createSelectFork(rpc, BLOCK)` in test setUp when you need
  reproducible pool state.
- Use `makeAddr("name")` for synthetic wallets and `vm.deal` /
  `deal()` to fund them — never check in private keys.
