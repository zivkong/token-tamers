/**
 * Model resolution helpers.
 *
 * resolveHouse maps a raw model id to a House using the pack's ordered model
 * rules. matchesGlob is the simple wildcard matcher used by resolveHouse.
 */
import type { ModelRule } from '@token-tamers/core';

/** Simple glob match: only '*' wildcard supported (matches any sequence of chars). */
export function matchesGlob(input: string, pattern: string): boolean {
  // Escape regex special chars except '*', then replace '*' with '.*'
  const re = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
  );
  return re.test(input);
}

/**
 * Resolve a raw model id to a house using the pack's ordered model rules.
 * Returns 'wild' if no rule matches (dormant gene).
 */
export function resolveHouse(
  modelId: string,
  models: ModelRule[],
): 'aether' | 'cipher' | 'flux' | 'forge' | 'wild' {
  for (const rule of models) {
    if (matchesGlob(modelId, rule.pattern)) {
      return rule.house;
    }
  }
  return 'wild';
}
