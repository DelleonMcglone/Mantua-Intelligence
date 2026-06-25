/**
 * Tests for `parseSignalsQuery` — the pure validator behind the public
 * `GET /api/signals` endpoint. Network-free: covers the param coercion and
 * the reject paths (unknown symbol, bad amount, identical in/out) so the
 * route fails fast on malformed input. The network-driven `getTradeSignals`
 * itself is exercised end-to-end via the agent `get_signals` tool path.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSignalsQuery } from "./agent-signals.ts";

describe("parseSignalsQuery", () => {
  it("accepts an empty query (peg-only snapshot)", () => {
    const r = parseSignalsQuery({});
    assert.ok(r.ok);
    assert.deepEqual(r.value, {});
  });

  it("parses a full trade query", () => {
    const r = parseSignalsQuery({ tokenIn: "USDC", tokenOut: "EURC", amountIn: "100" });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { tokenIn: "USDC", tokenOut: "EURC", amountIn: "100" });
  });

  it("trims surrounding whitespace and ignores empty strings", () => {
    const r = parseSignalsQuery({ tokenIn: " USDC ", tokenOut: "", amountIn: "  " });
    assert.ok(r.ok);
    assert.deepEqual(r.value, { tokenIn: "USDC" });
  });

  it("ignores non-string param values", () => {
    const r = parseSignalsQuery({ tokenIn: ["USDC", "EURC"], amountIn: 5 });
    assert.ok(r.ok);
    assert.deepEqual(r.value, {});
  });

  it("rejects an unknown token symbol", () => {
    const r = parseSignalsQuery({ tokenIn: "DOGE" });
    assert.ok(!r.ok);
    assert.match(r.error, /Unknown token symbol for tokenIn/);
  });

  it("rejects a non-positive or non-numeric amount", () => {
    for (const amountIn of ["0", "-5", "abc"]) {
      const r = parseSignalsQuery({ tokenIn: "USDC", tokenOut: "EURC", amountIn });
      assert.ok(!r.ok, `expected reject for amountIn=${amountIn}`);
      assert.match(r.error, /amountIn must be a positive number/);
    }
  });

  it("rejects identical tokenIn and tokenOut", () => {
    const r = parseSignalsQuery({ tokenIn: "USDC", tokenOut: "USDC", amountIn: "100" });
    assert.ok(!r.ok);
    assert.match(r.error, /must differ/);
  });
});
