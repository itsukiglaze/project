import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force the `server-only` marker package to resolve to its no-op
      // branch. Its default/"react-server"-less branch unconditionally
      // throws "This module cannot be imported from a Client Component" —
      // that's only meant to fire inside a real client bundle, not inside
      // a Node/jsdom test runner. Aliasing it directly (rather than
      // setting a global `resolve.conditions: ["react-server"]`) is
      // deliberate: forcing that condition globally also changes how
      // `react-dom/client` resolves and breaks React Testing Library.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
