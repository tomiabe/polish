import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { scoreFindings, summarize } from "../lib/scoring.js";
import { expandGlobs } from "../lib/config.js";
import { resolveProviderPlan } from "../lib/llm.js";
import { AGENT_INSTRUCTIONS, writeAgentInstructions } from "../lib/agent.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("score starts at 100 with no findings", () => {
  assert.equal(scoreFindings([]), 100);
});

test("critical findings use the Polish weighted deduction", () => {
  const s = scoreFindings([{ severity: "critical" }, { severity: "moderate" }]);
  assert.equal(s, 75);
});

test("critical findings do not create a score ceiling", () => {
  const s = scoreFindings([{ severity: "critical" }, { severity: "critical" }]);
  assert.equal(s, 56);
});

test("serious deducts 9, moderate 3", () => {
  const s = scoreFindings([{ severity: "serious" }, { severity: "moderate" }]);
  assert.equal(s, 88);
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

test("agent instructions are created without overwriting existing files", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "polish-agent-"));
  try {
    const target = await writeAgentInstructions(dir);
    assert.equal(await readFile(target, "utf8"), AGENT_INSTRUCTIONS);
    await assert.rejects(() => writeAgentInstructions(dir), /already exists/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
