#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { expandGlobs, loadConfig } from "../lib/config.js";
import { reviewFiles, verifyFiles, resolveRubric } from "../lib/review.js";
import { buildReviewSystem, buildReviewUser } from "../lib/prompt.js";
import { writeAgentInstructions } from "../lib/agent.js";
import { prepareVisuals } from "../lib/visuals.js";

const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const SEV_COLOR = { critical: RED, serious: YELLOW, moderate: CYAN };

function usage() {
  return `polish - design/usability audit for UI code (layered rubric)

Usage:
  polish [files...]                  Review files (or config globs)
  polish --verify <findings.json>    Re-check previously reported findings
  polish init-agent                  Write AGENTS.md with the Polish review loop
  polish --dry-run [files...]        Print what would be sent, no API call

Options:
  --config <path>   Config file (default: ./.polish.json)
  --json            Output machine-readable receipt JSON for review or verify
  --force           Allow init-agent to replace an existing AGENTS.md
  --screenshot <path>  Attach a PNG, JPEG, or WebP screenshot. Repeat up to 3 times.
  --max-files <n>   Cap number of files (default 20)
  --max-file-bytes <n>  Truncate files larger than n bytes (default 100000)
  --help            Show this help

Config (.polish.json):
  provider: "openai" | "anthropic" | "openrouter" | "groq" | "gemini"   (auto-detected from keys)
  providers: ordered fallback list, like ["gemini", "groq"]
  model:    "model-name"                            (provider default if omitted)
  include:  glob patterns for files                 (default: **/*.{tsx,jsx,vue,svelte,css,html})
  exclude:  glob patterns to skip
  visuals:  screenshots with optional label and viewport metadata
  rubric:   layers to use: usability|craft|accessibility (default: all)
  principles: custom rubric (see README)

API keys via env: OPENAI_API_KEY | ANTHROPIC_API_KEY | OPENROUTER_API_KEY | GROQ_API_KEY | GEMINI_API_KEY`;
}

function parseArgs(argv) {
  const opts = { files: [], config: null, json: false, dryRun: false, verify: null, initAgent: false, force: false, screenshots: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { opts.help = true; continue; }
    if (a === "--json") { opts.json = true; continue; }
    if (a === "--dry-run") { opts.dryRun = true; continue; }
    if (a === "--config") { opts.config = argv[++i]; continue; }
    if (a === "--verify") { opts.verify = argv[++i]; continue; }
    if (a === "--force") { opts.force = true; continue; }
    if (a === "--screenshot") {
      const screenshot = argv[++i];
      if (!screenshot) throw new Error("--screenshot needs an image path.");
      opts.screenshots.push(screenshot);
      continue;
    }
    if (a === "--max-files") { opts.maxFiles = Number(argv[++i]); continue; }
    if (a === "--max-file-bytes") { opts.maxFileBytes = Number(argv[++i]); continue; }
    if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
    opts.files.push(a);
  }
  if (opts.files[0] === "init-agent") {
    opts.initAgent = true;
    opts.files.shift();
  }
  return opts;
}

function estimateTokens(text) {
  return Math.round(text.length / 4);
}

async function readFiles(cfg, requested) {
  const patterns = requested.length > 0 ? requested : cfg.include;
  const matched = await expandGlobs(patterns, process.cwd());
  const excluded = await expandGlobs(cfg.exclude, process.cwd());
  const excludeSet = new Set(excluded.map((p) => path.resolve(p)));
  const files = [];
  for (const p of matched) {
    if (excludeSet.has(path.resolve(p))) continue;
    const stat = await fs.stat(p);
    if (stat.size > (cfg.maxFileBytes ?? 100_000)) continue;
    const content = await fs.readFile(p, "utf8");
    files.push({ path: path.relative(process.cwd(), p), content });
    if (files.length >= (cfg.maxFiles ?? 20)) break;
  }
  return files;
}

function printScore(score, summary) {
  const color = score >= 80 ? GREEN : score >= 60 ? YELLOW : RED;
  console.log(`\n${BOLD}Score: ${color}${score}/100${RESET}`);
  console.log(
    `${DIM}Critical: ${RED}${summary.counts.critical}${RESET}${DIM}   Serious: ${YELLOW}${summary.counts.serious}${RESET}${DIM}   Moderate: ${CYAN}${summary.counts.moderate}${RESET}`
  );
  for (const [cat, n] of Object.entries(summary.byCategory)) {
    console.log(`${DIM}  ${cat}: ${n} finding${n === 1 ? "" : "s"}${RESET}`);
  }
}

function printReceipt(receipt) {
  console.log(`\n${GREEN}Polish applied:${RESET} yes`);
  console.log(`${DIM}Run: ${receipt.runId}${RESET}`);
  console.log(`${DIM}Mode: ${receipt.mode}   Files: ${receipt.fileCount}${RESET}`);
  if (receipt.visualCount > 0) console.log(`${DIM}Rendered screenshots: ${receipt.visualCount}${RESET}`);
}

