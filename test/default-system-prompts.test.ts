import { describe, expect, it } from "vitest";

import { FULL_STACK_SYSTEM_PROMPT_DEFAULTS } from "../src/interview/default-system-prompts.js";

describe("default system prompts", () => {
  it("provides several complete full-stack software engineering defaults", () => {
    expect(FULL_STACK_SYSTEM_PROMPT_DEFAULTS.length).toBeGreaterThanOrEqual(5);

    for (const defaultPrompt of FULL_STACK_SYSTEM_PROMPT_DEFAULTS) {
      expect(defaultPrompt.name).toMatch(/Full Stack|Product|Frontend|Backend|Senior|Staff/);
      expect(defaultPrompt.systemPrompt.trim().length).toBeGreaterThan(500);
      expect(defaultPrompt.systemPrompt).toContain("Limit the interview to 15 questions total");
      expect(defaultPrompt.systemPrompt).toContain(
        "Organize questions in the order a strong conversation would naturally follow",
      );
      expect(defaultPrompt.qualities.length).toBeGreaterThanOrEqual(4);
      expect(defaultPrompt.questionTypes.length).toBeGreaterThanOrEqual(3);
    }
  });
});
