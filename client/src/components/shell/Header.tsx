import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Logo } from "./Logo.tsx";

interface HeaderProps {
  walletAddress?: string | undefined;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Top bar — matches prototype `Header` (logo left, theme toggle + Connect
 * Wallet right). 18px vertical / 32px horizontal padding, soft border below.
 */
export function Header({ walletAddress, onConnect, onDisconnect }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-border-soft">
      <div className="flex items-center gap-3">
        <Logo size={30} />
        <span className="text-[17px] font-semibold tracking-tight">Mantua.AI</span>
      </div>
      <div className="flex items-center gap-2.5">
        <Button variant="icon" size="icon" aria-label="Toggle theme" onClick={toggle}>
          <Icon className="h-[18px] w-[18px]" />
        </Button>
        {walletAddress ? (
          <Button variant="ghost" onClick={onDisconnect}>
            <span className="h-2 w-2 rounded-full bg-green" />
            <span className="font-mono text-[13px]">{shorten(walletAddress)}</span>
          </Button>
        ) : (
          <Button variant="primary" onClick={onConnect}>
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
}

function shorten(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
