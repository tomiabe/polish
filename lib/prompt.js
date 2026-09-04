import { renderRubric, categoryIds } from "./rubric.js";
import { renderVisualSummary } from "./visuals.js";

function compactIds(ids) {
  const parts = [];
  let run = [ids[0]];
  for (let i = 1; i < ids.length; i++) {
    const prev = run[run.length - 1];
    const m = prev && prev.match(/^([A-Za-z]+)(\d+)$/);
    const c = ids[i].match(/^([A-Za-z]+)(\d+)$/);
    if (m && c && m[1] === c[1] && Number(c[2]) === Number(m[2]) + 1) {
      run.push(ids[i]);
    } else {
      parts.push(run.length > 2 ? `${run[0]}..${run[run.length - 1]}` : run.join("|"));
      run = [ids[i]];
    }
  }
  parts.push(run.length > 2 ? `${run[0]}..${run[run.length - 1]}` : run.join("|"));
  return parts.join("|");
}

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
- When rendered screenshots are supplied, use them as evidence for visual claims. Anchor each visual finding to the source code that causes it and mention the supplied viewport in the message.
- When screenshots are not supplied, do not state screenshot-only issues as facts. Report a code-level risk only when the source makes it unambiguous.
- Do not flag vanilla JavaScript string templates or literal browser metadata as design-system violations by themselves. Flag a genuine usability, consistency, accessibility, or maintainability problem instead.
- Treat visible copy as part of the interface. Review headings, subheadings, labels, helper text, descriptions, and empty states for clarity, specificity, consistency, and human voice.
- For C7, act as a product copy editor, not an AI detector. Treat template-like or inflated writing as a quality risk only when it weakens clarity, specificity, or trust. Never claim that text was AI-generated.
- When copy is the issue, include a concise replacement in the fix. Do not rewrite copy just to make a cosmetic change.
- Avoid em dashes and en dashes in all titles, messages, fixes, and summaries.
- Line numbers: use the prefixed line numbers in the provided source.
- JSON shape:
{"summary":"<short overall assessment>","findings":[{"severity":"critical|serious|moderate","category":"<one of: ${compactIds(categoryIds(rubric))}>","rule":"<short rule name>","title":"<one line>","message":"<what and why>","file":"<relative path>","line":<number>,"fix":"<concrete suggestion>"}]}`;
}

export function buildReviewUser(files, visuals = []) {
  const sections = files
    .map((f) => `### FILE: ${f.path}\n\`\`\`\n${numbered(f.content)}\n\`\`\``)
    .join("\n\n");
  const visualContext = visuals.length > 0
    ? `Rendered screenshots are attached to this request. Inspect them at their stated viewport and compare them with the source.\n${renderVisualSummary(visuals)}`
    : renderVisualSummary(visuals);
  return `Review the following UI code against the rubric. Report findings as JSON.\n\nRENDERED SURFACES:\n${visualContext}\n\n${sections}`;
}

export function buildVerifySystem(rubric) {
  return `You are a senior UI/UX design reviewer checking whether previously reported issues were fixed. Report strictly in JSON.

RUBRIC:
${renderRubric(rubric)}

RULES:
- For each finding id from the previous review, inspect the CURRENT file contents.
- Mark status "fixed" only if the issue is genuinely resolved in the current code.
- When rendered screenshots are supplied, use them as evidence for visual fixes. Without screenshots, do not claim a visual fix based only on an assumption about the rendered result.
- Return a JSON object with the same findings shape, but each finding now also has "status": "fixed" | "still_present", and a "status" note only when it changes.
- Keep original id, severity, category, title, file. Update line if the code moved.
- JSON shape:
{"findings":[{"id":"F1","status":"fixed|still_present","severity":"...","category":"...","rule":"...","title":"...","message":"...","file":"...","line":<number>,"fix":"..."}]}`;
}

export function buildVerifyUser(files, previous, visuals = []) {
  const sections = files
    .map((f) => `### FILE: ${f.path}\n\`\`\`\n${numbered(f.content)}\n\`\`\``)
    .join("\n\n");
  const prev = JSON.stringify(previous, null, 2);
  const visualContext = visuals.length > 0
    ? `Rendered screenshots are attached to this request. Inspect them at their stated viewport.\n${renderVisualSummary(visuals)}`
    : renderVisualSummary(visuals);
  return `Previous findings to verify:\n${prev}\n\nRENDERED SURFACES:\n${visualContext}\n\nCurrent file contents:\n\n${sections}`;
}
