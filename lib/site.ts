// One place for the public URL. The app is served at www.barrosbuilds.com/wrapped through a
// rewrite in the main site; next.config.ts uses BASE_PATH.
export const BASE_PATH = "/wrapped";
export const SITE_URL = "https://www.barrosbuilds.com/wrapped";
export const SITE_LINE = "barrosbuilds.com/wrapped"; // printed on every card
export const REPO_URL = "https://github.com/andrebarros6/ai-wrapped";
export const MAIN_SITE_URL = "https://www.barrosbuilds.com";

/** Prefix a public-folder path with the base path (next/link does this itself; fetch and Worker don't). */
export const withBase = (path: string): string => `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
