// Plain constants with no dependencies, so light pages (like the upload page) don't pull in zod.
export const CLUBS = ["Researchers", "Builders", "Coders", "Night Shift", "Polyglots", "Talkers"] as const;
export type Club = (typeof CLUBS)[number];

/** Where the numbers came from. "lite-prompt" numbers are estimates and the cards say so. */
export const SOURCES = ["claude-export", "full-prompt", "cli", "lite-prompt"] as const;
export type Source = (typeof SOURCES)[number];
