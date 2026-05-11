import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Logo } from "./Logo.tsx";
import { WalletMenu } from "./WalletMenu.tsx";

interface HeaderProps {
  walletAddress?: string | undefined;
  onConnect?: (() => void) | undefined;
  onDisconnect?: (() => void) | undefined;
  /** Click handler for the logo / wordmark group. Used to send the
   *  user back to the landing page from the in-app shell. */
  onLogoClick?: (() => void) | undefined;
}

/**
 * Top bar — matches prototype `Header` (logo left, theme toggle + Connect
 * Wallet right). 18px vertical / 32px horizontal padding, soft border below.
 */
export function Header({ walletAddress, onConnect, onDisconnect, onLogoClick }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-border-soft">
      <button
        type="button"
        onClick={onLogoClick}
        disabled={!onLogoClick}
        aria-label={onLogoClick ? "Back to landing page" : "Mantua.AI"}
        className="flex items-center gap-3 bg-transparent border-none p-0 cursor-pointer disabled:cursor-default"
      >
        <Logo size={30} />
        <span className="text-[17px] font-semibold tracking-tight">Mantua.AI</span>
      </button>
      <div className="flex items-center gap-2.5">
        <Button variant="icon" size="icon" aria-label="Toggle theme" onClick={toggle}>
          <Icon className="h-[18px] w-[18px]" />
        </Button>
        {walletAddress && onDisconnect ? (
          <WalletMenu walletAddress={walletAddress} onDisconnect={onDisconnect} />
        ) : (
          <Button variant="primary" onClick={onConnect}>
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
}
