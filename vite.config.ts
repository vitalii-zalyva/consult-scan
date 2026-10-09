import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["test/**/*.dom.test.tsx", "jsdom"]],
    setupFiles: ["test/setup.ts"],
    // Keep real class names in tests so assertions can read them.
    css: { modules: { classNameStrategy: "non-scoped" } },
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
