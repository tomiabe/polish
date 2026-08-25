import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { expandGlobs, DEFAULT_CONFIG } from "./lib/config.js";
import { reviewFiles, resolveRubric } from "./lib/review.js";

const PORT = process.env.PORT && process.env.PORT !== "0" ? Number(process.env.PORT) : 3939;
const DOCS = path.resolve("docs");
const TMP = path.resolve(".preview-cache");
const MAX_FILES = 5;
const MAX_FILE_BYTES = 50_000;
const MAX_BODY_BYTES = 4_096;

// ── rate limits ──
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000; // 1 hour
const RATE_LIMIT_MAX = 3; // per IP per hour
const DAILY_GLOBAL_CAP = 50; // total reviews per day
const MAX_CONCURRENT = 2; // simultaneous reviews
const LLM_MAX_TOKENS = 3_000; // output token cap per review
const rateLimits = new Map(); // IP → { startedAt, count }
let dailyCount = 0;
let concurrentReviews = 0;

function dailyCountReset() {
  const now = new Date();
  const msUntilMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)) - now;
  setTimeout(() => { dailyCount = 0; dailyCountReset(); }, msUntilMidnight + 1_000);
}
dailyCountReset();

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://polish.tomiabe.com",
  "https://www.polish.tomiabe.com",
  "https://tomiabe.github.io",
  "http://polish.tomiabe.com",
  "http://www.polish.tomiabe.com",
  "http://localhost:3939",
  "http://localhost:3000"
]);

// ── helpers ──

function parseGitHubUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.hostname.toLowerCase() !== "github.com") return null;
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
}

function shallowClone(owner, repo, dest) {
  const url = `https://github.com/${owner}/${repo}.git`;
  const result = spawnSync("git", ["clone", "--depth", "1", "--single-branch", "--no-tags", url, dest], {
    timeout: 30_000,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || "clone failed";
    throw new Error(`GitHub clone failed: ${detail}`);
  }
}

function getAllowedOrigins() {
  const configured = process.env.PREVIEW_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set(configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const headers = { "vary": "Origin" };
  if (origin && getAllowedOrigins().has(origin)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function getClientKey(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(req) {
  const now = Date.now();
  // Clean up expired per-IP entries
  for (const [key, entry] of rateLimits) {
    if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(key);
  }
  const key = getClientKey(req);
  const entry = rateLimits.get(key);
  if (!entry || now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(key, { startedAt: now, count: 1 });
  } else {
    entry.count += 1;
  }
  // Check limits in priority order
  const ipCount = rateLimits.get(key)?.count || 0;
  if (ipCount > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - rateLimits.get(key).startedAt)) / 60_000);
    return { allowed: false, reason: `Rate limit: ${RATE_LIMIT_MAX} reviews per hour. Try again in ${retryAfter} min.` };
  }
  if (dailyCount >= DAILY_GLOBAL_CAP) {
    return { allowed: false, reason: "Daily review limit reached. Try again tomorrow." };
  }
  if (concurrentReviews >= MAX_CONCURRENT) {
    return { allowed: false, reason: "Too many reviews running. Try again in a moment." };
  }
  return { allowed: true };
}

async function readFiles(paths) {
  const out = [];
  for (const p of paths) {
    try {
      const content = await fs.readFile(p, "utf8");
      if (content.length > MAX_FILE_BYTES) continue;
      out.push({ path: p, content });
    } catch {
      // skip unreadable files
    }
  }
  return out;
}

function jsonReply(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    ...corsHeaders(res.req)
  });
  res.end(body);
}

// ── API handler ──

