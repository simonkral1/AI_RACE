const DEFAULT_BASE_URL = 'https://api.hyperbolic.xyz/v1/chat/completions';
const DEFAULT_MODEL = 'Qwen/Qwen3-Next-80B-A3B-Thinking';
const DEFAULT_MAX_TOKENS = 220;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 0.8;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_PROXY_URL = 'http://localhost:8787/api/llm';

type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
};

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmCallOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  timeoutMs?: number;
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.document !== 'undefined';

const readEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  return process.env?.[key];
};

const readViteEnv = (key: string): string | undefined => {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.[key];
  } catch {
    return undefined;
  }
};

const numberFromEnv = (key: string, fallback: number): number => {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const getLlmConfig = (): LlmConfig | null => {
  if (isBrowser()) return null;
  const apiKey = readEnv('HYPERBOLIC_API_KEY');
  if (!apiKey) return null;
  return {
    baseUrl: readEnv('HYPERBOLIC_BASE_URL') ?? DEFAULT_BASE_URL,
    apiKey,
    model: readEnv('HYPERBOLIC_MODEL') ?? DEFAULT_MODEL,
    maxTokens: numberFromEnv('HYPERBOLIC_MAX_TOKENS', DEFAULT_MAX_TOKENS),
    temperature: numberFromEnv('HYPERBOLIC_TEMPERATURE', DEFAULT_TEMPERATURE),
    topP: numberFromEnv('HYPERBOLIC_TOP_P', DEFAULT_TOP_P),
    timeoutMs: numberFromEnv('HYPERBOLIC_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
  };
};

const getProxyUrl = (): string => readViteEnv('VITE_LLM_PROXY_URL') ?? DEFAULT_PROXY_URL;

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch is not available in this runtime.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const callLlm = async (messages: LlmMessage[], options: LlmCallOptions = {}): Promise<string | null> => {
  try {
    if (isBrowser()) {
      const response = await fetchWithTimeout(
        getProxyUrl(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
            top_p: options.topP,
            model: options.model,
          }),
        },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as { content?: string };
      return payload?.content ?? null;
    }

    const config = getLlmConfig();
    if (!config) return null;
    const body = {
      model: options.model ?? config.model,
      max_tokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
      top_p: options.topP ?? config.topP,
      messages,
    };

    const response = await fetchWithTimeout(
      config.baseUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
      },
      options.timeoutMs ?? config.timeoutMs,
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload?.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
};
