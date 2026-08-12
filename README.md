# polish

A self-hosted design audit tool for UI code. It reviews your components against a rubric and scores them 0-100, the way hosted design review services do, but with no subscription and your own LLM API key.

## Why

Hosted design review tools are useful, but they run on quotas and monthly limits. polish does the same job from a single Node script with zero dependencies. Point it at your UI files, it sends them to an LLM with a rubric, and returns a score plus findings with severity, category, file:line, and a concrete fix.

## Features

- Reviews against Nielsen's 10 usability heuristics plus an accessibility pass. The rubric is plain data, so it can be swapped for any design philosophy.
- Rams-style scoring. Critical findings cap the ceiling: one caps at 59, two at 49, three or more at 39.
- Provider support for Groq, OpenAI, Anthropic, and OpenRouter, plus any OpenAI-compatible endpoint through `baseUrl`.
- One engine drives both a CLI and an MCP server, so terminal users and AI agents get identical results.
- Verify mode re-checks previous findings against updated files at a fraction of the cost of a full review.
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
export OPENROUTER_API_KEY=...
```

## Usage

```bash
polish                                   # audit files matched by config globs
polish src/components src/pages/*.tsx    # audit specific files or directories
polish --verify findings.json           # re-check that previous findings are fixed
polish --dry-run                        # preview what would be sent, no API call
polish --json                           # machine-readable findings, for CI
```

## Config

Create `.polish.json` in a project root. Everything is optional:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "include": ["src/**/*.{tsx,tsx,css}"],
  "exclude": ["src/generated/**"],
  "maxFiles": 20,
  "maxFileBytes": 100000
}
```

- `provider` - `openai`, `anthropic`, `openrouter`, or `groq`. Auto-detected from the env key that is present.
- `model` - defaults are `gpt-4o-mini`, `claude-sonnet-4-20250514`, `openai/gpt-4o-mini` (OpenRouter), and `llama-3.3-70b-versatile` (Groq).
- `baseUrl` - override the API endpoint, for a proxy or self-hosted gateway.
- `include` / `exclude` - glob patterns using `**`, `*`, `?`, and `{a,b}`. `node_modules` and `.git` are always skipped.
- `maxFiles` / `maxFileBytes` - safety caps so a large file does not blow the token budget. Every run prints its estimated token count.

## The rubric and tailoring it

The default rubric is Nielsen's 10 usability heuristics: visibility of system status, match with the real world, user control and freedom, consistency and standards, error prevention, recognition rather than recall, flexibility and efficiency, aesthetic and minimalist design, error diagnosis and recovery, help and documentation, plus an accessibility pass.

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

## Scoring

- Start at 100. Each finding deducts: critical -25, serious -10, moderate -4.
- Criticals cap the ceiling: 1 gives max 59, 2 gives max 49, 3+ gives max 39.
- The score never drops below 0.

## Verify mode

```bash
polish > findings.json
# fix the issues
polish --verify findings.json
```

Verify mode re-runs only the flagged findings against the current file contents and reports `FIXED` or `STILL PRESENT` for each one.

## MCP server

polish also runs as an MCP server over stdio, so AI agents can call it as tools. It exposes:

- `polish_review_files` - review UI files by content, returns score and findings
- `polish_verify_fixes` - re-check findings against updated content
- `polish_usage` - usage status, always unlimited

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

## Development

```bash
npm test          # node --test: unit tests plus a mock-server end-to-end test
node scripts/mcp-handshake.mjs   # manual MCP handshake test
```

## Files

```
bin/polish.js        CLI entry, output rendering, exit codes
mcp-server.js        MCP server (stdio) wrapping the review engine
lib/rubric.js        Nielsen rubric and accessibility rules, swap for your own
lib/config.js        config loading, glob expansion, defaults
lib/llm.js           LLM provider callers and JSON extraction
lib/prompt.js        review and verify prompt builders
lib/review.js        shared review and verify engine, used by CLI and MCP
lib/scoring.js       Rams-style scoring and summaries
test/                unit and integration tests
scripts/             manual test scripts
```

## Notes on token cost

polish sends full, line-numbered file contents to the model. The estimated token count is printed before each run. Keep `maxFiles` and `maxFileBytes` tight, and audit the screens you touch in a change rather than whole repositories.
