// Fills the {{placeholders}} in sql/ exactly like scripts/wrapped.py's render().
export const YEAR = 2026;

const TZ_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

/** A real IANA zone, safe to put inside a SQL string literal. */
export function isValidTimeZone(tz: string): boolean {
  if (!TZ_RE.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function render(sql: string, p: { conversations: string; tz: string; year: number }): string {
  if (!TZ_RE.test(p.tz)) throw new Error(`invalid timezone: ${JSON.stringify(p.tz)}`);
  const literal = "'" + p.conversations.replace(/\\/g, "/").replace(/'/g, "''") + "'";
  return sql
    .replaceAll("{{conversations}}", literal)
    .replaceAll("{{tz}}", p.tz)
    .replaceAll("{{year}}", String(Math.trunc(p.year)));
}

export function detectTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : "UTC";
  } catch {
    return "UTC";
  }
}
