const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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

function extractTextFromCandidate(candidate) {
  const parts = candidate?.content?.parts;

  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

async function requestGemini({
  apiKey,
  prompt,
  systemInstruction,
  model,
  temperature,
  maxOutputTokens,
}) {
  const controller = new AbortController();
  const timeoutMs = readIntegerEnv('GEMINI_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, {
    min: 5000,
    max: 120000,
  });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: systemInstruction
            ? {
                parts: [{ text: systemInstruction }],
              }
            : undefined,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'application/json',
          },
        }),
      },
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(payload?.error?.message ?? 'Gemini request failed.');
      error.statusCode = response.status;
      throw error;
    }

    const rawText = stripCodeFences(extractTextFromCandidate(payload?.candidates?.[0]));

    if (!rawText) {
      const error = new Error('Gemini returned an empty response.');
      error.statusCode = 502;
      throw error;
    }

    return rawText;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Gemini report request timed out.');
      timeoutError.statusCode = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini({
  prompt,
  systemInstruction,
  model = DEFAULT_MODEL,
  temperature = 0.3,
  maxOutputTokens = 1200,
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const error = new Error('Missing GEMINI_API_KEY in Backend/.env.');
    error.statusCode = 503;
    throw error;
  }

  const parseJson = (rawText) => {
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  };
  const rawText = await requestGemini({
    apiKey,
    prompt,
    systemInstruction,
    model,
    temperature,
    maxOutputTokens,
  });
  let parsed = parseJson(rawText);

  if (!parsed) {
    const retryRawText = await requestGemini({
      apiKey,
      prompt: `${prompt}\n\n${JSON_RETRY_SUFFIX}`,
      systemInstruction,
      model,
      temperature: 0.1,
      maxOutputTokens: Math.max(maxOutputTokens, 1400),
    });
    parsed = parseJson(retryRawText);

    if (!parsed) {
      const error = new Error('Gemini returned invalid JSON.');
      error.statusCode = 502;
      error.rawText = retryRawText;
      throw error;
    }

    return {
      model,
      parsed,
      rawText: retryRawText,
      provider: 'gemini',
    };
  }

  return {
    model,
    parsed,
    rawText,
    provider: 'gemini',
  };
}

module.exports = {
  callGemini,
};
