import { renderRubric } from "./rubric.js";

function numbered(content) {
  const lines = content.split("\n");
  const width = String(lines.length).length;
  return lines.map((l, i) => `${String(i + 1).padStart(width)} | ${l}`).join("\n");
}

export function buildReviewSystem(rubric) {
  return `You are a senior UI/UX design reviewer. You evaluate code for usability and design quality against a rubric, and you report strictly in JSON.

RUBRIC:
${renderRubric(rubric)}

RULES:
- Return ONLY a JSON object, no markdown fences, no prose outside the JSON.
- Findings must reference real code with the correct file path and the true line number (the line is prefixed on each source line).
- Every finding needs a concrete, actionable "fix" suggestion.
- Don't invent issues that aren't present. If a screen is fine, say so in summary and return few findings.
- Prefer a handful of high-signal findings over a long list of nitpicks.
- Line numbers: use the prefixed line numbers in the provided source.
- JSON shape:
{"summary":"<short overall assessment>","findings":[{"severity":"critical|serious|moderate","category":"H1..H10|A11Y","rule":"<short rule name>","title":"<one line>","message":"<what and why>","file":"<relative path>","line":<number>,"fix":"<concrete suggestion>"}]}`;
}

export function buildReviewUser(files) {
  const sections = files
    .map((f) => `### FILE: ${f.path}\n\`\`\`\n${numbered(f.content)}\n\`\`\``)
    .join("\n\n");
  return `Review the following UI code against the rubric. Report findings as JSON.\n\n${sections}`;
}

export function buildVerifySystem(rubric) {
  return `You are a senior UI/UX design reviewer checking whether previously reported issues were fixed. Report strictly in JSON.

RUBRIC:
${renderRubric(rubric)}

RULES:
- For each finding id from the previous review, inspect the CURRENT file contents.
- Mark status "fixed" only if the issue is genuinely resolved in the current code.
- Return a JSON object with the same findings shape, but each finding now also has "status": "fixed" | "still_present", and a "status" note only when it changes.
- Keep original id, severity, category, title, file. Update line if the code moved.
- JSON shape:
{"findings":[{"id":"F1","status":"fixed|still_present","severity":"...","category":"...","rule":"...","title":"...","message":"...","file":"...","line":<number>,"fix":"..."}]}`;
}

export function buildVerifyUser(files, previous) {
  const sections = files
    .map((f) => `### FILE: ${f.path}\n\`\`\`\n${numbered(f.content)}\n\`\`\``)
    .join("\n\n");
  const prev = JSON.stringify(previous, null, 2);
  return `Previous findings to verify:\n${prev}\n\nCurrent file contents:\n\n${sections}`;
}
