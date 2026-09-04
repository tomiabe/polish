import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { scoreFindings, summarize } from "../lib/scoring.js";
import { expandGlobs } from "../lib/config.js";
import { resolveProviderPlan } from "../lib/llm.js";
import { AGENT_INSTRUCTIONS, writeAgentInstructions } from "../lib/agent.js";
import { DEFAULT_RUBRIC_LAYERS, mergeRubrics } from "../lib/rubric.js";
import { buildReviewSystem, buildReviewUser } from "../lib/prompt.js";
import { prepareVisuals, renderVisualSummary } from "../lib/visuals.js";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("visual evidence prepares local screenshots with useful context", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "polish-visual-"));
  try {
    const screenshot = path.join(dir, "explore-mobile.png");
    await writeFile(screenshot, Buffer.from("visual evidence"));
    const visuals = await prepareVisuals([
      { path: screenshot, label: "Explore filters", viewport: "390x844" }
    ], dir);

    assert.equal(visuals.length, 1);
    assert.equal(visuals[0].mediaType, "image/png");
    assert.equal(visuals[0].viewport, "390x844");
    assert.match(renderVisualSummary(visuals), /Explore filters at 390x844/);

    const prompt = buildReviewUser([{ path: "src/explore.css", content: ".filter { gap: 8px; }" }], visuals);
    assert.match(prompt, /RENDERED SURFACES/);
    assert.match(prompt, /Rendered screenshots are attached/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("visual evidence limits unsupported or excessive images", async () => {
  await assert.rejects(
    () => prepareVisuals([{ path: "one.gif" }]),
    /Unsupported visual file type/
  );
  await assert.rejects(
    () => prepareVisuals(Array.from({ length: 4 }, () => ({ data: "a", mediaType: "image/png" }))),
    /at most 3 visuals/
  );
});

test("default craft rubric includes rendered visual QA", () => {
  const system = buildReviewSystem(mergeRubrics(DEFAULT_RUBRIC_LAYERS));
  assert.match(system, /\[C8\] Rendered visual QA/);
  assert.match(system, /Markers, dots, and handles/);
});

test("writing review treats AI-associated patterns as quality risks, not proof", () => {
  const system = buildReviewSystem(mergeRubrics(DEFAULT_RUBRIC_LAYERS));
  assert.match(system, /not proof of a text's origin/);
  assert.match(system, /product copy editor, not an AI detector/);
  assert.match(system, /not just X, but Y/);
});
