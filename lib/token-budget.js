import { resolveProviderPlan } from "./llm.js";

const DEFAULT_IMAGE_TOKENS_PER_SCREENSHOT = 2048;
const TOKEN_ESTIMATE_CHARS_PER_TOKEN = 4;
const RATE_WINDOW_MS = 60_000;

export function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / TOKEN_ESTIMATE_CHARS_PER_TOKEN);
}

export function resolveTokenBudget(config = {}) {
  const provider = config.provider
    ?? config.providers?.[0]
    ?? resolveProviderPlan(config)[0]
    ?? null;
  const providerBudget = provider ? config.tokenBudgets?.[provider] ?? {} : {};
  const outputTokensPerRequest = config.maxTokens
    ?? providerBudget.outputTokensPerRequest
    ?? config.outputTokensPerRequest
    ?? providerBudget.outputTokensPerMinute
    ?? config.outputTokensPerMinute
    ?? null;

  return {
    provider,
    inputTokensPerRequest: config.maxInputTokens
      ?? providerBudget.inputTokensPerRequest
      ?? null,
    inputTokensPerMinute: providerBudget.inputTokensPerMinute ?? config.inputTokensPerMinute ?? null,
    outputTokensPerRequest,
    outputTokensPerMinute: providerBudget.outputTokensPerMinute ?? config.outputTokensPerMinute ?? null,
    imageTokensPerScreenshot: providerBudget.imageTokensPerScreenshot
      ?? config.imageTokensPerScreenshot
      ?? DEFAULT_IMAGE_TOKENS_PER_SCREENSHOT
  };
}

function estimateBatch(files, system, visuals, makeUser, imageTokensPerScreenshot) {
  const textTokens = estimateTokens(system) + estimateTokens(makeUser(files));
  const imageTokens = visuals.length * imageTokensPerScreenshot;
  return { files, textTokens, imageTokens, inputTokens: textTokens + imageTokens };
}

export function planRequestBatches({
  files,
  system,
  visuals = [],
  makeUser,
  budget
}) {
  const maxInputTokens = [budget.inputTokensPerRequest, budget.inputTokensPerMinute]
    .filter((limit) => Number.isFinite(limit) && limit > 0)
    .reduce((min, limit) => Math.min(min, limit), Infinity);
  const singleRequest = estimateBatch(
    files,
    system,
    visuals,
    makeUser,
    budget.imageTokensPerScreenshot
  );

  if (!Number.isFinite(maxInputTokens)) {
    return {
      batches: [singleRequest],
      oversizedFiles: [],
      estimatedInputTokens: singleRequest.inputTokens,
      estimatedInputTokensAtOnce: singleRequest.inputTokens,
      budget
    };
  }

  const batches = [];
  const oversizedFiles = [];
  let currentFiles = [];

  for (const file of files) {
    const singleFileBatch = estimateBatch(
      [file],
      system,
      visuals,
      makeUser,
      budget.imageTokensPerScreenshot
    );
    if (singleFileBatch.inputTokens > maxInputTokens) {
      oversizedFiles.push({
        path: file.path,
        estimatedInputTokens: singleFileBatch.inputTokens,
        budget: maxInputTokens
      });
      continue;
    }

    const candidateFiles = [...currentFiles, file];
    const candidate = estimateBatch(
      candidateFiles,
      system,
      visuals,
      makeUser,
      budget.imageTokensPerScreenshot
    );
    if (candidate.inputTokens <= maxInputTokens) {
      currentFiles = candidateFiles;
      continue;
    }

    if (currentFiles.length > 0) {
      batches.push(estimateBatch(
        currentFiles,
        system,
        visuals,
        makeUser,
        budget.imageTokensPerScreenshot
      ));
    }
    currentFiles = [file];
  }

  if (currentFiles.length > 0) {
    batches.push(estimateBatch(
      currentFiles,
      system,
      visuals,
      makeUser,
      budget.imageTokensPerScreenshot
    ));
  }

  return {
    batches,
    oversizedFiles,
    estimatedInputTokens: batches.reduce((sum, batch) => sum + batch.inputTokens, 0),
    estimatedInputTokensAtOnce: singleRequest.inputTokens,
    budget
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRateGate(budget) {
  const starts = [];
  return async function waitForBudget(batch, onWait) {
    if (!budget.inputTokensPerMinute && !budget.outputTokensPerMinute) return;
    const outputReservation = budget.outputTokensPerRequest ?? 0;
    if (budget.inputTokensPerMinute && batch.inputTokens > budget.inputTokensPerMinute) {
      throw new Error(`A planned request needs about ${batch.inputTokens} input tokens, above the configured per-minute allowance of ${budget.inputTokensPerMinute}.`);
    }
    if (budget.outputTokensPerMinute && outputReservation > budget.outputTokensPerMinute) {
      throw new Error(`The configured output limit (${outputReservation}) exceeds the per-minute allowance (${budget.outputTokensPerMinute}). Lower maxTokens or the provider output budget.`);
    }

    while (true) {
      const now = Date.now();
      while (starts.length && starts[0].at + RATE_WINDOW_MS <= now) starts.shift();
      const inputUsed = starts.reduce((sum, entry) => sum + entry.inputTokens, 0);
      const outputUsed = starts.reduce((sum, entry) => sum + entry.outputTokens, 0);
      const inputFits = !budget.inputTokensPerMinute
        || inputUsed + batch.inputTokens <= budget.inputTokensPerMinute;
      const outputFits = !budget.outputTokensPerMinute
        || outputUsed + outputReservation <= budget.outputTokensPerMinute;

      if (inputFits && outputFits) {
        starts.push({ at: now, inputTokens: batch.inputTokens, outputTokens: outputReservation });
        return;
      }

      const waitMs = Math.max(100, starts[0].at + RATE_WINDOW_MS - now);
      if (onWait) await onWait(waitMs);
      await delay(waitMs);
    }
  };
}

export function describePlanError(plan) {
  if (plan.oversizedFiles.length === 0) return "";
  const entries = plan.oversizedFiles
    .map((file) => `- ${file.path}: about ${file.estimatedInputTokens} tokens; budget ${file.budget}`)
    .join("\n");
  return `These files exceed the configured input budget even when reviewed alone:\n${entries}\nPolish only splits between files so source context and line numbers stay intact. Review a smaller component or section, or raise the budget if your provider allows it.`;
}
