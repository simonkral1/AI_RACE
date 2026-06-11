import { extractLlmText } from './llmParsing.js';

const DEFAULT_MODEL = 'google/gemini-3-flash';
const DEFAULT_MAX_TOKENS = 220;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_PROXY_URL = '/api/llm';
const DEFAULT_SERVER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  responseFormat?: Record<string, unknown>;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
};

type LlmPayload = {
  content?: unknown;
  output_text?: unknown;
  choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.document !== 'undefined';

const readViteEnv = (key: string): string | undefined => {
  try {
    return (import.meta as { env?: Record<string, string> }).env?.[key];
  } catch {
    return undefined;
  }
};

const getProxyUrl = (): string => readViteEnv('VITE_LLM_PROXY_URL') ?? DEFAULT_PROXY_URL;

const isLlmDisabledInBrowser = (): boolean => {
  if (!isBrowser()) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('no_llm') === '1';
  } catch {
    return false;
  }
};

const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('Fetch is not available in this runtime.'));
  }

  const controller = new AbortController();

  return new Promise<Response>((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(url, { ...options, signal: controller.signal })
      .then((response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(response);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
  });
};

const extractTextFromPayload = (payload: LlmPayload): string | null => {
  const direct = extractLlmText(payload.content);
  if (direct) return direct;

  // OpenAI-compatible fallback
  for (const choice of payload.choices ?? []) {
    const choiceText = extractLlmText(choice.message?.content) ?? extractLlmText(choice.text);
    if (choiceText) return choiceText;
  }
  return extractLlmText(payload.output_text);
};

const getServerLlmConfig = (): {
  apiKey?: string;
  baseUrl: string;
  model: string;
  httpReferer?: string;
  xTitle?: string;
} => {
  // Prefer OpenRouter variables, keep legacy aliases for backward compatibility.
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.HYPERBOLIC_API_KEY;
  const baseUrl = process.env.OPENROUTER_BASE_URL ?? process.env.HYPERBOLIC_BASE_URL ?? DEFAULT_SERVER_BASE_URL;
  const model = process.env.OPENROUTER_MODEL ?? process.env.HYPERBOLIC_MODEL ?? DEFAULT_MODEL;
  const httpReferer = process.env.OPENROUTER_HTTP_REFERER;
  const xTitle = process.env.OPENROUTER_X_TITLE;
  return { apiKey, baseUrl, model, httpReferer, xTitle };
};

export const callLlm = async (messages: LlmMessage[], options: LlmCallOptions = {}): Promise<string | null> => {
  try {
    if (isBrowser()) {
      if (isLlmDisabledInBrowser()) return null;
      const response = await fetchWithTimeout(
        getProxyUrl(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
            temperature: options.temperature ?? DEFAULT_TEMPERATURE,
            top_p: options.topP,
            model: options.model ?? DEFAULT_MODEL,
            response_format: options.responseFormat,
            reasoning_effort: options.reasoningEffort,
          }),
        },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as LlmPayload;
      return extractTextFromPayload(payload);
    }

    const serverConfig = getServerLlmConfig();
    const model = options.model ?? serverConfig.model;

    // Server-side API path (used by tests and production server envs)
    if (serverConfig.apiKey) {
      const response = await fetchWithTimeout(
        serverConfig.baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverConfig.apiKey}`,
            ...(serverConfig.httpReferer ? { 'HTTP-Referer': serverConfig.httpReferer } : {}),
            ...(serverConfig.xTitle ? { 'X-Title': serverConfig.xTitle } : {}),
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
            temperature: options.temperature ?? DEFAULT_TEMPERATURE,
            ...(typeof options.topP === 'number' ? { top_p: options.topP } : {}),
            ...(options.reasoningEffort ? { reasoning: { effort: options.reasoningEffort } } : {}),
            ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
          }),
        },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as LlmPayload;
      return extractTextFromPayload(payload);
    }

    // Local CLI fallback when no API key is configured.
    const { spawn } = await import('child_process');
    const systemParts: string[] = [];
    const userParts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') systemParts.push(msg.content);
      else userParts.push(msg.content);
    }

    const args = [
      '--print',
      '--model', model,
      '--output-format', 'text',
      '--tools', '',
      '--setting-sources', '',
    ];
    if (systemParts.length > 0) {
      args.push('--system-prompt', systemParts.join('\n\n'));
    }
    args.push(userParts.join('\n\n'));

    return new Promise((resolve) => {
      const env = { ...process.env };
      delete env.ANTHROPIC_API_KEY;

      let stdout = '';
      const proc = spawn('claude', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });

      const timer = setTimeout(() => { proc.kill('SIGTERM'); resolve(null); }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        resolve(code === 0 && stdout.trim() ? stdout.trim() : null);
      });
      proc.on('error', () => { clearTimeout(timer); resolve(null); });
    });
  } catch {
    return null;
  }
};
