import { ArrowLeftRight, ArrowUpDown, BarChart3, Bot, Droplet } from "lucide-react";
import { Logo } from "./Logo.tsx";
import { PanelHeader } from "./PanelHeader.tsx";

export type HomePromptId = "pool" | "swap" | "analyze" | "bridge" | "agent";

interface Props {
  onPromptSelect: (id: HomePromptId) => void;
  onNewChat: () => void;
}

const PROMPTS: { id: HomePromptId; title: string; icon: typeof Droplet }[] = [
  {
    id: "analyze",
    title: "Analyze and research your favorite stablecoin assets on Arc",
    icon: BarChart3,
  },
  { id: "pool", title: "Create / Add Liquidity with Stable protection", icon: Droplet },
  { id: "swap", title: "Swap Stablecoins with Dynamic fee logic", icon: ArrowUpDown },
  { id: "bridge", title: "Bridge USDC to another network", icon: ArrowLeftRight },
  { id: "agent", title: "Create / Manage Circle Agent", icon: Bot },
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
                className="bg-bg-elev border border-border-soft rounded-md p-4 min-h-[105px] cursor-pointer flex flex-col justify-between transition-all text-left hover:border-accent hover:bg-row-hover [&:nth-child(odd):last-child]:col-span-2 [&:nth-child(odd):last-child]:w-[calc(50%-0.375rem)] [&:nth-child(odd):last-child]:justify-self-center"
              >
                <div className="text-[13px] leading-snug text-text">{p.title}</div>
                <div className="text-text-dim mt-6">
                  <Icon className="h-4 w-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
