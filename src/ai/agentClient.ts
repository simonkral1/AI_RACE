/**
 * Browser client for the Faction Agent Server (server/agentServer.ts).
 *
 * Each AI faction is a persistent Claude agent (claude-sonnet-4-6, medium
 * reasoning). The browser sends the same prompts it would otherwise send to
 * the generic LLM proxy; the agent server adds the faction persona and the
 * per-faction session memory.
 */

const AGENT_TIMEOUT_MS = 95_000;

let currentGameId = `game-${Math.random().toString(36).slice(2, 10)}`;

export const getAgentGameId = (): string => currentGameId;

export const newAgentGame = (): string => {
  currentGameId = `game-${Math.random().toString(36).slice(2, 10)}`;
  void resetFactionAgents(currentGameId);
  return currentGameId;
};

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.document !== 'undefined';

const isLlmDisabled = (): boolean => {
  if (!isBrowser()) return false;
  try {
    return new URLSearchParams(window.location.search).get('no_llm') === '1';
  } catch {
    return false;
  }
};

const postJson = async (path: string, body: unknown, timeoutMs = AGENT_TIMEOUT_MS): Promise<unknown | null> => {
  if (typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = (await response.json()) as { output?: unknown };
    return payload.output ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
};

export const resetFactionAgents = async (gameId: string): Promise<void> => {
  if (isLlmDisabled()) return;
  await postJson('/api/agents/reset', { gameId }, 5_000);
};

export const agentNegotiate = async (
  factionId: string,
  prompt: string,
): Promise<{ to?: unknown; intent?: unknown; message?: unknown } | null> => {
  if (isLlmDisabled()) return null;
  const output = await postJson('/api/agents/negotiate', { gameId: currentGameId, factionId, prompt });
  return output && typeof output === 'object' ? output as { to?: unknown; intent?: unknown; message?: unknown } : null;
};

export const agentDecide = async (
  factionId: string,
  prompt: string,
): Promise<{ actions?: unknown } | null> => {
  if (isLlmDisabled()) return null;
  const output = await postJson('/api/agents/decide', { gameId: currentGameId, factionId, prompt });
  return output && typeof output === 'object' ? output as { actions?: unknown } : null;
};

export const agentRespond = async (
  factionId: string,
  prompt: string,
): Promise<{ accept?: unknown; reply?: unknown } | null> => {
  if (isLlmDisabled()) return null;
  const output = await postJson('/api/agents/respond', { gameId: currentGameId, factionId, prompt });
  return output && typeof output === 'object' ? output as { accept?: unknown; reply?: unknown } : null;
};
