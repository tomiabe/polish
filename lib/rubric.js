export const LAYERS = {
  usability: {
    id: "usability",
    name: "Core usability heuristics",
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
    ]
  },

  craft: {
    id: "craft",
    name: "Design craft",
    note: "Design-system discipline and production polish: visual craft, tokens, typography, spacing, motion, components, writing.",
    principles: [
      {
        id: "C1",
        name: "Visual craft",
        rules: [
          "Concentric border radius on nested elements: inner radius = outer radius minus padding.",
          "Optical alignment over geometric: visually center icons and text with their containers, not by pixel arithmetic alone.",
          "Images get a 1px inner outline (black at 8% opacity in light mode, white at 8% in dark mode) so they read against any background.",
          "No magic numbers: sizes, spacing, and radius come from the design scale or tokens, not one-off literals.",
          "No arbitrary border-radius values; radius matches the token scale or the concentric rule.",
          "No generic AI-default styling: full-bleed gradients, glows, glassmorphism, purple/blue duotones.",
          "Elevation via shadows, not borders.",
          "No dead code: unused props, unused imports, and unreachable variants are removed."
        ]
      },
      {
        id: "C2",
        name: "Color and tokens",
        rules: [
          "Components use semantic tokens (--color-text-secondary), never primitives (--blue-500).",
          "Tokens are named for their role, not their appearance or first use (--color-accent-solid, never --color-blue-button).",
          "Accent is reserved for the brand; primary never means both brand and body text.",
          "Don't reuse a token from another role just because the color matches; add a token for the new role.",
          "Every palette step has a purpose (page background, hover, border, solid fill, body text); remove unused steps.",
          "The dark-mode palette is designed, not the light palette inverted.",
          "One theme-switching mechanism (prefers-color-scheme or a .dark class) used consistently for every token.",
          "Contrast is measured against the background the element actually renders on, not the page background.",
          "Gradients declare an interpolation space (oklab/oklch) for even, vivid transitions."
        ]
      },
      {
        id: "C3",
        name: "Typography",
        rules: [
          "Web fonts served as woff2; never ttf or otf.",
          "font-variant-numeric: tabular-nums on every changing value: timers, counters, prices, data tables.",
          "Long-form text capped at 60-75 characters per line.",
          "text-wrap: balance on headings, text-wrap: pretty on descriptions, neither in long-form body text.",
          "overflow-wrap: break-word where long words, links, or IDs can escape; white-space: nowrap on labels and badges.",
          "Font smoothing set once on the root, never per component.",
          "Copy stored in natural case; presentation controlled with text-transform, not stored all-caps or lowercase.",
          "Smart punctuation: curly quotes, en dash for ranges, em dash for asides, the single ellipsis character.",
          "text-underline-position: from-font with text-decoration-skip-ink: auto.",
          "Truncated text keeps the full value reachable in a tooltip or expanded view."
        ]
      },
      {
        id: "C4",
        name: "Spacing and layout",
        rules: [
          "Spacing comes from a consistent scale (4/8/16), not arbitrary one-off values.",
          "Gap between groups is at least 2x the gap within a group (8px within, 16px+ between).",
          "Logical properties (margin-inline-start, padding-inline-end) instead of left/right.",
          "No fixed widths or heights on text containers; let text define its own size.",
          "Consistent, adequate whitespace; no cramped or cluttered layouts."
        ]
      },
      {
        id: "C5",
        name: "Motion",
        rules: [
          "Never transition: all; name the exact properties that change.",
          "Buttons scale down to 0.95-0.98 on press with transition: scale 200ms ease-out.",
          "Icon swaps cross-fade: entering icon scales 0.25->1, opacity 0->1, blur 4->0; exiting reverses the same animation.",
          "CSS transitions for interactive states (interruptible); keyframes only for one-shot sequences.",
          "All transitions disabled when switching light/dark theme.",
          "will-change used only for transform, opacity, filter that actually change.",
          "Staged entrances stagger by ~100ms, by group or element, following hierarchy.",
          "No animation on high-frequency interactions (e.g. hover color change in a list).",
          "Motion wrapped in @media (prefers-reduced-motion: no-preference).",
          "Ease-in only on exits; entrances ease out. No infinite animation without a reduced-motion guard."
        ]
      },
      {
        id: "C6",
        name: "Components",
        rules: [
          "Repeated UI patterns are extracted into shared, reusable components.",
          "Prop APIs are minimal and explicit; no conflicting boolean pairs, no unused props.",
          "Components pass refs and extra props through to the underlying element.",
          "Themes flip tokens, not components: no variant duplication for dark mode.",
          "No inline style overrides that bypass the design system.",
          "State lives at the right level; no values that change every frame in component state."
        ]
      },
      {
        id: "C7",
        name: "Writing",
        rules: [
          "Button labels start with a verb ('Save draft', 'Delete project'); never bare 'OK' or 'Yes'.",
          "Confirmation buttons repeat the consequence: 'Delete project' next to 'Cancel'.",
          "One word per flow, kept for every step: 'Continue' or 'Next', never both.",
          "Link text describes the destination ('Read docs'), never 'Click here'.",
          "Consistent capitalization for buttons, headings, and labels; sentence case is the safer default.",
          "Toggles are labeled with the state they turn on ('Send read receipts'), not 'Disable read receipts'.",
          "Empty states orient the reader and offer one next action instead of bare 'No results'.",
          "Address the reader as 'you', not 'the user'."
        ]
      }
    ]
  },

  accessibility: {
    id: "accessibility",
    name: "Accessibility",
    note: "Checkable accessibility requirements for UI code.",
    accessibility: {
      id: "A11Y",
      name: "Accessibility",
      rules: [
        "Text contrast at least 4.5:1 for body text, 3:1 for large text, measured against the background the element actually renders on.",
        "Interactive elements are keyboard-focusable with a visible :focus-visible indicator; never outline: none without a replacement.",
        "tabindex only 0 or -1; positive values break natural tab order.",
        "Native semantic elements: <button> for buttons, <a> for links, landmarks; never a plain <div> where a native element fits.",
        "Heading hierarchy is correct: one h1, no skipped levels.",
        "Form fields have a real <label>, an appropriate type, and inputmode.",
        "Validation on submit: aria-invalid=true, aria-describedby pointing at the error, focus on the first invalid field; submit stays enabled until the request starts.",
        "Paste is never blocked (passwords, one-time codes).",
        "Icon-only buttons have a descriptive aria-label by purpose; aria-hidden never on a focusable element.",
        "Alt text describes purpose ('Search', not 'magnifying glass'); decorative images get alt=''.",
        "role='status' for routine updates, role='alert' only for urgent errors.",
        "Status changes never rely on color alone; pair with an icon, label, or underline.",
        "Touch targets at least 24x24px (44x44 on touch, 40x40 desktop where possible); extended hit areas never overlap.",
        "Skip-to-content link is the first focusable element; anchored headings have scroll-margin-top.",
        "Motion only under @media (prefers-reduced-motion: no-preference).",
        "Tooltips on disabled controls avoided: explanation in visible text next to it, or aria-disabled keeps the control focusable.",
        "Decorative elements (glows, gradients) use pointer-events: none so they never swallow clicks.",
        "Hover styling behind @media (hover: hover) so touch doesn't stick after a tap."
      ]
    }
  }
};

export const DEFAULT_RUBRIC_LAYERS = ["usability", "craft", "accessibility"];

export function mergeRubrics(layerIds = DEFAULT_RUBRIC_LAYERS) {
  const layers = layerIds.map((id) => {
    const layer = LAYERS[id];
    if (!layer) {
      throw new Error(`Unknown rubric layer "${id}". Valid layers: ${Object.keys(LAYERS).join(", ")}`);
    }
    return layer;
  });
  const principles = layers.flatMap((l) => l.principles ?? []);
  const a11yRules = layers.flatMap((l) => (l.accessibility ? l.accessibility.rules : []));
  return {
    name: "Layered design rubric",
    note: "Usability, design craft, and accessibility rules for UI code review.",
    principles,
    accessibility: { id: "A11Y", name: "Accessibility", rules: a11yRules }
  };
}

export function categoryIds(rubric) {
  return [...rubric.principles.map((p) => p.id), rubric.accessibility.id];
}

export function renderRubric(rubric) {
  const lines = [];
  const principles = [...rubric.principles, rubric.accessibility];
  for (const p of principles) {
    lines.push(`[${p.id}] ${p.name}:`);
    for (const r of p.rules) lines.push(`  - ${r}`);
  }
  return lines.join("\n");
}
