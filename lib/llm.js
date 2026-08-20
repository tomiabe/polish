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
    defaultModel: "openai/gpt-oss-120b",
    supportsJsonMode: true
  },
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-2.5-flash",
    supportsJsonMode: true
  }
};

function providerNames() {
  return Object.keys(PROVIDERS);
}

function normalizeProviderList(providers) {
  if (!Array.isArray(providers)) return [];
  return [...new Set(providers.filter((p) => typeof p === "string" && PROVIDERS[p]))];
}

export function resolveProviderPlan(config) {
  if (config.provider) {
    if (!PROVIDERS[config.provider]) {
      throw new Error(`Unknown provider "${config.provider}". Supported: ${providerNames().join(", ")}`);
    }
    return [config.provider];
  }

  const explicit = normalizeProviderList(config.providers);
  if (explicit.length > 0) {
    return explicit;
  }

  return providerNames().filter((name) => process.env[PROVIDERS[name].keyEnv]);
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

async function chatGemini(model, system, user, apiKey, baseUrl) {
  const url = `${baseUrl}/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }]
      },
      contents: [
        {
          parts: [{ text: user }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    })
  });
  if (!res.ok) throw new Error(`LLM API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
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

async function invokeProvider(provider, config, system, user) {
  const def = PROVIDERS[provider];
  const apiKey = process.env[def.keyEnv];
  if (!apiKey) {
    throw new Error(`Missing ${def.keyEnv} for provider "${provider}"`);
  }
  const baseUrl = config.baseUrl ?? def.baseUrl;
  const model = config.model ?? def.defaultModel;
  const raw =
    provider === "anthropic"
      ? await chatAnthropic(model, system, user, apiKey, baseUrl)
      : provider === "gemini"
        ? await chatGemini(model, system, user, apiKey, baseUrl)
        : await chatOpenAI(provider, model, system, user, apiKey, baseUrl);
  const json = extractJson(raw);
  if (!json) throw new Error(`Model returned non-JSON output:\n${raw.slice(0, 500)}`);
  return JSON.parse(json);
}

export async function callLLM(config, system, user) {
  const providers = resolveProviderPlan(config);
  if (providers.length === 0) {
    throw new Error(
      "No API key found. Set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY, " +
      "or set provider/providers in .polish.json."
    );
  }

  const errors = [];
  for (const provider of providers) {
    try {
      return await invokeProvider(provider, config, system, user);
    } catch (err) {
      errors.push(`${provider}: ${err.message}`);
    }
  }

  throw new Error(`All configured providers failed:\n${errors.map((e) => `- ${e}`).join("\n")}`);
}
