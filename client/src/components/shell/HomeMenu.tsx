import { BarChart3, Bot } from "lucide-react";

export type HomePromptId = "analyze" | "agent";

const PROMPTS: { id: HomePromptId; title: string; icon: typeof Bot }[] = [
  { id: "agent", title: "Create / Manage your Agent", icon: Bot },
  {
    id: "analyze",
    title: "Analyze today's games, matchups, and markets",
    icon: BarChart3,
  },
];

interface Props {
  onPromptSelect: (id: HomePromptId) => void;
}

/**
 * The home page's prompt cards — a single row across the top (stacking on
 * small screens), ordered agent → analyze. The swap and liquidity cards
 * went with the trading surfaces (task 001).
 */
export function HomePromptRow({ onPromptSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PROMPTS.map((p) => {
        const Icon = p.icon;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onPromptSelect(p.id);
            }}
            className="bg-bg-elev border border-border-soft rounded-md p-4 min-h-[105px] cursor-pointer flex flex-col justify-between transition-all text-left hover:border-accent hover:bg-row-hover"
          >
            <div className="text-[13px] leading-snug text-text">{p.title}</div>
            <div className="text-text-dim mt-6">
              <Icon className="h-4 w-4" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
