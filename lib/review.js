import { mergeRubrics, DEFAULT_RUBRIC_LAYERS } from "./rubric.js";
import { buildReviewSystem, buildReviewUser, buildVerifySystem, buildVerifyUser } from "./prompt.js";
import { callLLM } from "./llm.js";
import { scoreFindings, summarize, SEVERITIES } from "./scoring.js";
import { prepareVisuals } from "./visuals.js";
import { createRateGate, describePlanError, planRequestBatches, resolveTokenBudget } from "./token-budget.js";
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

export function buildReceipt(mode, files, result, plan = null) {
  return {
    runId: randomUUID(),
    polishApplied: true,
    mode,
    score: result.score,
    filesReviewed: files.map((f) => f.path),
    fileCount: files.length,
    visualCount: result.visualCount ?? 0,
    batchCount: plan?.batches.length ?? 1,
    estimatedInputTokens: plan?.estimatedInputTokens ?? null,
    counts: result.counts,
    byCategory: result.byCategory
  };
}

function makePlan(cfg, files, visuals, system, makeUser) {
  const budget = resolveTokenBudget(cfg);
  return planRequestBatches({ files, system, visuals, makeUser, budget });
}

export function planReviewFiles(cfg, files, visuals = [], rubric = resolveRubric(cfg)) {
  const system = buildReviewSystem(rubric);
  return makePlan(
    cfg,
    files,
    visuals,
    system,
    (batchFiles) => buildReviewUser(batchFiles, visuals, cfg.context ?? "")
  );
}

function throwIfUnplannable(plan) {
  const error = describePlanError(plan);
  if (error) throw new Error(error);
}

async function runBatches(cfg, system, plan, visuals, makeUser) {
  const budget = plan.budget;
  const callConfig = cfg.maxTokens || !budget.outputTokensPerRequest
    ? cfg
    : { ...cfg, maxTokens: budget.outputTokensPerRequest };
  const waitForBudget = createRateGate(budget);
  const results = [];

  for (let i = 0; i < plan.batches.length; i++) {
    const batch = plan.batches[i];
    await waitForBudget(batch, async (waitMs) => {
      if (cfg.onRateLimitWait) {
        await cfg.onRateLimitWait({ waitMs, batchNumber: i + 1, batchCount: plan.batches.length });
      }
    });
    const user = makeUser(batch.files);
    results.push(await callLLM(callConfig, system, user, visuals));
  }
  return results;
}

function combinedAssessment(results) {
  return results
    .map((result) => result.summary)
    .filter(Boolean)
    .join("\n\n");
}

export async function reviewFiles(cfg, files) {
  const rubric = resolveRubric(cfg);
  const visuals = await prepareVisuals(cfg.visuals);
  const system = buildReviewSystem(rubric);
  const plan = planReviewFiles(cfg, files, visuals, rubric);
  throwIfUnplannable(plan);
  const results = await runBatches(
    cfg,
    system,
    plan,
    visuals,
    (batchFiles) => buildReviewUser(batchFiles, visuals, cfg.context ?? "")
  );
  const known = new Set([...rubric.principles.map((p) => p.id), rubric.accessibility.id]);
  const findings = results.flatMap((result) => validateFindings(result.findings ?? [], known));
  const summary = summarize(findings);
  const score = scoreFindings(findings);
  return {
    score,
    counts: summary.counts,
    byCategory: summary.byCategory,
    assessment: combinedAssessment(results),
    findings,
    visualsReviewed: visuals.map(({ path, label, viewport }) => ({ path, label, viewport })),
    receipt: buildReceipt("review", files, { score, counts: summary.counts, byCategory: summary.byCategory, visualCount: visuals.length }, plan)
  };
}

export async function verifyFiles(cfg, files, previous) {
  const rubric = resolveRubric(cfg);
  const visuals = await prepareVisuals(cfg.visuals);
  const system = buildVerifySystem(rubric);
  const plan = makePlan(
    cfg,
    files,
    visuals,
    system,
    (batchFiles) => {
      const filePaths = new Set(batchFiles.map((file) => file.path));
      const batchFindings = previous.filter((finding) => filePaths.has(finding.file));
      return buildVerifyUser(batchFiles, batchFindings, visuals, cfg.context ?? "");
    }
  );
  throwIfUnplannable(plan);
  const results = await runBatches(
    cfg,
    system,
    plan,
    visuals,
    (batchFiles) => {
      const filePaths = new Set(batchFiles.map((file) => file.path));
      const batchFindings = previous.filter((finding) => filePaths.has(finding.file));
      return buildVerifyUser(batchFiles, batchFindings, visuals, cfg.context ?? "");
    }
  );
  const findings = results.flatMap((result) => result.findings ?? []);
  const remaining = findings.filter((finding) => finding.status !== "fixed");
  const summary = summarize(remaining);
  const score = scoreFindings(remaining);
  return {
    score,
    counts: summary.counts,
    byCategory: summary.byCategory,
    findings,
    visualsReviewed: visuals.map(({ path, label, viewport }) => ({ path, label, viewport })),
    receipt: buildReceipt("verify", files, { score, counts: summary.counts, byCategory: summary.byCategory, visualCount: visuals.length }, plan)
  };
}
