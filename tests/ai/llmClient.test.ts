import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callLlm } from '../../src/ai/llmClient.js';

describe('callLlm', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    HYPERBOLIC_API_KEY: process.env.HYPERBOLIC_API_KEY,
    HYPERBOLIC_BASE_URL: process.env.HYPERBOLIC_BASE_URL,
    HYPERBOLIC_MODEL: process.env.HYPERBOLIC_MODEL,
  };

  beforeEach(() => {
    process.env.HYPERBOLIC_API_KEY = 'test-key';
    process.env.HYPERBOLIC_BASE_URL = 'https://example.test/v1/chat/completions';
    process.env.HYPERBOLIC_MODEL = 'Qwen/test';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.HYPERBOLIC_API_KEY = originalEnv.HYPERBOLIC_API_KEY;
    process.env.HYPERBOLIC_BASE_URL = originalEnv.HYPERBOLIC_BASE_URL;
    process.env.HYPERBOLIC_MODEL = originalEnv.HYPERBOLIC_MODEL;
    vi.restoreAllMocks();
  });

  it('extracts text from content-part arrays and ignores reasoning segments', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: [
                  { type: 'reasoning', text: 'hidden analysis' },
                  { type: 'text', text: '{"actions":[{"actionId":"policy","openness":"open"}]}' },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as typeof fetch;

    const text = await callLlm([{ role: 'user', content: 'choose actions' }]);
    expect(text).toBe('{"actions":[{"actionId":"policy","openness":"open"}]}');
  });

  it('strips think tags from returned content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '<think>hidden</think>{"choiceId":"share_research"}',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as typeof fetch;

    const text = await callLlm([{ role: 'user', content: 'pick a choice' }]);
    expect(text).toBe('{"choiceId":"share_research"}');
  });
});