function printFindings(findings) {
  for (const f of findings) {
    const color = SEV_COLOR[f.severity];
    console.log(`\n${BOLD}${color}${f.severity.toUpperCase()}${RESET} ${BOLD}[${f.category}]${RESET} ${f.title}`);
    console.log(`  ${CYAN}${f.file}:${f.line ?? "?"}${RESET}`);
    if (f.message) console.log(`  ${DIM}${f.message}${RESET}`);
    if (f.fix) console.log(`  ${GREEN}Fix:${RESET} ${f.fix}`);
  }
}

async function runReview(cfg, opts, rubric) {
  const files = await readFiles(cfg, opts.files);
  if (files.length === 0) {
    console.error("No files matched. Pass files as arguments or set include globs in .polish.json.");
    process.exit(1);
  }

  const system = buildReviewSystem(rubric);
  const visuals = await prepareVisuals(cfg.visuals, process.cwd());
  const user = buildReviewUser(files, visuals);
  const tokens = estimateTokens(system) + estimateTokens(user);
  const list = files.map((f) => `  ${f.path} (${(f.content.length / 1024).toFixed(1)} KB)`).join("\n");

  if (opts.json) {
    const result = await reviewFiles(cfg, files);
    console.log(JSON.stringify({
      score: result.score,
      summary: result.assessment,
      findings: result.findings,
      visualsReviewed: result.visualsReviewed,
      receipt: result.receipt
    }, null, 2));
    return;
  }

  const visualNote = visuals.length > 0 ? ` + ${visuals.length} screenshot${visuals.length === 1 ? "" : "s"}` : "";
  console.log(`${BOLD}polish${RESET} ${DIM}~${tokens.toLocaleString()} estimated source tokens${visualNote}${RESET}`);
  console.log(list);

  if (opts.dryRun) {
    console.log(`\n${DIM}Dry run, prompt built, no API call.${RESET}`);
    return;
  }

  const result = await reviewFiles(cfg, files);

  printReceipt(result.receipt);
  printScore(result.score, result);
  if (result.assessment) console.log(`\n${DIM}${result.assessment}${RESET}`);
  if (result.findings.length) printFindings(result.findings);
  else console.log(`\n${GREEN}No issues found.${RESET}`);

  process.exitCode = result.findings.some((f) => f.severity === "critical") ? 1 : 0;
}

async function runVerify(cfg, findingsPath, json = false) {
  const previous = JSON.parse(await fs.readFile(findingsPath, "utf8"));
  const items = previous.findings ?? previous;
  if (!Array.isArray(items) || items.length === 0) {
    console.error("No findings to verify in " + findingsPath);
    process.exit(1);
  }
  const files = [];
  for (const f of items) {
    const abs = path.resolve(f.file);
    try {
      const content = await fs.readFile(abs, "utf8");
      files.push({ path: f.file, content });
    } catch {
      /* file missing, leave out */
    }
  }
  const verified = await verifyFiles(cfg, files, items);

  if (json) {
    console.log(JSON.stringify(verified, null, 2));
    return;
  }

  printReceipt(verified.receipt);
  printScore(verified.score, verified);

  for (const [i, v] of verified.findings.entries()) {
    const id = v.id ?? `#${i + 1}`;
    const color = v.status === "fixed" ? GREEN : RED;
    console.log(`${color}${v.status === "fixed" ? "FIXED" : "STILL PRESENT"}${RESET} ${BOLD}${id}${RESET} ${v.title} (${v.file}:${v.line ?? "?"})`);
  }
  const fixed = verified.findings.filter((v) => v.status === "fixed").length;
  console.log(`\n${BOLD}${fixed}/${verified.findings.length}${RESET} findings fixed.`);
  process.exitCode = verified.findings.length - fixed > 0 ? 1 : 0;
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(usage());
      return;
    }
    if (opts.initAgent) {
      const target = await writeAgentInstructions(process.cwd(), opts.force);
      console.log(`Created ${path.relative(process.cwd(), target)}`);
      return;
    }
    const cfg = await loadConfig(opts.config);
    if (opts.maxFiles) cfg.maxFiles = opts.maxFiles;
    if (opts.maxFileBytes) cfg.maxFileBytes = opts.maxFileBytes;
    if (opts.screenshots.length > 0) {
      cfg.visuals = [...(cfg.visuals ?? []), ...opts.screenshots.map((file) => ({ path: file }))];
    }

    if (opts.verify) {
      await runVerify(cfg, opts.verify, opts.json);
      return;
    }
    await runReview(cfg, opts, resolveRubric(cfg));
  } catch (err) {
    console.error(`${RED}error:${RESET} ${err.message}`);
    process.exit(1);
  }
}

main();
