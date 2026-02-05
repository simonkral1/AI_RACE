import 'dotenv/config';
import http from 'node:http';

const DEFAULT_BASE_URL = 'https://api.hyperbolic.xyz/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen/Qwen3-Next-80B-A3B-Thinking';
const DEFAULT_MAX_TOKENS = 220;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.8;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_PORT = 8787;

const env = (key: string, fallback?: string): string | undefined => process.env[key] ?? fallback;

const apiKey = env('HYPERBOLIC_API_KEY');
if (!apiKey) {
  console.error('Missing HYPERBOLIC_API_KEY. Set it before starting the proxy.');
  process.exit(1);
}

const baseUrl = env('HYPERBOLIC_BASE_URL', DEFAULT_BASE_URL) as string;
const model = env('HYPERBOLIC_MODEL', DEFAULT_MODEL) as string;
const maxTokens = Number(env('HYPERBOLIC_MAX_TOKENS', String(DEFAULT_MAX_TOKENS)));
const temperature = Number(env('HYPERBOLIC_TEMPERATURE', String(DEFAULT_TEMPERATURE)));
const topP = Number(env('HYPERBOLIC_TOP_P', String(DEFAULT_TOP_P)));
const timeoutMs = Number(env('HYPERBOLIC_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)));
const port = Number(env('LLM_PROXY_PORT', String(DEFAULT_PORT)));
const corsOrigin = env('LLM_PROXY_CORS_ORIGIN', '*') as string;

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  if (typeof fetch !== 'function') throw new Error('Fetch is not available in this runtime.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const sendJson = (res: http.ServerResponse, status: number, payload: unknown): void => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(body);
};

const parseBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Missing URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/llm') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const raw = await parseBody(req);
    const payload = JSON.parse(raw) as {
      prompt?: string;
      messages?: Array<{ role: string; content: string }>;
      model?: string;
      max_tokens?: number;
      maxTokens?: number;
      temperature?: number;
      top_p?: number;
      topP?: number;
    };

    let messages = payload?.messages;
    if (!messages || messages.length === 0) {
      const prompt = payload?.prompt;
      if (!prompt || typeof prompt !== 'string') {
        sendJson(res, 400, { error: 'Missing prompt or messages' });
        return;
      }
      messages = [
        {
          role: 'system',
          content: 'You are a strategy game AI. Output JSON only, no markdown, no code fences, no extra keys.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ];
    }

    const resolvedModel = typeof payload.model === 'string' ? payload.model : model;
    const resolvedMaxTokens = payload.max_tokens ?? payload.maxTokens ?? maxTokens;
    const resolvedTemperature = payload.temperature ?? temperature;
    const resolvedTopP = payload.top_p ?? payload.topP ?? topP;

    const body = {
      model: resolvedModel,
      max_tokens: Number.isFinite(resolvedMaxTokens) ? resolvedMaxTokens : DEFAULT_MAX_TOKENS,
      temperature: Number.isFinite(resolvedTemperature) ? resolvedTemperature : DEFAULT_TEMPERATURE,
      top_p: Number.isFinite(resolvedTopP) ? resolvedTopP : DEFAULT_TOP_P,
      messages,
    };

    const response = await fetchWithTimeout(
      baseUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
    );

    if (!response.ok) {
      const text = await response.text();
      sendJson(res, response.status, { error: 'Upstream error', detail: text.slice(0, 500) });
      return;
    }

    const upstream = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = upstream?.choices?.[0]?.message?.content ?? '';
    sendJson(res, 200, { content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`LLM proxy listening on http://localhost:${port}/api/llm`);
});
