#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_CONFIG } from "./lib/config.js";
import { reviewFiles, verifyFiles } from "./lib/review.js";

const FILES_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative or display path of the file" },
      content: { type: "string", description: "Full source content of the file" }
    },
    required: ["path", "content"]
  }
};

const VISUALS_SCHEMA = {
  type: "array",
  maxItems: 3,
  items: {
    type: "object",
    properties: {
      path: { type: "string", description: "Image path when Polish runs in the same workspace" },
      label: { type: "string", description: "What the screenshot shows" },
      viewport: { type: "string", description: "Rendered viewport, for example 390x844" },
      data: { type: "string", description: "PNG, JPEG, or WebP base64 data. A data URL is preferred." },
      mediaType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"], description: "Required when data is raw base64 rather than a data URL" }
    }
  }
};

const PROVIDER_ENUM = ["openai", "anthropic", "openrouter", "groq", "gemini"];

const TOOLS = [
  {
    name: "polish_review_files",
    title: "polish review",
    description:
      "Run a design/usability audit over UI files and optional rendered screenshots. Reviews against a layered rubric: usability heuristics, design craft (typography, color, spacing, motion, components, writing, rendered visual QA), and accessibility. Returns a 0-100 Polish score using weighted deductions and findings with severity, category, rule, file:line and a concrete fix. Prefer the highest-traffic screens, not whole codebases. Use screenshots when reviewing visual alignment, responsive states, media crop, or page-to-page consistency.",
    inputSchema: {
      type: "object",
      properties: {
        files: { ...FILES_SCHEMA, description: "UI files to review (up to 20)" },
        visuals: { ...VISUALS_SCHEMA, description: "Optional rendered screenshots. Attach source files too, so findings can identify the responsible code." },
        context: { type: "string", description: "Short label for this review, e.g. feature or branch name" },
        provider: { type: "string", enum: PROVIDER_ENUM, description: "Override the LLM provider" },
        model: { type: "string", description: "Override the LLM model" }
      },
      required: ["files"]
    }
  },
  {
    name: "polish_verify_fixes",
    title: "polish verify fixes",
    description:
      "Re-check previously reported polish findings against updated file contents. Returns a new score, receipt, and fixed vs still_present per finding. Much cheaper than a full re-review. Use after applying fixes.",
    inputSchema: {
      type: "object",
      properties: {
        files: { ...FILES_SCHEMA, description: "The updated UI files (same paths as the original review)" },
        visuals: { ...VISUALS_SCHEMA, description: "Optional current screenshots for checking visual fixes" },
        issues: {
          type: "array",
          items: { type: "object" },
          description: "The findings from the original review, with id, severity, category, title, file"
        },
        provider: { type: "string", enum: PROVIDER_ENUM },
        model: { type: "string" }
      },
      required: ["files", "issues"]
    }
  },
  {
    name: "polish_usage",
    title: "polish usage",
    description:
      "Check polish usage status. polish is self-hosted: there is no quota and nothing to subscribe to. You pay only for your own LLM API key (Groq, OpenAI, Anthropic or OpenRouter).",
    inputSchema: { type: "object", properties: {} }
  }
];

const server = new Server({ name: "polish", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

function toText(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

function toResult(obj) {
  return toText(JSON.stringify(obj, null, 2));
}

function toError(message) {
  return toText(JSON.stringify({ error: message }, null, 2), true);
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const cfg = { ...DEFAULT_CONFIG, ...(args ?? {}) };
    if (name === "polish_review_files") {
      const result = await reviewFiles(cfg, args.files ?? []);
      return toResult(result);
    }
    if (name === "polish_verify_fixes") {
      return toResult(await verifyFiles(cfg, args.files ?? [], args.issues ?? []));
    }
    if (name === "polish_usage") {
      return toResult({
        quota: "unlimited",
        message: "polish is self-hosted - no subscription. Uses your own API key (GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY)."
      });
    }
    return toError(`Unknown tool: ${name}`);
  } catch (err) {
    return toError(err.message);
  }
});

await server.connect(new StdioServerTransport());
