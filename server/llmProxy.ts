/**
 * @deprecated llmProxy.ts — OpenRouter-based LLM proxy (port 8787)
 *
 * DEPRECATED as of P6.0 (2026-06-12). Gamemaster narration has migrated to
 * the Claude Agent SDK inside agentServer.ts (port 8788). The /api/gm/*
 * endpoints on agentServer.ts replace the /api/llm endpoint served here.
 *
 * This file is retained for reference and to avoid breaking any external
 * tooling that may reference it. The `npm run llm-proxy` script is also kept.
 * Do NOT delete this file without auditing all callers first.
 *
 * Two-process dev workflow (replaces the old three-process workflow):
 *   npm run dev           — Vite dev server (:5173)
 *   npm run agent-server  — Faction agents + GM (:8788)
 */
import 'dotenv/config';
import http from 'node:http';
import { OpenRouter } from '@openrouter/sdk';
import { extractLlmText } from '../src/ai/llmParsing.js';

const BASE_DEFAULT_MODEL = 'google/gemini-3-flash';
const BASE_DEFAULT_REASONING_EFFORT = 'low';
const DEFAULT_PORT = 8787;
const DEFAULT_TIMEOUT_MS = 45000;

const env = (key: string, fallback?: string): string | undefined => process.env[key] ?? fallback;

const port = Number(env('LLM_PROXY_PORT', String(DEFAULT_PORT)));
const corsOrigin = env('LLM_PROXY_CORS_ORIGIN', '*') as string;
const configuredDefaultModel = env('LLM_PROXY_MODEL', BASE_DEFAULT_MODEL) as string;
const configuredDefaultReasoningEffort = env('LLM_PROXY_REASONING_EFFORT', BASE_DEFAULT_REASONING_EFFORT) as string;
const forceConfiguredModel = env('LLM_PROXY_FORCE_MODEL', '1') === '1';
const openRouterApiKey = env('OPENROUTER_API_KEY');
const openRouterReferer = env('OPENROUTER_HTTP_REFERER');
const openRouterTitle = env('OPENROUTER_X_TITLE');

let cachedClient: OpenRouter | null = null;

function getClient(): OpenRouter | null {
  if (!openRouterApiKey) return null;
  if (cachedClient) return cachedClient;

  cachedClient = new OpenRouter({
    apiKey: openRouterApiKey,
    defaultHeaders: {
      ...(openRouterReferer ? { 'HTTP-Referer': openRouterReferer } : {}),
      ...(openRouterTitle ? { 'X-Title': openRouterTitle } : {}),
    },
  });
  return cachedClient;
}

function resolveModel(model?: string): string {
  const requested = model?.trim();
  const selected = forceConfiguredModel ? configuredDefaultModel : (requested || configuredDefaultModel);
  return selected;
}

function modelCandidates(model: string): string[] {
  if (model === 'moonshotai/kimi-k2.5') {
    return ['moonshotai/kimi-k2.5', 'moonshotai/kimi-k2', 'moonshotai/kimi-k2-0905'];
  }
  if (model === 'google/gemini-3-flash') {
    return ['google/gemini-3-flash', 'google/gemini-2.5-flash', 'google/gemini-2.0-flash-001'];
  }
  if (model.includes('gemini') && model.includes('flash')) {
    return [model, 'google/gemini-2.5-flash', 'google/gemini-2.0-flash-001'];
  }
  return [model];
}

function resolveReasoningEffort(reasoningEffort?: string): 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' {
  const normalized = (reasoningEffort ?? '').toLowerCase();
  if (
    normalized === 'none'
    || normalized === 'minimal'
    || normalized === 'low'
    || normalized === 'medium'
    || normalized === 'high'
    || normalized === 'xhigh'
  ) {
    return normalized;
  }
  const configured = configuredDefaultReasoningEffort.toLowerCase();
  if (
    configured === 'none'
    || configured === 'minimal'
    || configured === 'low'
    || configured === 'medium'
    || configured === 'high'
    || configured === 'xhigh'
  ) {
    return configured;
  }
  return BASE_DEFAULT_REASONING_EFFORT;
}

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

const toOpenRouterMessages = (messages: Array<{ role: string; content: string }>): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> =>
  messages
    .map((message) => ({
      role:
        message.role === 'system' || message.role === 'assistant'
          ? message.role
          : 'user',
      content: String(message.content ?? ''),
    }))
    .filter((message) => message.content.trim().length > 0);

