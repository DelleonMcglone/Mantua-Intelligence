import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { BASESCAN_URL } from "@/lib/tokens.ts";

interface WalletMenuProps {
  walletAddress: string;
  onDisconnect: () => void;
}

const CDP_FAUCET_URL = "https://portal.cdp.coinbase.com/products/faucet";

/**
 * Connected-wallet pill in the header. Click toggles a dropdown with
 * Copy address / View on BaseScan / Get testnet ETH (CDP) / Refresh
 * balances / Disconnect. Refresh dispatches `mantua:refresh-portfolio`
 * on the window — the portfolio hooks listen and re-poll immediately.
 */
export function WalletMenu({ walletAddress, onDisconnect }: WalletMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1200);
    });
  };

  const handleRefresh = () => {
    window.dispatchEvent(new Event("mantua:refresh-portfolio"));
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-10 px-3 rounded-sm border border-border bg-transparent text-text-dim hover:bg-bg-elev hover:text-text transition-colors cursor-pointer"
      >
        <span className="h-2 w-2 rounded-full bg-green" />
        <span className="font-mono text-[13px]">{shorten(walletAddress)}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-[calc(100%+6px)] right-0 z-30 bg-panel-solid border border-border rounded-sm p-1 min-w-[220px] shadow-lg"
        >
          <MenuItem onClick={handleCopy}>
            {copied ? "Copied!" : "Copy address"}
          </MenuItem>
          <MenuLink href={`${BASESCAN_URL}/address/${walletAddress}`}>
            View on BaseScan
            <ArrowUpRight className="h-3.5 w-3.5" />
          </MenuLink>
          <MenuLink href={CDP_FAUCET_URL}>
            Get testnet ETH (CDP)
            <ArrowUpRight className="h-3.5 w-3.5" />
          </MenuLink>
          <MenuItem onClick={handleRefresh}>Refresh balances</MenuItem>
          <MenuItem
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
          >
            Disconnect
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2 border-none rounded-xs bg-transparent hover:bg-chip text-text text-[13px] text-left cursor-pointer"
    >
      {children}
    </button>
  );
}

function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      role="menuitem"
      className="flex w-full items-center justify-between px-3 py-2 rounded-xs hover:bg-chip text-text text-[13px] no-underline"
    >
      {children}
    </a>
  );
}

function shorten(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
