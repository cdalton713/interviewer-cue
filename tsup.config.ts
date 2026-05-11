import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    app: "src/app.tsx",
    "cli/interviewer-cue": "src/cli/interviewer-cue.ts",
    "cli/decrypt": "src/cli/decrypt.ts",
    "cli/simulate-transcript": "src/cli/simulate-transcript.ts",
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
