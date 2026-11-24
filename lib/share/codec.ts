// Share links carry the user-reviewed stats in the URL fragment (after "#"), which browsers never
// send to a server. Payload: {v, s: card stats, e: edits} → JSON → deflate → base64url.
// Decoding treats the link as hostile: size caps, streamed inflate with a hard limit, then the same
// tolerant schema and sanitiser the cards use. Unknown keys are dropped (allow-list).
import { deflateSync, Inflate, strFromU8, strToU8 } from "fflate";

import { sanitizeEdits, type StoryEdits } from "../story/edits";
import { type CardStats, CardStatsSchema, toCardStats } from "../story/schema";

export const MAX_TOKEN_CHARS = 8_000;
export const MAX_JSON_BYTES = 64_000;
const VERSION = 1;

export interface SharePayload {
  stats: CardStats;
  edits: StoryEdits;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): Uint8Array {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Inflate, refusing to produce more than MAX_JSON_BYTES (zip-bomb guard). */
function inflateCapped(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) throw new Error("share link too large");
    chunks.push(chunk);
  });
  inflater.push(data, true);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const EDIT_KEYS = ["display_name", "tag", "opener", "prediction", "chattiest_day_example", "theme"] as const;

export function encodeShare(stats: CardStats, edits: StoryEdits): string {
  // Re-parse so only schema keys (the allow-list) are ever encoded.
  const s = CardStatsSchema.parse(stats);
  const e = Object.fromEntries(EDIT_KEYS.map((k) => [k, edits[k]]));
  return toBase64Url(deflateSync(strToU8(JSON.stringify({ v: VERSION, s, e })), { level: 9 }));
}

export function decodeShare(token: string): SharePayload | null {
  if (!token || token.length > MAX_TOKEN_CHARS || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const raw: unknown = JSON.parse(strFromU8(inflateCapped(fromBase64Url(token))));
    if (!raw || typeof raw !== "object" || (raw as { v?: unknown }).v !== VERSION) return null;
    const stats = toCardStats((raw as { s?: unknown }).s);
    return { stats, edits: sanitizeEdits((raw as { e?: unknown }).e, stats) };
  } catch {
    return null;
  }
}

/** Accept a full share URL, "#token" or a bare token. Returns the token, or null. */
export function tokenFromInput(input: string): string | null {
  const text = input.trim();
  const hash = text.includes("#") ? text.slice(text.indexOf("#") + 1) : text;
  return /^[A-Za-z0-9_-]{20,}$/.test(hash) && hash.length <= MAX_TOKEN_CHARS ? hash : null;
}

/** Split "/vs#<a>.<b>". base64url never contains ".". */
export function splitPair(hash: string): [string, string] | null {
  const parts = hash.replace(/^#/, "").split(".");
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null;
}
