// Card themes, taken from design/story-brand (default) and design/story-dark.
export type ThemeName = "brand" | "dark";

export interface CardTheme {
  name: ThemeName;
  label: string;
  bg: string;
  fg: string;
  accent: string; // hero numbers
  link: string; // "Get yours" line
  line: string; // tile borders, dividers
  muted: string; // clock labels
  soft: string; // secondary row text
  clock: { base: string; night: string; peak: string };
  club: { bg: string; fg: string; pillBorder: string };
  display: string; // CSS font-family
  mono: string;
}

export const THEMES: Record<ThemeName, CardTheme> = {
  brand: {
    name: "brand",
    label: "Outono Quente",
    bg: "#1C1A17",
    fg: "#E8DCC8",
    accent: "#D4882B",
    link: "#E07A57",
    line: "#3D3830",
    muted: "#9A8E78",
    soft: "#C8B08A",
    clock: { base: "#C4593A", night: "#5A3E28", peak: "#D4882B" },
    club: { bg: "#D4882B", fg: "#1C1A17", pillBorder: "rgba(28,26,23,0.3)" },
    display: "var(--font-syne), 'Syne', sans-serif",
    mono: "var(--font-dm-mono), 'DM Mono', monospace",
  },
  dark: {
    name: "dark",
    label: "Dark",
    bg: "#0E0F13",
    fg: "#F4F4F0",
    accent: "#C6F432",
    link: "#C6F432",
    line: "#3A3C35",
    muted: "#9A9C93",
    soft: "#C9CCBF",
    clock: { base: "#9DBF2A", night: "#5B6B2A", peak: "#C6F432" },
    club: { bg: "#C6F432", fg: "#0E0F13", pillBorder: "rgba(14,15,19,0.3)" },
    display: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif",
    mono: "var(--font-jetbrains), 'JetBrains Mono', monospace",
  },
};
