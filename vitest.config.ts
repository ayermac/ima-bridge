import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "out", "release", "dist"],
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@runtime": path.resolve(__dirname, "src/runtime"),
      "@renderer": path.resolve(__dirname, "src/renderer/src"),
    },
  },
});
