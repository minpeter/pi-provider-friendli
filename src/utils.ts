const coerceNumber = (value: unknown): number =>
  typeof value === "number" ? value : Number(String(value));

/**
 * FriendliAI reports pricing as per-token dollar strings; Pi wants
 * per-million rates. Rounded to 6 decimals to avoid binary-float noise.
 */
export const perMillionCost = (value: unknown, fallback: number): number => {
  const parsed = coerceNumber(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Number((parsed * 1_000_000).toFixed(6));
};

export const positiveInteger = (value: unknown, fallback: number): number => {
  const parsed = coerceNumber(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

/** "LGAI-EXAONE/K-EXAONE-236B-A23B" → "K-EXAONE 236B A23B". */
export const displayName = (id: string): string => {
  const base = id.split("/").pop() ?? id;
  return base.split("-").join(" ");
};
