import { TestnetBridgePanel } from "./TestnetBridgePanel.tsx";

/**
 * Bridge modal. Mantua runs on Arc Testnet; this bridges USDC OUT of Arc to
 * other CCTP networks via Circle's Bridge Kit + Forwarding Service. Thin
 * pass-through that keeps a stable import surface (mirrors SwapPanel).
 */
export function BridgePanel({ onClose }: { onClose?: () => void } = {}) {
  return <TestnetBridgePanel {...(onClose ? { onClose } : {})} />;
}
