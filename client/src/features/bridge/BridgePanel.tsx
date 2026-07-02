import { TestnetBridgePanel } from "./TestnetBridgePanel.tsx";

interface BridgePanelProps {
  onClose?: () => void;
  /** Pre-fill from a chat command ("bridge 10 USDC to Base"). */
  initialAmount?: string;
  /** Destination sdkName to pre-select (e.g. "Sei_Atlantic"). */
  initialDestination?: string;
}

/**
 * Bridge modal. Mantua runs on Arc Testnet; this bridges USDC OUT of Arc to
 * other CCTP networks via Circle's Bridge Kit + Forwarding Service. Thin
 * pass-through that keeps a stable import surface (mirrors SwapPanel).
 */
export function BridgePanel({ onClose, initialAmount, initialDestination }: BridgePanelProps = {}) {
  return (
    <TestnetBridgePanel
      {...(onClose ? { onClose } : {})}
      {...(initialAmount ? { initialAmount } : {})}
      {...(initialDestination ? { initialDestination } : {})}
    />
  );
}
