export const JEV_INPUT_USD_PER_MILLION = 0.042;
export const JEV_OUTPUT_USD_PER_MILLION = 0;

export interface TokenCounts {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}

export interface JevUsage {
  input_tokens: number | undefined;
  output_tokens: number | undefined;
  estimated_usd: number | null;
  input_usd_per_million: number;
  output_usd_per_million: number;
}

export interface UsageTotals {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
}

export const EMPTY_USAGE_TOTALS: UsageTotals = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedUsd: 0,
};

export function estimateJevCost(usage: TokenCounts): number | null {
  if (usage.inputTokens === undefined && usage.outputTokens === undefined) {
    return null;
  }
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  return (
    (input / 1_000_000) * JEV_INPUT_USD_PER_MILLION +
    (output / 1_000_000) * JEV_OUTPUT_USD_PER_MILLION
  );
}

export function usageFromTokens(usage: TokenCounts): JevUsage {
  return {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_usd: estimateJevCost(usage),
    input_usd_per_million: JEV_INPUT_USD_PER_MILLION,
    output_usd_per_million: JEV_OUTPUT_USD_PER_MILLION,
  };
}

export function addUsageToTotals(totals: UsageTotals, usage: JevUsage): UsageTotals {
  return {
    requests: totals.requests + 1,
    inputTokens: totals.inputTokens + (usage.input_tokens ?? 0),
    outputTokens: totals.outputTokens + (usage.output_tokens ?? 0),
    estimatedUsd: totals.estimatedUsd + (usage.estimated_usd ?? 0),
  };
}

export function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "—";
  }
  if (amount === 0) {
    return "$0";
  }
  if (amount < 0.000001) {
    return `$${amount.toExponential(2)}`;
  }
  if (amount < 0.01) {
    return `$${amount.toFixed(6)}`;
  }
  return `$${amount.toFixed(4)}`;
}

export function formatTokenCount(value: number | undefined): string {
  if (value === undefined) {
    return "—";
  }
  return value.toLocaleString("en-US");
}
