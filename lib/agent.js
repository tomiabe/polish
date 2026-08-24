import { promises as fs } from "node:fs";
import path from "node:path";

export const AGENT_INSTRUCTIONS = `# Polish UI review

Use Polish when a task changes rendered UI code, including components, styles, content, forms, navigation, responsive behavior, or interaction states.

## Review loop

1. Identify the UI files affected by the change.
2. Run Polish through the configured MCP tool when available. Otherwise run \`polish --json <files>\`.
3. Treat the run as applied only when the result contains a receipt with \`polishApplied: true\`.
4. Read the score, findings, categories, file locations, and fixes before editing.
5. Apply the highest-impact fixes that fit the task. Preserve the product's intent and existing design language.
6. Run Polish verify after edits when findings were produced.
7. Report the final score, receipt run ID, files reviewed, and any remaining findings.

## Boundaries

- Do not run Polish on backend or unrelated files unless the user asks.
- Do not claim that Polish was applied without a receipt.
- Do not silently rewrite product copy. If writing is flagged, show the proposed wording in the fix or explain the choice.
- Respect the repository's accessibility, responsive, typography, icon, and content conventions.
- Keep em dashes and en dashes out of product copy.

## Completion signal

A complete UI change has either a Polish receipt in the response or a clear note that Polish could not run and why.
`;

export async function writeAgentInstructions(targetDir, force = false) {
  const target = path.resolve(targetDir, "AGENTS.md");
  if (!force) {
    try {
      await fs.access(target);
      throw new Error(`${target} already exists. Pass --force to replace it.`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  await fs.writeFile(target, AGENT_INSTRUCTIONS, "utf8");
  return target;
}
