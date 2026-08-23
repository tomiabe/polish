// Mock OpenAI-compatible LLM server for the polish before/after demo.
// It scans the actual code in the prompt for marker strings so findings
// carry real file:line numbers, and answers both review and verify prompts.
// No API key needed.

import http from "node:http";

// Each finding is anchored to a unique marker substring in the source.
// line is resolved from the numbered lines in the prompt.
const BEFORE_FINDINGS = [
  {
    severity: "critical",
    category: "A11Y",
    rule: "Semantic elements",
    title: "Clickable div is not keyboard accessible",
    message: "The Delete action is a <div> with onClick, so it is not focusable or operable from the keyboard.",
    marker: `className="btn danger" onClick`,
    fix: "Use a real <button className=\"btn danger\"> so the action is focusable, and add :focus-visible styling."
  },
  {
    severity: "serious",
    category: "H5",
    rule: "Error prevention",
    title: "Destructive delete without confirmation",
    message: "onDelete fires immediately on click; deleting a user is irreversible.",
    marker: "onDelete(user.id)",
    fix: "Confirm before deleting: window.confirm or an in-app dialog, or make deletion reversible with undo."
  },
  {
    severity: "serious",
    category: "C2",
    rule: "Color and tokens",
    title: "Hardcoded hex colors bypass the design system",
    message: "The gradient uses #3B82F6 and #8B5CF6 inline; components should consume semantic tokens.",
    marker: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
    fix: "Move the gradient to a token-backed class (e.g. --gradient-card) and reference it from the stylesheet."
  },
  {
    severity: "serious",
    category: "A11Y",
    rule: "Accessible names",
    title: "Avatar image missing alt text",
    message: "<img src={user.avatar} /> has no alt, so screen readers announce an empty image.",
    marker: "<img src={user.avatar} />",
    fix: "Add alt={user.name}; if the avatar is decorative, use alt=\"\"."
  },
  {
    severity: "moderate",
    category: "C1",
    rule: "Visual craft",
    title: "Magic number for border radius",
    message: "borderRadius: 12 is an arbitrary one-off; radius should come from the token scale.",
    marker: "borderRadius: 12",
    fix: "Use a radius token (e.g. --radius-md) or the concentric rule against the card padding."
  },
  {
    severity: "moderate",
    category: "C5",
    rule: "Motion",
    title: "transition: all animates everything",
    message: "transition: \"all 200ms\" animates every property, causing jank and unexpected motion.",
    marker: "transition: \"all 200ms\"",
    fix: "Name the exact properties (e.g. transition: \"transform 200ms ease-out\") and respect prefers-reduced-motion."
  },
  {
    severity: "moderate",
    category: "C6",
    rule: "Components",
    title: "Duplicated card markup",
    message: "CompactProfileCard re-implements the card instead of composing ProfileCard, so fixes must land twice.",
    marker: "CompactProfileCard",
    fix: "Drop the second component and add a compact prop to ProfileCard, as the compact variant already does."
  },
  {
    severity: "moderate",
    category: "A11Y",
    rule: "Accessible names",
    title: "Icon-only button has no accessible name",
    message: "The 'more' icon button has no aria-label, so its purpose is invisible to assistive tech.",
    marker: `className="icon-btn"`,
    fix: "Add aria-label=\"More actions\" to the button (and never aria-hidden on a focusable element)."
  }
];

const AFTER_FINDINGS = [
  {
    severity: "moderate",
    category: "H5",
    rule: "Error prevention",
    title: "Native confirm dialog breaks the design system",
    message: "window.confirm works but is unstyled and outside the app's visual language.",
    marker: "window.confirm",
    fix: "Replace with an in-app confirmation dialog that matches the design system (optional polish)."
  }
];

function resolveLines(file, code, findings) {
  const lines = code.split("\n");
  return findings.map((f) => {
    const line = lines.findIndex((l) => l.includes(f.marker));
    const num = line !== -1 ? Number(lines[line].match(/^\s*(\d+)\s*\|/)?.[1] ?? line + 1) : 1;
    const { marker, ...rest } = f;
    return { ...rest, file, line: num };
  });
}

function buildReviewAnswer(user) {
  const pathMatch = user.match(/### FILE: ([^\n]+)/);
  const file = pathMatch ? pathMatch[1] : "unknown";
  const fence = user.match(/```\n([\s\S]*?)\n```/);
  const code = fence ? fence[1] : "";
  const isAfter = file.includes(".after.");
  const template = isAfter ? AFTER_FINDINGS : BEFORE_FINDINGS;
  const findings = resolveLines(file, code, template);
  return {
    summary: isAfter
      ? "Strong cleanup: semantic elements, tokens, confirmation, and accessible names are in place. One residual polish item: the native confirm dialog."
      : "The card is usable but has accessibility blockers (keyboard, alt text) and design-system leaks (hardcoded hex, magic radius) typical of AI-generated code.",
    findings
  };
}

function buildVerifyAnswer(user) {
  const pathMatch = user.match(/### FILE: ([^\n]+)/);
  const file = pathMatch ? pathMatch[1] : "unknown";
  const isAfter = file.includes(".after.");
  // polish sends the previous findings either as a bare array or as
  // { "findings": [...] } - slice the JSON between the prompt markers and
  // accept both shapes.
  const startMarker = "Previous findings to verify:";
  const start = user.indexOf(startMarker);
  let raw = "";
  if (start !== -1) {
    const body = user.slice(start + startMarker.length);
    const endMarker = "\n\nCurrent file contents:";
    const end = body.indexOf(endMarker);
    raw = (end === -1 ? body : body.slice(0, end)).trim();
  }
  let previous = null;
  try {
    previous = JSON.parse(raw);
  } catch {
    previous = null;
  }
  const items = Array.isArray(previous) ? previous : previous?.findings ?? [];
  return {
    findings: items.map((f) => ({ ...f, status: isAfter ? "fixed" : "still_present" }))
  };
}

export function createDemoServer() {
  return http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      try {
        const parsed = JSON.parse(body);
        const system = parsed.messages?.[0]?.content ?? "";
        const user = parsed.messages?.[1]?.content ?? "";
        const isVerify = system.includes("checking whether previously reported issues");
        const payload = isVerify ? buildVerifyAnswer(user) : buildReviewAnswer(user);
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });
}
