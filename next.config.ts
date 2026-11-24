import type { NextConfig } from "next";

import { BASE_PATH } from "./lib/site";

// Fully static: no server, no API routes. Served at www.barrosbuilds.com/wrapped via a rewrite
// in the main site. (Static exports can't use rewrites/headers/redirects, cacheComponents or
// default image optimisation — none are needed here.)
const nextConfig: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
