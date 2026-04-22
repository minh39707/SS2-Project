const DEFAULT_TIMEOUT_MS = 60000;
const JSON_RETRY_SUFFIX = [
  'Return exactly one complete JSON object.',
  'Do not include markdown fences, explanations, or trailing text.',
  'Ensure the JSON is fully closed and valid.',
].join(' ');

function stripCodeFences(value) {
  const text = String(value ?? '').trim();

  if (!text.startsWith('```')) {
    return text;
  }

  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function readIntegerEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const value = Number.parseInt(process.env[name], 10);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function getLocalTimeoutMs() {
  return readIntegerEnv('LOCAL_AI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, {
    min: 5000,
    max: 300000,
  });
}

function getOllamaKeepAlive() {
  return process.env.OLLAMA_KEEP_ALIVE || '10m';
}

function shouldUseOllamaThinking() {
  return process.env.OLLAMA_THINK === 'true';
}

function buildOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
}

function getOllamaModel(model) {
  return model || process.env.OLLAMA_MODEL || 'qwen3:8b';
}

function parseJson(rawText, providerName) {
  try {
    return JSON.parse(stripCodeFences(rawText));
  } catch {
    const error = new Error(`${providerName} returned invalid JSON.`);
    error.statusCode = 502;
    error.rawText = rawText;
    throw error;
  }
}

async function requestWithTimeout(url, options, providerName) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getLocalTimeoutMs());

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMessage =
        typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.message ?? payload?.message;
      const error = new Error(
        errorMessage ?? `${providerName} request failed.`,
      );
      error.statusCode = response.status;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`${providerName} request timed out.`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestOllama({
  prompt,
  systemInstruction,
  model,
  temperature,
  maxOutputTokens,
}) {
  const resolvedModel = getOllamaModel(model);
  const payload = await requestWithTimeout(
    `${buildOllamaBaseUrl()}/api/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: resolvedModel,
        stream: false,
        format: 'json',
        keep_alive: getOllamaKeepAlive(),
        think: shouldUseOllamaThinking(),
        messages: [
          systemInstruction ? { role: 'system', content: systemInstruction } : null,
          { role: 'user', content: prompt },
        ].filter(Boolean),
        options: {
          temperature,
          num_predict: maxOutputTokens,
        },
      }),
    },
    `Ollama model "${resolvedModel}"`,
  );

  return payload?.message?.content ?? payload?.response ?? '';
}

async function callLocalAi({
  prompt,
  systemInstruction,
  model,
  temperature = 0.4,
  maxOutputTokens = 1200,
}) {
  let rawText = await requestOllama({
    prompt,
    systemInstruction,
    model,
    temperature,
    maxOutputTokens,
  });

  try {
    return {
      model: getOllamaModel(model),
      parsed: parseJson(rawText, 'ollama'),
      rawText,
      provider: 'ollama',
    };
  } catch (error) {
    rawText = await requestOllama({
      prompt: `${prompt}\n\n${JSON_RETRY_SUFFIX}`,
      systemInstruction,
      model,
      temperature: 0.1,
      maxOutputTokens: Math.max(maxOutputTokens, 1400),
    });

    return {
      model: getOllamaModel(model),
      parsed: parseJson(rawText, 'ollama'),
      rawText,
      provider: 'ollama',
    };
  }
}

module.exports = {
  callLocalAi,
};
