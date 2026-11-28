const DEBATE_TYPE_LABELS: Record<string, string> = {
  user_vs_bot: "User vs Bot",
  user_vs_user: "User vs User",
};

/**
 * Turns a stored debate type such as "user_vs_bot" into a readable label
 * ("User vs Bot"). Unknown types fall back to the value with every
 * underscore replaced by a space.
 */
export const formatDebateType = (debateType: string): string =>
  DEBATE_TYPE_LABELS[debateType] ?? debateType.replace(/_/g, " ");
