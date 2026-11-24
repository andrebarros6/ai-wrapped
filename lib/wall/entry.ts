// Builds a Wall entry exactly as scripts/wall.py validates it, and the GitHub link that lets the
// person open the pull request themselves. Fields come from wall/fields.json (shared with Python).
import fields from "../../wall/fields.json";
import { REPO_URL } from "../site";
import { cleanTag } from "../story/edits";
import { languagesUsed } from "../story/derive";
import type { CardStats } from "../story/schema";

export const WALL_FIELDS = fields;
export type WallCountKey = keyof typeof fields.counts;
export type WallShareKey = keyof typeof fields.shares;

export interface WallEntry {
  version: 1;
  year: number;
  display_name: string;
  tag: string;
  source: CardStats["source"];
  stats: Record<WallCountKey, number> & Record<WallShareKey, number> & { club: string; languages: number };
}

/** Same rule as NAME_RE in scripts/wall.py: letters, numbers, spaces, . ' ’ - (1-32). */
export const NAME_RE = /^[\p{L}\p{N}_ .'’-]{1,32}$/u;

export const isEligible = (s: CardStats): boolean => fields.sources.includes(s.source);

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 32);
}

export function buildEntry(s: CardStats, displayName: string, tag: string): WallEntry {
  const counts = Object.fromEntries(
    Object.keys(fields.counts).map((k) => [k, Math.max(0, Math.round(s[k as keyof CardStats] as number))]),
  ) as Record<WallCountKey, number>;
  const shares = Object.fromEntries(
    Object.keys(fields.shares).map((k) => [k, s[k as keyof CardStats] as number]),
  ) as Record<WallShareKey, number>;
  return {
    version: 1,
    year: fields.year,
    display_name: cleanName(displayName),
    tag: cleanTag(tag),
    source: s.source,
    stats: { ...counts, ...shares, club: s.club, languages: languagesUsed(s) },
  };
}

export const randomSuffix = (): string =>
  Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

/** "José O'Neill" → "jose-o-neill-3fa91c": readable, unique enough to avoid PR clashes. */
export function entryFileName(displayName: string, suffix: string = randomSuffix()): string {
  const slug =
    displayName
      .normalize("NFKD")
      .replace(/\p{M}/gu, "") // strip accents (combining marks)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "anon";
  return `${slug}-${suffix.replace(/[^a-f0-9]/g, "").slice(0, 6) || "000000"}.json`;
}

/** GitHub's "new file" page, prefilled. GitHub forks the repo and opens the PR for the person. */
export function githubNewFileUrl(entry: WallEntry, fileName: string): string {
  const params = new URLSearchParams({
    filename: `wall/entries/${fileName}`,
    value: JSON.stringify(entry, null, 2) + "\n",
  });
  return `${REPO_URL}/new/main?${params.toString()}`;
}
