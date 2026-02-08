import { extractLlmText } from './llmParsing.js';

const DEFAULT_MODEL = 'claude-opus-4-6';
const DEFAULT_MAX_TOKENS = 220;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_PROXY_URL = '/api/llm';

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

const extractTextFromPayload = (payload: LlmPayload): string | null => {
  // Simple { content: "text" } from our proxy
  if (typeof payload.content === 'string' && payload.content.length > 0) {
    return payload.content;
  }
  // OpenAI-compatible fallback
  for (const choice of payload.choices ?? []) {
    const choiceText = extractLlmText(choice.message?.content) ?? extractLlmText(choice.text);
    if (choiceText) return choiceText;
  }
  return extractLlmText(payload.content) ?? extractLlmText(payload.output_text);
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
            model: options.model ?? DEFAULT_MODEL,
          }),
        },
        options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as LlmPayload;
      return extractTextFromPayload(payload);
    }

    // Server-side: use claude CLI via spawn (uses subscription)
    const { spawn } = await import('child_process');
    const systemParts: string[] = [];
    const userParts: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'system') systemParts.push(msg.content);
      else userParts.push(msg.content);
    }

    const model = options.model ?? DEFAULT_MODEL;
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