async function handlePreview(req, res) {
  res.req = req;
  // CORS preflight
  if (req.method === "OPTIONS") {
    const origin = req.headers.origin;
    if (origin && !getAllowedOrigins().has(origin)) {
      res.writeHead(403, corsHeaders(req));
      return res.end();
    }
    res.writeHead(204, {
      ...corsHeaders(req),
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    return res.end();
  }

  if (req.method !== "POST") {
    return jsonReply(res, 405, { error: "Method not allowed" });
  }

  const rateCheck = checkRateLimit(req);
  if (!rateCheck.allowed) {
    return jsonReply(res, 429, { error: rateCheck.reason });
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      return jsonReply(res, 413, { error: "Request is too large." });
    }
  }

  let url;
  try {
    ({ url } = JSON.parse(body));
  } catch {
    return jsonReply(res, 400, { error: "Invalid JSON body" });
  }

  if (!url || typeof url !== "string") {
    return jsonReply(res, 400, { error: "Missing url field" });
  }

  const repo = parseGitHubUrl(url);
  if (!repo) {
    return jsonReply(res, 400, { error: "Enter a valid GitHub repository URL (e.g. https://github.com/user/repo)." });
  }

  const repoKey = `${repo.owner}/${repo.repo}`;
  const dest = path.join(TMP, `${repo.owner}__${repo.repo}__${Date.now()}`);

  concurrentReviews++;
  dailyCount++;

  try {
    // 1. Clone
    await fs.mkdir(TMP, { recursive: true });
    shallowClone(repo.owner, repo.repo, dest);

    // 2. Find UI files — skip generated/build output directories
    const EXCLUDE_DIRS = [
      ".git", ".cache", ".next", ".nuxt", ".vercel", "build", "coverage", "dist",
      "node_modules", "out", "public/admin", "storybook-static", "vendor"
    ];
    const globs = DEFAULT_CONFIG.include;
    const allPaths = (await expandGlobs(globs, dest)).filter((p) => {
      const rel = path.relative(dest, p);
      return !EXCLUDE_DIRS.some((d) => rel.startsWith(d + "/") || rel.includes("/" + d + "/"));
    });

    if (allPaths.length === 0) {
      return jsonReply(res, 200, {
        repo: repoKey,
        score: null,
        verdict: "No UI files found in this repository.",
        fileCount: 0,
        findings: []
      });
    }

    // 3. Pick up to MAX_FILES — representative spread, not just the smallest
    const sized = await Promise.all(
      allPaths.map(async (p) => ({
        path: p,
        size: (await fs.stat(p)).size
      }))
    );
    // Skip trivially small files (< 200 bytes or ~5 lines) — they rarely
    // contain meaningful UI findings and skew the score artificially high.
    const meaningful = sized.filter((s) => s.size >= 200);
    // If everything is tiny, fall back to the original set so we still
    // review *something* rather than returning an empty result.
    const pool = meaningful.length >= MAX_FILES ? meaningful : sized;
    pool.sort((a, b) => a.size - b.size);
    // Stratified pick: spread evenly across the size range so small,
    // medium, and large files are all represented.
    const picked = [];
    if (pool.length <= MAX_FILES) {
      picked.push(...pool.map((s) => s.path));
    } else {
      const step = (pool.length - 1) / (MAX_FILES - 1);
      for (let i = 0; i < MAX_FILES; i++) {
        picked.push(pool[Math.round(i * step)].path);
      }
    }

    // 4. Read content
    const files = await readFiles(picked);

    // 5. Run review — cap output tokens to control costs
    const cfg = { ...DEFAULT_CONFIG, maxTokens: LLM_MAX_TOKENS };
    const rubric = resolveRubric(cfg);
    const result = await reviewFiles(cfg, files);

    // 6. Map results — strip temp dir prefix from file paths
    const findings = result.findings.map((f) => ({
      severity: f.severity,
      category: f.category,
      title: f.title,
      message: f.message || f.title,
      file: f.file.replace(dest + "/", ""),
      line: f.line,
      fix: f.fix
    }));

    let verdict;
    if (result.score >= 80) verdict = "Looks solid. A few things to tighten up.";
    else if (result.score >= 60) verdict = "Decent shape. Some findings worth addressing.";
    else verdict = "Several issues found. Consider running the full review.";

    const receipt = {
      ...result.receipt,
      filesReviewed: files.map((file) => file.path.replace(dest + "/", "")),
      candidateFileCount: allPaths.length,
      selection: "representative source-file sample"
    };

    return jsonReply(res, 200, {
      repo: repoKey,
      score: result.score,
      verdict,
      fileCount: files.length,
      candidateFileCount: allPaths.length,
      findings,
      receipt
    });
  } catch (err) {
    console.error("Preview error:", err.message);
    const isRepoError = err.message.startsWith("GitHub clone failed:") &&
      (err.message.includes("not found") || err.message.includes("does not exist"));
    const msg = isRepoError
      ? "Repository not found. Check the URL and try again."
      : err.message.includes("Could not resolve")
        ? "Could not reach GitHub. Check your network and try again."
        : err.message.startsWith("LLM API error")
          ? "The review provider could not complete the review. Check the configured API key and model."
        : "Something went wrong. Please try again.";
    return jsonReply(res, 500, { error: msg });
  } finally {
    concurrentReviews = Math.max(0, concurrentReviews - 1);
    // Cleanup
    fs.rm(dest, { recursive: true, force: true }).catch(() => {});
  }
}

// ── static file server ──

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function serveStatic(req, res) {
  let filePath = path.join(DOCS, req.url === "/" ? "/index.html" : req.url);

  // Directory → index.html
  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
  } catch {
    // fall through
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": "public, max-age=300"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}

// ── router ──

const server = createServer(async (req, res) => {
  try {
    if (req.url === "/api/preview") {
      return await handlePreview(req, res);
    }
    await serveStatic(req, res);
  } catch (err) {
    console.error("Unhandled error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

server.listen(PORT, () => {
  const keys = ["GROQ_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"];
  const hasKey = keys.some((k) => process.env[k]);
  console.log(`\n  polish preview server running at http://localhost:${PORT}/preview.html`);
  if (!hasKey) {
    console.log("  ⚠  No LLM API key found. Set one of: " + keys.join(", "));
  }
  console.log();
});
