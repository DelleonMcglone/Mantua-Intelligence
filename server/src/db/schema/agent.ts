import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.ts";

export const agentWallets = pgTable(
  "agent_wallets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cdpWalletId: varchar("cdp_wallet_id", { length: 128 }).notNull().unique(),
    address: varchar("address", { length: 42 }).notNull().unique(),
    label: varchar("label", { length: 64 }),
    dailyCapUsd: numeric("daily_cap_usd", { precision: 20, scale: 2 })
      .notNull()
      .default("100"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_wallets_user_idx").on(t.userId)],
);

export type AgentWallet = typeof agentWallets.$inferSelect;
export type NewAgentWallet = typeof agentWallets.$inferInsert;
