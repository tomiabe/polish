# Polish UI review

Use Polish when a task changes rendered UI code, including components, styles, content, forms, navigation, responsive behavior, or interaction states.

## Review loop

1. Identify the UI files affected by the change.
2. When the task concerns visual alignment, spacing, responsive states, media crop, or screen-to-screen consistency, include current screenshots with the review.
3. Run Polish through the configured MCP tool when available. Otherwise run `polish --json <files>`.
4. Treat the run as applied only when the result contains a receipt with `polishApplied: true`.
5. Read the score, findings, categories, file locations, and fixes before editing.
6. Apply the highest-impact fixes that fit the task. Preserve the product's intent and existing design language.
7. Run Polish verify after edits when findings were produced.
8. Report the final score, receipt run ID, files reviewed, screenshots reviewed, and any remaining findings.

## Boundaries

- Do not run Polish on backend or unrelated files unless the user asks.
- Do not claim that Polish was applied without a receipt.
- Do not silently rewrite product copy. If writing is flagged, show the proposed wording in the fix or explain the choice.
- Respect the repository's accessibility, responsive, typography, icon, and content conventions.
- Treat screenshots as evidence for the supplied viewport, not as a substitute for the code needed to fix the issue.
- Keep em dashes and en dashes out of product copy.

## Completion signal

A complete UI change has either a Polish receipt in the response or a clear note that Polish could not run and why.
