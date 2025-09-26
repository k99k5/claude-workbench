import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple class values into a single string using clsx and tailwind-merge.
 * This utility function helps manage dynamic class names and prevents Tailwind CSS conflicts.
 *
 * @param inputs - Array of class values that can be strings, objects, arrays, etc.
 * @returns A merged string of class names with Tailwind conflicts resolved
 *
 * @example
 * cn("px-2 py-1", condition && "bg-blue-500", { "text-white": isActive })
 * // Returns: "px-2 py-1 bg-blue-500 text-white" (when condition and isActive are true)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Usage data interface that supports both API formats
 */
export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  // Standard format (frontend expectation)
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
  // API format (Claude API actual response)
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Standardizes usage data from Claude API to consistent frontend format.
 * Handles field name mapping from API format to frontend expectation.
 *
 * This function resolves the cache token field name inconsistency where:
 * - Claude API returns: cache_creation_input_tokens, cache_read_input_tokens
 * - Frontend expects: cache_creation_tokens, cache_read_tokens
 *
 * @param usage - Raw usage data from Claude API or frontend
 * @returns Standardized usage data with consistent field names
 *
 * @example
 * const apiUsage = {
 *   input_tokens: 100,
 *   output_tokens: 50,
 *   cache_creation_input_tokens: 20,
 *   cache_read_input_tokens: 10
 * };
 * const standardized = normalizeUsageData(apiUsage);
 * // Result: { input_tokens: 100, output_tokens: 50, cache_creation_tokens: 20, cache_read_tokens: 10 }
 */
export function normalizeUsageData(usage: any): UsageData {
  if (!usage) {
    return {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
    };
  }

  try {
    // Extract base tokens with safe conversion
    const input_tokens = Number(usage.input_tokens) || 0;
    const output_tokens = Number(usage.output_tokens) || 0;

    // Handle cache tokens with fallback logic
    // Priority: API format -> frontend format -> 0
    const cache_creation_tokens =
      Number(usage.cache_creation_input_tokens) ||
      Number(usage.cache_creation_tokens) || 0;

    const cache_read_tokens =
      Number(usage.cache_read_input_tokens) ||
      Number(usage.cache_read_tokens) || 0;

    return {
      input_tokens,
      output_tokens,
      cache_creation_tokens,
      cache_read_tokens,
    };
  } catch (error) {
    console.warn('[normalizeUsageData] Error processing usage data:', error, usage);
    return {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_tokens: 0,
      cache_read_tokens: 0,
    };
  }
}

/**
 * Calculates total tokens from normalized usage data
 * @param usage - Normalized usage data
 * @returns Total token count including cache tokens
 */
export function calculateTotalTokens(usage: UsageData): number {
  return usage.input_tokens + usage.output_tokens +
         (usage.cache_creation_tokens || 0) + (usage.cache_read_tokens || 0);
} 