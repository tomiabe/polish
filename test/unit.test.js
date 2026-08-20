import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { scoreFindings, summarize } from "../lib/scoring.js";
import { expandGlobs } from "../lib/config.js";
import { resolveProviderPlan } from "../lib/llm.js";

test("score starts at 100 with no findings", () => {
  assert.equal(scoreFindings([]), 100);
});

test("critical caps at 59 with a single critical", () => {
  const s = scoreFindings([{ severity: "critical" }, { severity: "moderate" }]);
  assert.equal(s, 59);
});

test("two criticals cap at 49", () => {
  const s = scoreFindings([{ severity: "critical" }, { severity: "critical" }]);
  assert.equal(s, 49);
});

test("serious deducts 10, moderate 4", () => {
  const s = scoreFindings([{ severity: "serious" }, { severity: "moderate" }]);
  assert.equal(s, 86);
});

test("score never goes below 0", () => {
  const s = scoreFindings(Array.from({ length: 10 }, () => ({ severity: "critical" })));
  assert.equal(s, 0);
});

test("summarize counts severities and categories", () => {
  const s = summarize([
    { severity: "critical", category: "H1" },
    { severity: "serious", category: "H4" },
    { severity: "serious", category: "H4" }
  ]);
  assert.deepEqual(s.counts, { critical: 1, serious: 2, moderate: 0 });
  assert.deepEqual(s.byCategory, { H1: 1, H4: 2 });
});

test("glob matches braces and **", async () => {
  const root = fileURLToPath(new URL("./fixtures", import.meta.url));
  const files = await expandGlobs(["**/*.{jsx,tsx}"], root);
  assert.ok(files.some((f) => f.endsWith("BrokenCard.jsx")), "found jsx fixture");
  const css = await expandGlobs(["**/*.css"], root);
  assert.equal(css.length, 0);
});

test("provider plan respects explicit lists and env fallback", () => {
  const original = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY
  };

  try {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env.GROQ_API_KEY = "groq";
    process.env.GEMINI_API_KEY = "gemini";

    assert.deepEqual(resolveProviderPlan({ providers: ["gemini", "groq"] }), ["gemini", "groq"]);
    assert.deepEqual(resolveProviderPlan({}), ["groq", "gemini"]);
    assert.deepEqual(resolveProviderPlan({ provider: "openai" }), ["openai"]);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
