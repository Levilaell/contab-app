type Pricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

// USD per million tokens (Claude 4.5/4.6 ballpark — update as needed)
const PRICING: Record<string, Pricing> = {
  'claude-haiku-4-5': { inputPerMillion: 1, outputPerMillion: 5 },
  'claude-haiku-4-5-20251001': { inputPerMillion: 1, outputPerMillion: 5 },
  'claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
};

export function calculateCost(
  modelo: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING[modelo] ?? PRICING['claude-haiku-4-5'];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
