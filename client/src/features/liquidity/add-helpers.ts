import type { useAddLiquidity } from "./use-add-liquidity.ts";

export function addCtaLabel(state: ReturnType<typeof useAddLiquidity>["state"]): string {
  switch (state.status) {
    case "preparing":
      return "Preparing calldata…";
    case "approving":
      return state.message ?? "Approving…";
    case "signing":
      return "Sign in wallet…";
    case "pending":
      return "Waiting for confirmation…";
    case "success":
      return "Liquidity added";
    case "error":
      return "Try again";
    default:
      return "Add liquidity";
  }
}
