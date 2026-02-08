import 'dotenv/config';
import http from 'node:http';
import { spawn } from 'node:child_process';

const DEFAULT_MODEL = 'claude-opus-4-6';
const DEFAULT_PORT = 8787;
const DEFAULT_TIMEOUT_MS = 30000;

const env = (key: string, fallback?: string): string | undefined => process.env[key] ?? fallback;

const port = Number(env('LLM_PROXY_PORT', String(DEFAULT_PORT)));
const corsOrigin = env('LLM_PROXY_CORS_ORIGIN', '*') as string;

// Map model IDs to claude CLI model flags
const MODEL_MAP: Record<string, string> = {
  'claude-opus-4-6': 'opus',
  'claude-sonnet-4-5-20250929': 'sonnet',
  'claude-haiku-4-5-20251001': 'haiku',
  'opus': 'opus',
  'sonnet': 'sonnet',
  'haiku': 'haiku',
};

function resolveModel(model?: string): string {
  if (!model) return MODEL_MAP[DEFAULT_MODEL] ?? 'opus';
  return MODEL_MAP[model] ?? model;
}

function runClaude(systemPrompt: string, userPrompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const procEnv = { ...process.env };
    delete procEnv.ANTHROPIC_API_KEY; // Force subscription auth

    const args = [
      '--print',
      '--model', model,
      '--output-format', 'text',
      '--tools', '',
      '--setting-sources', '',
      '--system-prompt', systemPrompt,
      userPrompt,
    ];

    let stdout = '';
    let stderr = '';

    const proc = spawn('claude', args, { env: procEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr || `claude exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
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
    };

    const messages = payload?.messages ?? [];
    const systemParts: string[] = [];
    const userParts: string[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        userParts.push(msg.content);
      }
    }

    // Handle prompt-only requests
    if (userParts.length === 0 && typeof payload.prompt === 'string') {
      if (systemParts.length === 0) {
        systemParts.push('You are a strategy game AI. Output JSON only, no markdown, no code fences, no extra keys.');
      }
      userParts.push(payload.prompt);
    }

    if (userParts.length === 0) {
      sendJson(res, 400, { error: 'Missing prompt or messages' });
      return;
    }

    const model = resolveModel(payload.model);
    const systemPrompt = systemParts.join('\n\n') || 'You are a strategy game AI. Output JSON only, no markdown, no code fences, no extra keys.';
    const userPrompt = userParts.join('\n\n');

    console.log(`[LLM Proxy] Calling claude --print --model ${model}`);

    const content = await runClaude(systemPrompt, userPrompt, model, DEFAULT_TIMEOUT_MS);
    sendJson(res, 200, { content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Graceful degradation: avoid hard-failing the UI when local LLM tooling is unavailable.
    sendJson(res, 200, { content: null, degraded: true, error: message });
  }
});

server.listen(port, () => {
  console.log(`LLM proxy listening on http://localhost:${port}/api/llm`);
  console.log(`Using claude CLI with subscription (model: ${resolveModel()})`);
});
