import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    app: "src/app.tsx",
    "cli/decrypt": "src/cli/decrypt.ts",
    "cli/watch": "src/cli/watch.ts",
  },
  clean: true,
  dts: true,
  format: ["esm"],
  platform: "node",
  shims: true,
  sourcemap: true,
  splitting: false,
  target: "node20",
});
