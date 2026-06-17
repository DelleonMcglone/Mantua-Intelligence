import { ArrowUpDown, BarChart3, Bot, Droplet } from "lucide-react";
import { Logo } from "./Logo.tsx";
import { PanelHeader } from "./PanelHeader.tsx";

export type HomePromptId = "pool" | "swap" | "analyze" | "agent";

interface Props {
  onPromptSelect: (id: HomePromptId) => void;
  onNewChat: () => void;
}

const PROMPTS: { id: HomePromptId; title: string; icon: typeof Droplet }[] = [
  { id: "analyze", title: "Analyze and research your favorite token or protocol", icon: BarChart3 },
  { id: "pool", title: "Create / Add Liquidity with Stable protection", icon: Droplet },
  { id: "swap", title: "Swap Stablecoins", icon: ArrowUpDown },
  { id: "agent", title: "Create / Manage Agent", icon: Bot },
];

/**
 * Default right-column view — matches prototype `HomeMenu` in panels.jsx.
 * Shared `<PanelHeader />` ("Ask Mantua" + New chat button), greeting
 * line with the Mantua avatar, and a 2x2 grid of prompt cards.
 */
export function HomeMenu({ onPromptSelect, onNewChat }: Props) {
  return (
    <>
      <PanelHeader onNewChat={onNewChat} />

      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start gap-3 mb-2.5">
          <div className="w-7 h-7 rounded-xs bg-bg-elev border border-border-soft flex items-center justify-center flex-shrink-0">
            <Logo size={22} />
          </div>
          <div>
            <div className="text-[17px] font-medium">What can I help you with?</div>
            <div className="text-[13px] text-text-dim mt-1">
              Try some of the prompts below or use your own to begin.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3.5">
          {PROMPTS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPromptSelect(p.id);
                }}
                className="bg-bg-elev border border-border-soft rounded-md p-4 min-h-[105px] cursor-pointer flex flex-col transition-all text-left hover:border-accent hover:bg-row-hover"
              >
                <div className="h-9 w-9 rounded-full bg-accent/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <div className="text-[13px] font-semibold leading-snug text-text mt-3">
                  {p.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
