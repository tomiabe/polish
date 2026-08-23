import { mergeRubrics, DEFAULT_RUBRIC_LAYERS } from "./rubric.js";
import { buildReviewSystem, buildReviewUser, buildVerifySystem, buildVerifyUser } from "./prompt.js";
import { callLLM } from "./llm.js";
import { scoreFindings, summarize, SEVERITIES } from "./scoring.js";
import { randomUUID } from "node:crypto";

export function resolveRubric(cfg) {
  if (cfg.principles) {
    return { principles: cfg.principles, accessibility: mergeRubrics(DEFAULT_RUBRIC_LAYERS).accessibility };
  }
  return mergeRubrics(cfg.rubric ?? DEFAULT_RUBRIC_LAYERS);
}

export function validateFindings(findings, knownCategories) {
  return (findings ?? []).filter((f) => {
    if (!f || typeof f !== "object") return false;
    if (!SEVERITIES.includes(f.severity)) return false;
    if (!knownCategories.has(f.category)) return false;
    if (typeof f.title !== "string" || typeof f.file !== "string") return false;
    return true;
  });
}

export function buildReceipt(mode, files, result) {
  return {
    runId: randomUUID(),
    polishApplied: true,
    mode,
    score: result.score,
    filesReviewed: files.map((f) => f.path),
    fileCount: files.length,
    counts: result.counts,
    byCategory: result.byCategory
  };
}

export async function reviewFiles(cfg, files) {
  const rubric = resolveRubric(cfg);
  const system = buildReviewSystem(rubric);
  const user = buildReviewUser(files);
  const result = await callLLM(cfg, system, user);
  const known = new Set([...rubric.principles.map((p) => p.id), rubric.accessibility.id]);
  const findings = validateFindings(result.findings ?? [], known);
  const summary = summarize(findings);
  const score = scoreFindings(findings);
  return {
    score,
    counts: summary.counts,
    byCategory: summary.byCategory,
    assessment: result.summary ?? "",
    findings,
    receipt: buildReceipt("review", files, { score, counts: summary.counts, byCategory: summary.byCategory })
  };
}

export async function verifyFiles(cfg, files, previous) {
  const rubric = resolveRubric(cfg);
  const system = buildVerifySystem(rubric);
  const user = buildVerifyUser(files, previous);
  const result = await callLLM(cfg, system, user);
  const findings = result.findings ?? [];
  const remaining = findings.filter((finding) => finding.status !== "fixed");
  const summary = summarize(remaining);
  const score = scoreFindings(remaining);
  return {
    score,
    counts: summary.counts,
    byCategory: summary.byCategory,
    findings,
    receipt: buildReceipt("verify", files, { score, counts: summary.counts, byCategory: summary.byCategory })
  };
}
