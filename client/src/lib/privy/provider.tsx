import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID, privyConfig } from "./config.ts";

export function MantuaPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
      {children}
    </PrivyProvider>
  );
}
