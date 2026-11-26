# polish

`polish` is a local CLI and MCP server for evidence-based UI reviews. It evaluates usability, design craft, accessibility, interface writing, and rendered screenshots, then returns a weighted score, file-level findings, and targeted fixes. Bring your own model API key; source files and screenshots are sent to the selected model provider for review, so that provider's pricing and limits apply.

Built for designers and engineers reviewing real UI code.

Website: https://polish.tomiabe.com/

## Why

Run reviews from your terminal or connect the MCP server to an AI agent. Polish sends the selected UI source and optional screenshots to your chosen model provider with a structured review method. Findings include severity, category, file and line, evidence, and a concrete fix. Polish itself adds no subscription or review quota; your provider may charge for usage and enforce rate or context limits.

## Features

- Reviews against a layered rubric: usability heuristics, design craft, interface writing, and accessibility. The craft layer includes rendered visual QA when screenshots are supplied. It checks headings, descriptions, labels, and helper text alongside visual and interaction code. The rubric is plain data, so it can be swapped for any design philosophy.
- Optional rendered screenshots give the review real evidence for alignment, responsive states, media crop, duplicate controls, and visual-system drift. Source files remain part of the review so every finding can point to code.
- The [website preview](https://polish.tomiabe.com/preview.html) runs a limited review of up to five UI files from a public GitHub repository; the full review workflow runs locally through the CLI or MCP server.
- Polish weighted scoring. Critical findings deduct 22, serious findings deduct 9, and moderate findings deduct 3. There is no severity ceiling.
- Provider support for Groq, OpenAI, Anthropic, Gemini, and OpenRouter, plus any OpenAI-compatible endpoint through `baseUrl`.
- Optional provider fallback chains, so you can try multiple APIs in order.
- Token-budget planning estimates the complete prompt, batches files at file boundaries, and can wait between requests when configured per-minute limits would be exceeded. `--dry-run` shows the estimate and batch plan without calling a model.
- One engine drives both a CLI and an MCP server, so terminal users and AI agents get identical results.
- `polish init-agent` writes a safe, repo-local `AGENTS.md` that teaches coding agents when to review UI changes, how to recognize a receipt, and how to verify fixes.
- Verify mode re-checks previous findings against updated files and returns their status plus a score based on unresolved findings. Cost depends on the model and request size.
- Exits with code 1 when critical findings exist, so it works as a pre-commit or CI gate.

## Install

```bash
git clone https://github.com/tomiabe/polish.git
cd polish
npm link          # makes `polish` available in every project
```

Set one API key in your shell profile:

```bash
export GROQ_API_KEY=...        # or:
export OPENAI_API_KEY=...      # or:
export ANTHROPIC_API_KEY=...   # or:
export GEMINI_API_KEY=...      # or:
export OPENROUTER_API_KEY=...
```

## Usage

```bash
polish                                   # audit files matched by config globs
polish src/components src/pages/*.tsx    # audit specific files or directories
polish --context "homepage hero" docs/index.html  # focus a review on one surface
polish --verify findings.json           # re-check that previous findings are fixed
polish --screenshot artifacts/mobile.png src/explore.html src/styles.css
polish --dry-run                        # preview what would be sent, no API call
polish --dry-run --max-input-tokens 7000 # estimate and batch to an input budget
polish --json                           # machine-readable receipt + findings, for CI or agents
polish init-agent                       # add the Polish workflow to AGENTS.md
```

## Config

Create `.polish.json` in a project root. Everything is optional:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "providers": ["gemini", "groq"],
  "include": ["src/**/*.{ts,tsx,css}"],
  "exclude": ["src/generated/**"],
  "visuals": [
    { "path": "artifacts/explore-mobile.png", "label": "Explore filters", "viewport": "390x844" }
  ],
  "rubric": ["usability", "craft", "accessibility"],
  "maxFiles": 20,
  "maxFileBytes": 100000,
  "tokenBudgets": {
    "groq": {
      "inputTokensPerRequest": 7000,
      "inputTokensPerMinute": 7000,
      "outputTokensPerRequest": 900,
      "outputTokensPerMinute": 1000,
      "imageTokensPerScreenshot": 2048
    }
  }
}
```

The token-budget values above are examples. Provider limits vary by model, account, and service tier; configure them from your provider's current limits. You can also override the input and output request caps with `--max-input-tokens` and `--max-tokens`.

- `provider` - `openai`, `anthropic`, `openrouter`, `groq`, or `gemini`. Auto-detected from the env key that is present.
- `providers` - ordered fallback list. If set, polish tries each provider in order until one succeeds.
- `model` - defaults are `gpt-4o-mini`, `claude-sonnet-4-20250514`, `openai/gpt-4o-mini` (OpenRouter), `llama-3.3-70b-versatile` (Groq), and `gemini-2.5-flash`.
- `baseUrl` - override the API endpoint, for a proxy or self-hosted gateway.
- `include` / `exclude` - glob patterns using `**`, `*`, `?`, and `{a,b}`. `node_modules` and `.git` are always skipped.
- `visuals` - up to three PNG, JPEG, or WebP screenshots. Add a label and viewport so Polish knows which state it is inspecting. Use a vision-capable model for screenshot reviews.
- `rubric` - which rubric layers to use. `usability` (core heuristics), `craft` (typography, color, spacing, motion, components, writing), `accessibility` (contrast, keyboard, semantics, forms, touch targets, reduced motion). All three are on by default; pick a subset to cut token cost on large reviews.
- `maxFiles` / `maxFileBytes` - safety caps. Files above `maxFileBytes` are skipped.
- `tokenBudgets` - optional per-provider request and per-minute input/output limits. Polish estimates the full prompt, groups files into requests, and waits between requests when configured minute limits would be exceeded. A single file that cannot fit is reported before any API request; Polish does not split inside a file.
- `imageTokensPerScreenshot` - optional image-token estimate used for planning. The default is 2,048 tokens per image; actual image costs vary by model.
- `maxInputTokens` / `maxTokens` - optional global overrides for the input budget per request and output cap per request.
- `--context` - optional review scope, such as a page section or changed interaction. Polish still uses the supplied files for surrounding context, but reports only findings relevant to the scope.

## The rubric and tailoring it

Polish uses an evidence-first review method alongside its configurable rubric. Findings must be supported by the supplied code or rendered evidence, account for the product's own design context, and include a targeted correction. Accessibility checks prioritize names, keyboard and focus behavior, semantics, forms, announcements, contrast, and motion. Visual preferences are not treated as universal requirements.

The default rubric is three layers:

- **usability** - 10 core heuristics: visibility of system status, match with the real world, user control and freedom, consistency and standards, error prevention, recognition rather than recall, flexibility and efficiency, aesthetic and minimalist design, error diagnosis and recovery, help and documentation.
- **craft** - design-system discipline: visual craft (concentric radius, optical alignment, no magic numbers, no generic AI-default styling), color and tokens, typography, spacing and layout, motion, component composition, writing, and rendered visual QA. Screenshot evidence checks icon centring, alignment between nearby controls, form rhythm, duplicate responsive controls, hero crop and width, and consistency across related screens.
- **accessibility** - checkable requirements: contrast, keyboard support, semantic elements, forms, touch targets, and reduced motion.

The rubric is a data structure. To replace it with your own philosophy, put a `principles` array in `.polish.json`:

```json
{
  "principles": [
    {
      "id": "D1",
      "name": "Your design principles",
      "rules": [
        "A concrete rule the model can verify in code",
        "Another concrete rule"
      ]
    }
  ]
}
```

Rules work best when they are worded as things a model can check ("buttons show a loading state"), not as aesthetic vibes.

## Rendered visual review

Screenshots are an evidence input, not a style preset. Polish does not assume what a travel guide, dashboard, or any other product should look like. It uses the screenshot to verify concrete visual relationships at the viewport you provide, while source code identifies what should be changed.

```bash
polish \
  --screenshot artifacts/explore-mobile.png \
  --screenshot artifacts/explore-desktop.png \
  src/explore.html src/styles.css src/explore.js
