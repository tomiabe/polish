export const SEVERITIES = ["critical", "serious", "moderate"];
export const SCORE_DEDUCTIONS = { critical: 22, serious: 9, moderate: 3 };

export function scoreFindings(findings) {
  let score = 100;
  for (const f of findings) {
    score -= SCORE_DEDUCTIONS[f.severity] ?? 0;
  }
  return Math.max(0, Math.round(score));
}

export function summarize(findings) {
  const counts = { critical: 0, serious: 0, moderate: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  const byCategory = {};
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  return { counts, byCategory };
}
