// polish before/after demo.
// Runs the full pipeline (glob → config → prompts → LLM call → scoring → verify)
// against a mock OpenAI-compatible server, so no API key is needed.
//
//   node scripts/demo.mjs
//
// To run the same review against a real model, set one of the API key env vars
// and run:
//   polish demo/ProfileCard.before.jsx
//   polish demo/ProfileCard.after.jsx

import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createDemoServer } from "./demo-server.mjs";

const execFileP = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const BIN = path.join(ROOT, "bin/polish.js");
const BEFORE = "demo/ProfileCard.before.jsx";
const AFTER = "demo/ProfileCard.after.jsx";

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

async function runPolish(args) {
  try {
    const r = await execFileP(process.execPath, [BIN, ...args], {
      cwd: ROOT,
      env: { ...process.env, OPENAI_API_KEY: "demo-key" }
    });
    return { stdout: r.stdout, code: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", code: err.code ?? 1 };
  }
}

const server = createDemoServer();
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const tmp = mkdtempSync(path.join(tmpdir(), "polish-demo-"));
const configPath = path.join(tmp, "config.json");
writeFileSync(configPath, JSON.stringify({ provider: "openai", model: "demo-model", baseUrl: `http://127.0.0.1:${port}` }));

const findingsPath = path.join(tmp, "findings.json");

console.log(`polish demo - mock LLM on http://127.0.0.1:${port} (no API key needed)\n`);

console.log(`── REVIEW BEFORE ── ${BEFORE}`);
const before = await runPolish(["--config", configPath, BEFORE]);
console.log(stripAnsi(before.stdout));

const beforeJson = await runPolish(["--config", configPath, "--json", BEFORE]);
const beforeData = JSON.parse(beforeJson.stdout);
// Point findings at the fixed file so verify re-checks them against the after code.
for (const f of beforeData.findings) f.file = AFTER;
writeFileSync(findingsPath, JSON.stringify({ findings: beforeData.findings }, null, 2));

console.log(`\n── REVIEW AFTER ── ${AFTER}`);
const after = await runPolish(["--config", configPath, AFTER]);
console.log(stripAnsi(after.stdout));

console.log(`\n── VERIFY ── before findings re-checked against after code`);
const verify = await runPolish(["--config", configPath, "--verify", findingsPath]);
console.log(stripAnsi(verify.stdout));

const score = (text) => Number(stripAnsi(text).match(/Score: (\d+)\/100/)?.[1] ?? "?");
const counts = (text) => {
  const m = stripAnsi(text).match(/Critical: (\d+)\s+Serious: (\d+)\s+Moderate: (\d+)/);
  return m ? `${m[1]} critical, ${m[2]} serious, ${m[3]} moderate` : "?";
};
const fixed = stripAnsi(verify.stdout).match(/(\d+)\/(\d+) findings fixed/);
const beforeScore = score(before.stdout);
const afterScore = score(after.stdout);

console.log(`\n════════ SUMMARY ════════`);
console.log(`before : ${beforeScore}/100  (${counts(before.stdout)})`);
console.log(`after  : ${afterScore}/100  (${counts(after.stdout)})`);
console.log(`verify : ${fixed ? `${fixed[1]}/${fixed[2]} findings fixed` : "?"}`);
console.log(`\nThe mock server stands in for a real LLM. With an API key set (GROQ_API_KEY, OPENAI_API_KEY, ...),\nthe same commands run against a live model: polish demo/ProfileCard.before.jsx`);

server.close();
rmSync(tmp, { recursive: true, force: true });
