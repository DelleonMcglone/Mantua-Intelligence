import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { MantuaPrivyProvider } from "./lib/privy/provider.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <MantuaPrivyProvider>
      <App />
    </MantuaPrivyProvider>
  </StrictMode>,
);
