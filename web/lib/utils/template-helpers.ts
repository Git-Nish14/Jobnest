/**
 * Replace {{variable}} tokens in text with values from a vars map.
 * Unresolved tokens are left as-is so callers can detect them.
 */
export function substituteVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] || _match);
}

/** Return every unique {{key}} found in text. */
export function extractVariableKeys(text: string): string[] {
  const keys = new Set<string>();
  for (const [, key] of text.matchAll(/\{\{(\w+)\}\}/g)) {
    keys.add(key);
  }
  return [...keys];
}
