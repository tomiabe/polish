import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const server = spawn("node", [path.join(import.meta.dirname, "..", "mcp-server.js")], {
  env: { ...process.env, GROQ_API_KEY: process.env.GROQ_API_KEY }
});

const fixture = readFileSync(path.join(import.meta.dirname, "..", "test", "fixtures", "BrokenCard.jsx"), "utf8");

let buffer = "";
server.stdout.on("data", (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    try {
      const msg = JSON.parse(line);
      handle(msg);
    } catch {
      /* ignore non-JSON lines */
    }
  }
});

const pending = {};
function send(method, params, id) {
  const msg = { jsonrpc: "2.0", id, method, params };
  server.stdin.write(JSON.stringify(msg) + "\n");
  return new Promise((resolve) => {
    pending[id] = resolve;
  });
}
function handle(msg) {
  if (msg.id && pending[msg.id]) {
    pending[msg.id](msg);
    delete pending[msg.id];
  }
}

const init = await send("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "test", version: "0.0.1" }
}, 1);
await send("notifications/initialized", {}, 2);
const tools = await send("tools/list", {}, 3);
console.log("tools:", tools.result.tools.map((t) => t.name).join(", "));

const result = await send("tools/call", {
  name: "polish_review_files",
  arguments: {
    context: "test fixture",
    files: [{ path: "BrokenCard.jsx", content: fixture }]
  }
}, 4);

const text = result.result.content[0].text;
const parsed = JSON.parse(text);
console.log("score:", parsed.score);
console.log("counts:", JSON.stringify(parsed.counts));
console.log("findings:", parsed.findings.length);
server.kill();
process.exit(0);
