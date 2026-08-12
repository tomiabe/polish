import { NIELSEN_RUBRIC } from "./rubric.js";
import { buildReviewSystem, buildReviewUser, buildVerifySystem, buildVerifyUser } from "./prompt.js";
import { callLLM } from "./llm.js";
import { scoreFindings, summarize, SEVERITIES } from "./scoring.js";

export function resolveRubric(cfg) {
  return cfg.principles
    ? { principles: cfg.principles, accessibility: NIELSEN_RUBRIC.accessibility }
    : NIELSEN_RUBRIC;
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

export async function reviewFiles(cfg, files) {
  const rubric = resolveRubric(cfg);
  const system = buildReviewSystem(rubric);
  const user = buildReviewUser(files);
  const result = await callLLM(cfg, system, user);
  const known = new Set([...rubric.principles.map((p) => p.id), rubric.accessibility.id]);
  const findings = validateFindings(result.findings ?? [], known);
  const summary = summarize(findings);
  return {
    score: scoreFindings(findings),
    counts: summary.counts,
    byCategory: summary.byCategory,
    assessment: result.summary ?? "",
    findings
  };
}

export async function verifyFiles(cfg, files, previous) {
  const rubric = resolveRubric(cfg);
  const system = buildVerifySystem(rubric);
  const user = buildVerifyUser(files, previous);
  const result = await callLLM(cfg, system, user);
  return result.findings ?? [];
}
