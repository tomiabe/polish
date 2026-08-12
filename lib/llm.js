const PROVIDERS = {
  openai: {
    keyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com",
    defaultModel: "gpt-4o-mini",
    supportsJsonMode: true
  },
  anthropic: {
    keyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-4-20250514",
    supportsJsonMode: false
  },
  openrouter: {
    keyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai",
    defaultModel: "openai/gpt-4o-mini",
    supportsJsonMode: false
  },
  groq: {
    keyEnv: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai",
    defaultModel: "llama-3.3-70b-versatile",
    supportsJsonMode: true
  }
};

export function detectProvider(config) {
  if (config.provider) {
    if (!PROVIDERS[config.provider]) {
      throw new Error(`Unknown provider "${config.provider}". Supported: ${Object.keys(PROVIDERS).join(", ")}`);
    }
    return config.provider;
  }
  for (const [name, p] of Object.entries(PROVIDERS)) {
    if (process.env[p.keyEnv]) return name;
  }
  throw new Error(
    "No API key found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY, " +
    "or set a provider in .polish.json."
  );
}

function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }
  return null;
}

async function chatOpenAI(provider, model, system, user, apiKey, baseUrl) {
  const url = `${baseUrl}/v1/chat/completions`;
  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };
  if (provider === "openai" && PROVIDERS.openai.supportsJsonMode) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`LLM API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function chatAnthropic(model, system, user, apiKey, baseUrl) {
  const url = `${baseUrl}/v1/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }]
    })
  });
  if (!res.ok) throw new Error(`LLM API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.map((c) => c.text ?? "").join("") ?? "";
}

export async function callLLM(config, system, user) {
  const provider = detectProvider(config);
  const def = PROVIDERS[provider];
  const apiKey = process.env[def.keyEnv];
  const baseUrl = config.baseUrl ?? def.baseUrl;
  const model = config.model ?? def.defaultModel;
  const raw =
    provider === "anthropic"
      ? await chatAnthropic(model, system, user, apiKey, baseUrl)
      : await chatOpenAI(provider, model, system, user, apiKey, baseUrl);
  const json = extractJson(raw);
  if (!json) throw new Error(`Model returned non-JSON output:\n${raw.slice(0, 500)}`);
  return JSON.parse(json);
}
