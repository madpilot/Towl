import { evaluate, format } from 'mathjs';

/**
 * Merges two quantity strings (item descriptions) using mathjs evaluation.
 *
 * Strategy:
 *   1. Concatenate: `${existing} + ${incoming}`
 *   2. Try to evaluate via mathjs. On success, store the formatted result
 *      (e.g. "1 L + 250 mL" → "1.25 L").
 *   3. On failure (incompatible units, unparsable input), store the raw
 *      concatenated string (e.g. "1 kg + 500 mL" → "1 kg + 500 mL").
 *
 * If either side is empty, the other is returned unchanged (no merge needed).
 *
 * Note: mathjs throws synchronously on both parse errors and incompatible
 * units — always wrap evaluate() in try/catch.
 */
export function mergeQuantities(existing: string, incoming: string): string {
  if (!existing) {
    return incoming;
  }
  if (!incoming) {
    return existing;
  }

  const concatenated = `${existing} + ${incoming}`;

  try {
    const result = evaluate(concatenated);
    return format(result, { precision: 14 }).trim();
  } catch {
    return concatenated;
  }
}