```

You can repeat `--screenshot` up to three times. Each image must be PNG, JPEG, or WebP and 5 MB or smaller. `visuals` in `.polish.json` accepts the same images with optional `label` and `viewport` metadata. MCP clients can pass file paths when they share the workspace, or image data when they do not.

`demo/VisualRhythm.before.html` and its after pair are a compact regression fixture for explicit icon centring, duplicate mobile actions, form-control rhythm, and full-bleed surfaces.

## Writing review

Polish reviews visible product copy as an editor, not as an AI detector. C7 looks for generic claims, unsupported importance, vague attribution, formulaic contrasts, unnecessary recaps, and other patterns that can make copy feel templated or untrustworthy. It never claims that text was AI-generated.

The guidance is informed by [Wikipedia's signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), used as a list of possible writing symptoms rather than proof of origin. Polish flags a pattern only when it weakens clarity, specificity, or trust, and proposes a concise replacement.

## Scoring

- Start at 100. Each finding deducts according to Polish weights: critical -22, serious -9, moderate -3.
- The score never drops below 0.

Every review run also emits a receipt with `polishApplied: true`, a run id, the score, the files reviewed, the batch count, and an estimated input-token total. In human mode, `polish` prints that receipt before the score. In `--json` mode, agents can read the same receipt without parsing the plain-text output.

## Verify mode

```bash
polish > findings.json
# fix the issues
polish --verify findings.json
```

Verify mode re-runs only the flagged findings against the current file contents and reports `FIXED` or `STILL PRESENT` for each one.
It also emits a fresh score based on the findings that remain, plus the same receipt shape as a full review.
Add `--json` to get the verify score, receipt, and statuses as machine-readable JSON.

## MCP server

polish also runs as an MCP server over stdio, so AI agents can call it as tools. It exposes:

- `polish_review_files` - review UI files by content, returns a score, receipt, and findings
- `polish_verify_fixes` - re-check findings against updated content, returning a new score, receipt, and statuses
- `polish_usage` - explains that Polish adds no subscription or review quota; model-provider limits and charges may apply

Register it in any MCP-capable client. For opencode, in `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "polish": {
      "type": "local",
      "command": ["node", "/absolute/path/to/polish/mcp-server.js"],
      "enabled": true,
      "environment": {
        "GROQ_API_KEY": "your-key"
      }
    }
  }
}
```

Claude Desktop reads `~/Library/Application Support/Claude/claude_desktop_config.json`, and Codex reads `~/.codex/config.toml`. In all three, use the absolute path to `node` (for example `/usr/local/bin/node`) because GUI apps do not inherit your shell PATH, and pass the API key in the server's environment because GUI apps do not load your shell profile.

### Agent instructions

After registering the MCP server, run `polish init-agent` from the project root. It creates `AGENTS.md` with a review loop for UI changes. The command refuses to replace an existing file unless you pass `--force`.

## Development

```bash
npm test          # node --test: unit tests plus a mock-server end-to-end test
node scripts/demo.mjs            # before/after demo, no API key needed
node scripts/mcp-handshake.mjs   # manual MCP handshake test
```

## Demo

`node scripts/demo.mjs` runs the full pipeline (config, prompts, LLM call, scoring, verify) against a mock OpenAI-compatible server, so no API key is needed. It reviews `demo/ProfileCard.before.jsx`, a component with accessibility blockers and design-system leaks, then its fixed twin `demo/ProfileCard.after.jsx` (plus its stylesheet `demo/profile.css`), and finally verifies that the before-findings are resolved in the after code. The mock is deterministic: expect `39/100` to `97/100` and `8/8 findings fixed`.

With an API key set, the same commands run against a live model, and the verdicts are real. Recorded live runs on Groq (llama-3.3-70b-versatile) scored the card demo `62/100` before and `78/100` after, and the form demo `43/100` before and `66/100` after. Verdicts vary by model and run, so use a live run to judge your own code:

```bash
polish demo/ProfileCard.before.jsx
polish demo/ProfileCard.after.jsx demo/profile.css
polish demo/SettingsForm.before.jsx
polish demo/SettingsForm.after.jsx demo/settings-form.css
```

## Files

```
bin/polish.js        CLI entry, output rendering, exit codes
mcp-server.js        MCP server (stdio) wrapping the review engine
lib/rubric.js        default rubric layers (usability, craft, accessibility), swap for your own
lib/config.js        config loading, glob expansion, defaults
lib/llm.js           LLM provider callers and JSON extraction
lib/prompt.js        review and verify prompt builders
lib/review.js        shared review and verify engine, used by CLI and MCP
lib/visuals.js       screenshot validation and provider-ready visual evidence
lib/token-budget.js  prompt estimates, file batching, and configured rate-limit waits
lib/methodologies/   evidence-first review guidance
lib/agent.js         repo-local instructions for coding agents
lib/scoring.js       weighted scoring and summaries
demo/                before/after demo components (ProfileCard, SettingsForm)
test/                unit and integration tests
scripts/             manual test scripts
```

## Notes on token cost

Polish sends full, line-numbered file contents and any supplied screenshots to the selected provider. `--dry-run` estimates the complete text prompt and screenshot budget, then shows the request batches without making an API call. Text estimates use roughly four characters per token; screenshot estimates are configurable. Limits are estimates, not provider guarantees. Configure per-provider request and per-minute budgets from your provider's current model and account limits. A file that cannot fit the configured input budget is reported before a request; files are not split internally. `--context` narrows findings but does not reduce source sent. Keep `maxFiles` and `maxFileBytes` tight, and review the screens you touch rather than whole repositories.
