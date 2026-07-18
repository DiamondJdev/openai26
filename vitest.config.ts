import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `server-only` throws when imported outside React Server; stub it for Node tests.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // Default to the Node environment; component tests opt into jsdom per-file
    // via a `// @vitest-environment jsdom` pragma at the top of the file.
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    // Native modules (better-sqlite3) are not thread-safe across workers; run
    // integration suites in a single fork to avoid file-lock contention.
    pool: "forks",
  },
});
