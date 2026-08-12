export const NIELSEN_RUBRIC = {
  name: "Nielsen's 10 Usability Heuristics",
  note: "Adapted for web/app UI code review.",
  principles: [
    {
      id: "H1",
      name: "Visibility of system status",
      rules: [
        "Feedback on actions: loading/disabled states, spinners, optimistic updates or success toasts.",
        "Buttons and interactive elements must not appear dead (no visible response on click).",
        "Progress indication for long-running operations.",
        "No long, unbroken async waits without any UI feedback."
      ]
    },
    {
      id: "H2",
      name: "Match between system and the real world",
      rules: [
        "Use plain, human language the user understands; avoid jargon.",
        "Follow familiar platform conventions (labels, icons, gestures).",
        "Dates, currency, units formatted in a familiar, locale-aware way.",
        "Iconography should be conventional and unambiguous."
      ]
    },
    {
      id: "H3",
      name: "User control and freedom",
      rules: [
        "An 'escape hatch': cancel, undo, back, close for every multi-step or destructive flow.",
        "No dead-end states where the only way out is the browser back button.",
        "Destructive actions (delete, reset) must be reversible or confirmed."
      ]
    },
    {
      id: "H4",
      name: "Consistency and standards",
      rules: [
        "Same controls for the same action throughout the app.",
        "Consistent spacing, color, type scale, and component usage.",
        "Same words for the same actions; consistent button labels.",
        "Follow platform conventions (e.g. standard form field behavior)."
      ]
    },
    {
      id: "H5",
      name: "Error prevention",
      rules: [
        "Validation before submission; prevent invalid input at the source (disabled states, input masks, max lengths).",
        "Confirm before destructive or irreversible actions.",
        "Guard against double-submits and accidental navigation.",
        "Forms keep entered data if validation fails."
      ]
    },
    {
      id: "H6",
      name: "Recognition rather than recall",
      rules: [
        "Options, actions, and context should be visible, not remembered.",
        "Don't rely on the user remembering state from a previous screen; surface it.",
        "Sensible defaults; previously entered values reused where helpful.",
        "Labels and instructions inline where relevant."
      ]
    },
    {
      id: "H7",
      name: "Flexibility and efficiency of use",
      rules: [
        "Frequent actions should be fast: shortcuts, keyboard support, defaults, bulk actions.",
        "Avoid forcing many clicks for common tasks.",
        "Search/filter for long lists; pagination or virtual scrolling for very long lists."
      ]
    },
    {
      id: "H8",
      name: "Aesthetic and minimalist design",
      rules: [
        "No irrelevant or rarely-needed information on screen.",
        "Clear visual hierarchy; obvious primary vs secondary actions.",
        "Consistent, adequate whitespace; no cramped or cluttered layouts.",
        "No competing emphasis (too many equally loud elements)."
      ]
    },
    {
      id: "H9",
      name: "Help users recognize, diagnose, and recover from errors",
      rules: [
        "Error messages say what went wrong, why, and how to fix it.",
        "Errors are visible, near the offending field, and use plain language.",
        "No cryptic codes or empty failure states without a next step."
      ]
    },
    {
      id: "H10",
      name: "Help and documentation",
      rules: [
        "Help is available when needed: tooltips, empty states that teach, docs links.",
        "Empty states explain what to do next.",
        "Complex features expose help or onboarding."
      ]
    }
  ],
  accessibility: {
    id: "A11Y",
    name: "Accessibility",
    rules: [
      "Sufficient color contrast between text and background (WCAG AA: 4.5:1 body, 3:1 large).",
      "Interactive elements are keyboard-focusable with visible focus indicators.",
      "Proper semantic HTML: buttons as buttons, links as links, landmarks.",
      "Form fields have programmatically associated labels.",
      "Images have alt text; icons/aria have accessible names; no aria-invalid misuse.",
      "Don't rely on color alone to convey meaning.",
      "Touch targets at least 44x44px (or 24x24 with sufficient spacing)."
    ]
  }
};

export function renderRubric(rubric) {
  const lines = [];
  const principles = [...rubric.principles, rubric.accessibility];
  for (const p of principles) {
    lines.push(`[${p.id}] ${p.name}:`);
    for (const r of p.rules) lines.push(`  - ${r}`);
  }
  return lines.join("\n");
}