const extractResponseText = (response: unknown): string | null => {
  if (!response || typeof response !== 'object') return null;
  const data = response as {
    choices?: Array<{ message?: { content?: unknown; reasoning?: unknown }; text?: unknown }>;
    outputText?: unknown;
    output_text?: unknown;
    content?: unknown;
  };

  const direct = extractLlmText(data.content) ?? extractLlmText(data.outputText) ?? extractLlmText(data.output_text);
  if (direct) return direct;

  for (const choice of data.choices ?? []) {
    // Only extract actual content, never reasoning/thinking text
    const choiceText =
      extractLlmText(choice.message?.content)
      ?? extractLlmText(choice.text);
    if (choiceText) return choiceText;
  }
  return null;
};

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
    const client = getClient();
    if (!client) {
      sendJson(res, 200, {
        content: null,
        degraded: true,
        error: 'OPENROUTER_API_KEY is not configured.',
      });
      return;
    }

    const raw = await parseBody(req);
    const payload = JSON.parse(raw) as {
      prompt?: string;
      messages?: Array<{ role: string; content: string }>;
      model?: string;
      reasoning_effort?: string;
      response_format?: { type?: string };
      max_tokens?: number;
      temperature?: number;
      top_p?: number;
    };

    const inputMessages = payload?.messages ?? [];
    const systemParts: string[] = [];
    const userParts: string[] = [];
    for (const message of inputMessages) {
      if (message.role === 'system') systemParts.push(String(message.content ?? ''));
      else userParts.push(String(message.content ?? ''));
    }

    if (userParts.length === 0 && typeof payload.prompt === 'string') {
      if (systemParts.length === 0) {
        systemParts.push('You are a strategy game AI. Output JSON only when asked.');
      }
      userParts.push(payload.prompt);
    }

    if (userParts.length === 0) {
      sendJson(res, 400, { error: 'Missing prompt or messages' });
      return;
    }

    const messages = toOpenRouterMessages([
      ...systemParts.map((content) => ({ role: 'system', content })),
      ...userParts.map((content) => ({ role: 'user', content })),
    ]);

    const model = resolveModel(payload.model);
    const reasoningEffort = resolveReasoningEffort(payload.reasoning_effort);
    const forceJson = payload.response_format?.type === 'json_object';
    const maxTokens = typeof payload.max_tokens === 'number' ? payload.max_tokens : undefined;
    const temperature = typeof payload.temperature === 'number' ? payload.temperature : undefined;
    const topP = typeof payload.top_p === 'number' ? payload.top_p : undefined;

    const candidates = modelCandidates(model);
    let response: unknown = null;
    let content: string | null = null;
    let usedModel = candidates[0];
    let lastError: string | null = null;

    for (const candidate of candidates) {
      try {
        console.log(`[LLM Proxy] Calling OpenRouter model=${candidate} reasoning=${reasoningEffort}`);
        response = await client.chat.send(
          {
            chatGenerationParams: {
              model: candidate,
              messages,
              stream: false,
              ...(typeof maxTokens === 'number' ? { maxTokens } : {}),
              ...(typeof temperature === 'number' ? { temperature } : {}),
              ...(typeof topP === 'number' ? { topP } : {}),
              reasoning: { effort: reasoningEffort },
              ...(forceJson ? { responseFormat: { type: 'json_object' as const } } : {}),
            },
          },
          { timeoutMs: DEFAULT_TIMEOUT_MS },
        );
        usedModel = candidate;
        content = extractResponseText(response);
        if (!content) {
          lastError = `Empty content from ${candidate}`;
          console.log(`[LLM Proxy] Warning: empty content from model=${candidate}`);
          response = null;
          continue;
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (!response) {
      sendJson(res, 200, { content: null, degraded: true, error: lastError ?? 'OpenRouter request failed' });
      return;
    }

    sendJson(res, 200, { content, model: usedModel });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, 200, { content: null, degraded: true, error: message });
  }
});

// Prevent uncaught promise rejections (e.g. OpenRouter SDK timeout) from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[LLM Proxy] Unhandled rejection (swallowed):', reason instanceof Error ? reason.message : reason);
});

server.listen(port, () => {
  console.log(`LLM proxy listening on http://localhost:${port}/api/llm`);
  console.log(`OpenRouter backend enabled (model: ${resolveModel()})`);
});
