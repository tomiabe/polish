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

const PROVIDER_ENUM = ["openai", "anthropic", "openrouter", "groq", "gemini"];

const TOOLS = [
  {
    name: "polish_review_files",
    title: "polish review",
    description:
      "Run a design/usability audit over UI files (React, Vue, Svelte, CSS). Reviews against a layered rubric - usability heuristics, design craft (typography, color, spacing, motion, components, writing), and accessibility - returns a 0-100 Polish score using weighted deductions and findings with severity, category, rule, file:line and a concrete fix. Token cost is proportional to the code sent - prefer the highest-traffic screens, not whole codebases. Use on UI code before committing to catch accessibility and design problems.",
    inputSchema: {
      type: "object",
      properties: {
        files: { ...FILES_SCHEMA, description: "UI files to review (up to 20)" },
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
