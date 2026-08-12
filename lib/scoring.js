export const SEVERITIES = ["critical", "serious", "moderate"];

export function scoreFindings(findings) {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  let cap = 100;
  if (criticals >= 3) cap = 39;
  else if (criticals === 2) cap = 49;
  else if (criticals === 1) cap = 59;

  let score = 100;
  for (const f of findings) {
    if (f.severity === "critical") score -= 25;
    else if (f.severity === "serious") score -= 10;
    else if (f.severity === "moderate") score -= 4;
  }
  return Math.max(0, Math.min(Math.round(score), cap));
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
