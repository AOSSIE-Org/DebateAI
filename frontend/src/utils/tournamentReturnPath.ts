export function tournamentResultsReturnPath(value: unknown): string | null {
  return typeof value === "string" && /^\/tournament\/[a-f0-9]{24}\/results$/i.test(value) ? value : null;
}
