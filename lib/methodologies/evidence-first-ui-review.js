/** Evidence-first design and accessibility review guidance used by Polish. */
export const EVIDENCE_FIRST_UI_REVIEW_METHOD = {
  id: "evidence-first-ui-review",
  name: "Evidence-first interface review",
  instructions: [
    "Treat each possible finding as a candidate until the supplied evidence proves it.",
    "For code findings, point to the exact code and explain the user-facing consequence. Do not infer runtime behavior that the supplied code does not establish.",
    "For a claim that a value violates the product's design system, identify the governing token, component, or documented convention when it is present. If that context is missing, omit the claim or label it as a risk to verify rather than a confirmed violation.",
    "Make visual claims about hierarchy, density, alignment, crop, or coherence only when rendered screenshots or other direct visual evidence are supplied. Name the viewport when relevant.",
    "Compare only related surfaces in the same product context. Similar names or files in the repository do not prove that two interfaces share a design contract.",
    "Prefer no finding over a speculative one. If the intended design choice or a necessary correction is unclear, omit the finding.",
    "Preserve the product's established design language. Do not impose a tool-specific style preference as a universal rule unless the user selected it or the product's own evidence supports it.",
    "For accessibility candidates, prioritize accessible names, keyboard access, focus behavior, and dialogs, then inspect semantics, forms and errors, announcements, contrast, and media or motion. Prefer native semantics and the project's existing accessible primitives over extra ARIA or custom interaction code.",
    "Give a targeted fix that addresses the demonstrated issue without unrelated rewrites. Combine duplicate findings that share one underlying cause."
  ]
};
