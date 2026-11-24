import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      // Browser-only orchestration (Workers, DuckDB-WASM) is covered by the Playwright suite.
      exclude: ["lib/**/*.test.ts", "lib/engine/sql.generated.ts", "lib/engine/unzip.worker.ts"],
    },
  },
});
