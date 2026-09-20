import type { ComponentType } from "react";
import { FootballIcon } from "@/components/shell/sport-icons.tsx";

/**
 * The leagues Mantua runs prediction markets for. One catalog feeds both
 * the header nav and the per-sport market pages, so a league added here
 * shows up in both places with the same label and glyph.
 *
 * NFL is the whole catalog (owner decision, task 001). The type stays a
 * union and the list stays an array so adding a second league later is a
 * one-line change rather than a re-plumbing.
 */
export type SportId = "nfl";

export interface Sport {
  id: SportId;
  /** Nav label and page title. */
  label: string;
  /** One-line description of what trades on this league's markets. */
  blurb: string;
  icon: ComponentType<{ className?: string }>;
}

const SPORTS_BY_ID: Record<SportId, Sport> = {
  nfl: {
    id: "nfl",
    label: "NFL",
    blurb: "Moneylines on every NFL game.",
    icon: FootballIcon,
  },
};

/** Nav order. One entry today; the record above stays the source of truth. */
export const SPORTS: Sport[] = Object.values(SPORTS_BY_ID);

export function getSport(id: SportId): Sport {
  return SPORTS_BY_ID[id];
}

export function isSportId(value: unknown): value is SportId {
  return typeof value === "string" && Object.hasOwn(SPORTS_BY_ID, value);
}
