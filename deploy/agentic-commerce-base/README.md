# AgenticCommerce (ERC-8183) — Base Sepolia deploy

Deployed 2026-08-22 by `mantua-deployer-2` (`0x9215594bdA3fE6c029155566B9c9DA75dFC1024D`),
closing the last Arc↔Base contract-parity gap.

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| **Proxy (use this)** | `0x49da1bdd06fafbadaf941a35d732800c89b2b7bb` |
| Implementation       | `0x4c49d46812ae1aafd06e1a9ebcaff7183ec1f9c9` |

The Solidity source is not in this repo — it was reconstructed from the
**Arcscan-verified** Arc implementation
(`0xa316fd02827242d537f84730f8a37d0ba5fd351a`, behind the Arc proxy
`0x0747EEf0706327138c69792bF28Cd525089e4583`): solc 0.8.28, optimizer off,
evm cancun, OZ v5.6 upgradeable (UUPS). `DeployAgenticCommerceBase.s.sol`
(alongside this file) deployed the implementation plus an ERC1967 proxy
initialized with:

- `paymentToken` = Base Sepolia USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- `treasury` = `0xcBe5B97a069be3E4B5398663790731fb76aB620D` (mirrors Arc)
- `admin` = `0x9215594bdA3fE6c029155566B9c9DA75dFC1024D`

Verified post-deploy with cast: `paymentToken()`, `platformTreasury()`,
`jobCounter() == 0`, and `hasRole(DEFAULT_ADMIN_ROLE, admin) == true`.
Registered as the checked-in default of `BASE_AGENTIC_COMMERCE_ADDRESS`
(`server/src/env.ts`); the agent's job tools (create/fund/settle/status)
route to it whenever the active chain is Base Sepolia.
