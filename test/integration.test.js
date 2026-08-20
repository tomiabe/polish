import http from "node:http";
import { execFile } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

const execFileP = promisify(execFile);

const FINDINGS = {
  summary: "Two consistency and control problems found.",
  findings: [
    {
      id: "F1",
      severity: "serious",
      category: "H4",
      rule: "Consistency",
      title: "Duplicate identical buttons",
      message: "Two identical Refresh buttons with identical intent.",
      file: "test/fixtures/BrokenCard.jsx",
      line: 12,
      fix: "Keep a single Refresh button."
    },
    {
      id: "F2",
      severity: "critical",
      category: "H5",
      rule: "Error prevention",
      title: "Destructive action without confirmation",
      message: "Row click deletes a user with no confirmation.",
      file: "test/fixtures/BrokenCard.jsx",
      line: 8,
      fix: "Add a confirm step or undo."
    }
  ]
};

test("CLI end-to-end against mock OpenAI server", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const parsed = JSON.parse(body);
      assert.equal(parsed.model, "gpt-test");
      assert.equal(parsed.response_format.type, "json_object");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(FINDINGS) } }] }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const dir = path.join(import.meta.dirname, ".int-test");
  mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({ provider: "openai", model: "gpt-test", baseUrl: `http://127.0.0.1:${port}` })
  );

  const cwd = path.join(import.meta.dirname, "..");
  const env = { ...process.env, OPENAI_API_KEY: "test-key" };
  let stdout;
  try {
    const r = await execFileP(
      process.execPath,
      [path.join(cwd, "bin/polish.js"), "--config", configPath, "test/fixtures/*.jsx"],
      { cwd, env }
    );
    stdout = r.stdout;
  } catch (err) {
    stdout = err.stdout;
    assert.equal(err.code, 1, "critical findings exit non-zero");
  } finally {
    server.close();
  }

  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(clean, /Score: 59\/100/, "critical cap applies");
  assert.match(clean, /Critical: 1/, "critical counted");
  assert.match(clean, /Destructive action without confirmation/, "title shown");
});

test("CLI falls back from OpenAI to Gemini", async () => {
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.url === "/v1/chat/completions") {
        res.statusCode = 503;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "openai down" }));
        return;
      }

      assert.equal(req.url, "/v1beta/models/gemini-test:generateContent");
      assert.equal(req.headers["x-goog-api-key"], "gemini-key");

      const parsed = JSON.parse(body);
      assert.equal(parsed.generationConfig.responseMimeType, "application/json");
      assert.ok(parsed.systemInstruction?.parts?.[0]?.text.includes("senior UI/UX design reviewer"));

      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(FINDINGS) }]
              }
            }
          ]
        })
      );
    });
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;

  const dir = path.join(import.meta.dirname, ".int-test-gemini");
  mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      providers: ["openai", "gemini"],
      model: "gemini-test",
      baseUrl: `http://127.0.0.1:${port}`
    })
  );

  const cwd = path.join(import.meta.dirname, "..");
  const env = { ...process.env, OPENAI_API_KEY: "openai-key", GEMINI_API_KEY: "gemini-key" };
  let stdout;
  try {
    const r = await execFileP(
      process.execPath,
      [path.join(cwd, "bin/polish.js"), "--config", configPath, "test/fixtures/*.jsx"],
      { cwd, env }
    );
    stdout = r.stdout;
  } catch (err) {
    stdout = err.stdout;
    assert.equal(err.code, 1, "critical findings exit non-zero");
  } finally {
    server.close();
  }

  const clean = stdout.replace(/\x1b\[[0-9;]*m/g, "");
  assert.match(clean, /Score: 59\/100/, "fallback result scored");
  assert.match(clean, /Clickable div is not keyboard accessible|Destructive action without confirmation/, "gemini findings shown");
});
