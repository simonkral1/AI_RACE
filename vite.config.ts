import { defineConfig, Plugin } from 'vite';
import { spawn } from 'child_process';

const DEFAULT_MODEL = 'claude-opus-4-6';

// Map model shortnames to claude CLI model flags
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
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; // Force subscription auth

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

    const proc = spawn('claude', args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
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

function llmProxyPlugin(): Plugin {
  return {
    name: 'llm-proxy',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const body = Buffer.concat(chunks).toString();

        try {
          const parsedBody = JSON.parse(body);
          const messages: Array<{ role: string; content: string }> = parsedBody.messages ?? [];

          // Split system messages from user/assistant messages
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
          if (userParts.length === 0 && typeof parsedBody.prompt === 'string') {
            if (systemParts.length === 0) {
              systemParts.push('You are a strategy game AI. Output JSON only, no markdown, no code fences, no extra keys.');
            }
            userParts.push(parsedBody.prompt);
          }

          if (userParts.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing prompt or messages' }));
            return;
          }

          const model = resolveModel(parsedBody.model);
          const systemPrompt = systemParts.join('\n\n') || 'You are a strategy game AI. Output JSON only, no markdown, no code fences, no extra keys.';
          const userPrompt = userParts.join('\n\n');

          console.log(`[LLM Proxy] Calling claude --print --model ${model}`);
          console.log(`[LLM Proxy] User prompt: ${userPrompt.slice(0, 200)}`);

          const content = await runClaude(systemPrompt, userPrompt, model, 30000);
          console.log(`[LLM Proxy] Response length: ${content.length}`);

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ content }));
        } catch (error) {
          console.error('[LLM Proxy] Error:', error);
          // Return a graceful fallback so gameplay can continue without a local LLM.
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({
            content: null,
            degraded: true,
            error: error instanceof Error ? error.message : 'LLM request failed',
          }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [llmProxyPlugin()],
});
