import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { expandGlobs, DEFAULT_CONFIG } from "./lib/config.js";
import { reviewFiles, resolveRubric } from "./lib/review.js";

const PORT = process.env.PORT && process.env.PORT !== "0" ? Number(process.env.PORT) : 3939;
const DOCS = path.resolve("docs");
const TMP = path.resolve(".preview-cache");
const MAX_FILES = 5;
const MAX_FILE_BYTES = 50_000;
const ALLOWED_EXTENSIONS = new Set([".tsx", ".jsx", ".vue", ".svelte", ".css", ".html"]);

// ── helpers ──

function parseGitHubUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

function shallowClone(owner, repo, dest) {
  const url = `https://github.com/${owner}/${repo}.git`;
  try {
    execSync(`git clone --depth 1 --single-branch --no-tags "${url}" "${dest}"`, {
      timeout: 30_000,
      stdio: "pipe"
    });
  } catch (err) {
    const detail = err.stderr?.toString().trim() || err.message;
    throw new Error(`GitHub clone failed: ${detail}`);
  }
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
    "access-control-allow-origin": "*"
  });
  res.end(body);
}

// ── API handler ──

async function handlePreview(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    return res.end();
  }

  if (req.method !== "POST") {
    return jsonReply(res, 405, { error: "Method not allowed" });
  }

  let body = "";
  for await (const chunk of req) body += chunk;

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

  try {
    // 1. Clone
    await fs.mkdir(TMP, { recursive: true });
    shallowClone(repo.owner, repo.repo, dest);

    // 2. Find UI files
    const globs = DEFAULT_CONFIG.include;
    const allPaths = await expandGlobs(globs, dest);

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

    // 5. Run review
    const cfg = { ...DEFAULT_CONFIG };
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

    return jsonReply(res, 200, {
      repo: repoKey,
      score: result.score,
      verdict,
      fileCount: files.length,
      findings,
      receipt: result.receipt
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
