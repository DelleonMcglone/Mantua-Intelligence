-- PR #101: runtime multi-chain. Pools table gains a chainId column so
-- Base Sepolia (84532) and Unichain Sepolia (1301) entries can coexist
-- and be filtered per-chain on the Positions tab.
--
-- Existing rows are backfilled to 84532 (Base Sepolia) — every pool
-- ever recorded before this migration was created against that chain.
ALTER TABLE "pools" ADD COLUMN "chain_id" integer NOT NULL DEFAULT 84532;
