import { Check, Loader2, X } from "lucide-react";
import { BRIDGE_CHAINS, type BridgeChainKey } from "./appkit.ts";

/** Chain dropdown shared by the Bridge and Send views. */
export function ChainSelect({
  value,
  onChange,
  id,
}: {
  value: BridgeChainKey;
  onChange: (v: BridgeChainKey) => void;
  id: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => {
        onChange(e.target.value as BridgeChainKey);
      }}
      className="w-full bg-transparent border-none outline-none text-[15px] text-text mt-1 cursor-pointer"
    >
      {BRIDGE_CHAINS.map((c) => (
        <option key={c.key} value={c.key} className="bg-bg-elev text-text">
          {c.label}
        </option>
      ))}
    </select>
  );
}

export function Row({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={dim ? "text-text-dim" : "text-text"}>{label}</span>
      <span className={dim ? "text-text-dim" : "text-text font-medium"}>{value}</span>
    </div>
  );
}

export function StepIcon({ stateValue }: { stateValue: "pending" | "success" | "error" | "noop" }) {
  if (stateValue === "success") return <Check className="h-4 w-4 text-green flex-shrink-0" />;
  if (stateValue === "error") return <X className="h-4 w-4 text-red flex-shrink-0" />;
  if (stateValue === "noop")
    return <span className="h-4 w-4 flex-shrink-0 text-text-dim text-center">–</span>;
  return <Loader2 className="h-4 w-4 animate-spin text-text-dim flex-shrink-0" />;
}
