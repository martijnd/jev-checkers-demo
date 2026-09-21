import { describe, expect, it } from "vitest";
import {
  EMPTY_USAGE_TOTALS,
  JEV_INPUT_USD_PER_MILLION,
  addUsageToTotals,
  estimateJevCost,
  formatUsd,
  usageFromTokens,
} from "./cost";

describe("estimateJevCost", () => {
  it("charges only input tokens at the AI Gateway list price", () => {
    expect(estimateJevCost({ inputTokens: 1_000_000, outputTokens: 20 })).toBe(
      JEV_INPUT_USD_PER_MILLION,
    );
    expect(estimateJevCost({ inputTokens: 500, outputTokens: 20 })).toBeCloseTo(0.000021, 10);
  });

  it("returns null when the provider omitted token counts", () => {
    expect(estimateJevCost({ inputTokens: undefined, outputTokens: undefined })).toBeNull();
  });
});

describe("usage totals", () => {
  it("accumulates requests, tokens, and estimated dollars", () => {
    const first = addUsageToTotals(
      EMPTY_USAGE_TOTALS,
      usageFromTokens({ inputTokens: 1000, outputTokens: 10 }),
    );
    const second = addUsageToTotals(
      first,
      usageFromTokens({ inputTokens: 500, outputTokens: 5 }),
    );

    expect(second.requests).toBe(2);
    expect(second.inputTokens).toBe(1500);
    expect(second.outputTokens).toBe(15);
    expect(second.estimatedUsd).toBeCloseTo(0.000063, 10);
  });
});

describe("formatUsd", () => {
  it("keeps enough precision for Jev-sized requests", () => {
    expect(formatUsd(0.000021)).toBe("$0.000021");
    expect(formatUsd(0)).toBe("$0");
    expect(formatUsd(null)).toBe("—");
  });
});
