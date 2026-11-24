// The Wall's static files, built by scripts/wall.py (DuckDB) and bundled into the site at build time.
import distributionJson from "../../public/wall/distribution.json";
import wallJson from "../../public/wall/wall.json";
import type { Distribution } from "./rank";

export interface WallPerson {
  id: string;
  display_name: string;
  tag: string;
  club: string;
  languages: number;
  [metric: string]: string | number;
}

export interface WallData {
  version: number;
  year: number;
  generated: string;
  count: number;
  tags: { tag: string; members: number; chats: number }[];
  clubs: Record<string, number>;
  entries: WallPerson[];
}

export const WALL_DATA = wallJson as unknown as WallData;
export const DISTRIBUTION = distributionJson as unknown as Distribution;
export const EVERYONE = "everyone";
