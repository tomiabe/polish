import { promises as fs } from "node:fs";
import path from "node:path";

const ALWAYS_SKIP = new Set(["node_modules", ".git"]);

function expandBraces(pattern) {
  const m = pattern.match(/^([^{]*)\{([^{}]+)\}(.*)$/);
  if (!m) return [pattern];
  const options = m[2].split(",");
  const out = [];
  for (const opt of options) out.push(...expandBraces(m[1] + opt + m[3]));
  return out;
}

function patternToRegex(pattern) {
  let re = "";
  let i = 0;
  while (i < pattern.length) {
    if (pattern[i] === "*" && pattern[i + 1] === "*") {
      re += pattern[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += pattern[i + 2] === "/" ? 3 : 2;
      continue;
    }
    const ch = pattern[i];
    if (ch === "*") re += "[^/]*";
    else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    i++;
  }
  return new RegExp("^" + re + "$");
}

async function walk(dir, root, out) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ALWAYS_SKIP.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs, root, out);
    } else if (entry.isFile()) {
      out.push(path.relative(root, abs));
    }
  }
}

export async function expandGlobs(patterns, rootDir) {
  const allFiles = [];
  await walk(rootDir, rootDir, allFiles);
  const matched = new Set();
  for (const pattern of patterns) {
    for (const expanded of expandBraces(pattern)) {
      const re = patternToRegex(expanded);
      for (const f of allFiles) {
        if (re.test(f)) matched.add(f);
      }
    }
  }
  return [...matched].map((f) => path.join(rootDir, f)).sort();
}

export const DEFAULT_CONFIG = {
  provider: null,
  providers: null,
  model: null,
  include: ["**/*.{tsx,jsx,vue,svelte,css,html}"],
  exclude: [],
  maxFiles: 20,
  maxFileBytes: 100_000,
  rubric: null,
  principles: null,
  visuals: null
};

export async function loadConfig(configPath) {
  let fileConfig = {};
  if (configPath) {
    fileConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  } else {
    try {
      const local = path.join(process.cwd(), ".polish.json");
      fileConfig = JSON.parse(await fs.readFile(local, "utf8"));
    } catch {
      /* no local config, use defaults */
    }
  }
  return { ...DEFAULT_CONFIG, ...fileConfig };
}
