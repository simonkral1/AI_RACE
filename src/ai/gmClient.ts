/**
 * Browser client for the Gamemaster Agent (server/agentServer.ts, /api/gm/*).
 *
 * Replaces direct callLlm() usage in gamemaster.ts. All GM LLM work now runs
 * inside the Claude Agent SDK session on the server, not through the OpenRouter
 * proxy. The GM maintains a persistent session per gameId with a capped rolling
 * history, giving it game continuity without unbounded context growth.
 *
 * Response shape from every /api/gm/* endpoint:
 *   { content: string | null }
 *
 * A null content means the server-side call timed out or failed. The caller
 * (gamemaster.ts) falls back to its existing deterministic template responses.
 *
 * The module respects ?no_llm=1 — it returns null immediately without a
 * network call, so the gamemaster's deterministic fallbacks kick in exactly
 * as before.
 */

const GM_CLIENT_TIMEOUT_MS = 22_000; // slightly longer than server-side GM_TIMEOUT_MS (20s)

let currentGameId = 'default';

export const setGmGameId = (gameId: string): void => {
  currentGameId = gameId;
};

export const getGmGameId = (): string => currentGameId;

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

const isLlmDisabled = (): boolean => {
  if (!isBrowser()) return false;
  try {
    return new URLSearchParams(window.location.search).get('no_llm') === '1';
  } catch {
    return false;
  }
};

const postGm = async (
  endpoint: string,
  prompt: string,
  timeoutMs = GM_CLIENT_TIMEOUT_MS,
): Promise<string | null> => {
  if (isLlmDisabled()) return null;
  if (typeof fetch !== 'function') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/gm/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: currentGameId, prompt }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = (await response.json()) as { content?: unknown };
    return typeof payload.content === 'string' && payload.content.trim()
      ? payload.content.trim()
      : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
};

/**
 * Ask the GM to explain a game mechanic.
 * Prompt: plain text description of the mechanic topic.
 * Returns: player-facing text, or null for fallback.
 */
export const gmExplain = (prompt: string): Promise<string | null> =>
  postGm('explain', prompt);

/**
 * Ask the GM for strategic advice.
 * Prompt: JSON game state snapshot + advice request.
 * Returns: player-facing advice text, or null for fallback.
 */
export const gmAdvice = (prompt: string): Promise<string | null> =>
  postGm('advice', prompt);

/**
 * Ask the GM to narrate a resolved event.
 * Prompt: event + choice details.
 * Returns: player-facing narrative, or null for fallback.
 */
export const gmNarrateEvent = (prompt: string): Promise<string | null> =>
  postGm('narrate-event', prompt);

/**
 * Ask the GM to respond to a player directive (narrative + effects JSON).
 * Prompt: game state + directive.
 * Returns: raw JSON string from the GM, or null for fallback.
 */
export const gmRespondDirective = (prompt: string): Promise<string | null> =>
  postGm('respond-directive', prompt);

/**
 * Ask the GM to interpret a natural-language directive as game actions (JSON).
 * Prompt: game state + directive + allowed actions catalog.
 * Returns: raw JSON string from the GM, or null for fallback.
 */
export const gmInterpretDirective = (prompt: string): Promise<string | null> =>
  postGm('interpret-directive', prompt);

/**
 * Ask the GM for a game summary.
 * Prompt: compact game state snapshot.
 * Returns: player-facing summary, or null for fallback.
 */
export const gmSummary = (prompt: string): Promise<string | null> =>
  postGm('summary', prompt);

/**
 * Ask the GM a free-form question.
 * Prompt: game state + player question.
 * Returns: player-facing answer, or null for fallback.
 */
export const gmAsk = (prompt: string): Promise<string | null> =>
  postGm('ask', prompt);

/**
 * Ask the GM for an opening narration when the game starts.
 * Prompt: faction name, type, and year.
 * Returns: player-facing briefing, or null for fallback.
 */
export const gmOpening = (prompt: string): Promise<string | null> =>
  postGm('opening', prompt);

/**
 * Ask the GM for an end-of-turn narrative.
 * Prompt: turn context, player actions, dice roll.
 * Returns: player-facing summary, or null for fallback.
 */
export const gmTurnSummary = (prompt: string): Promise<string | null> =>
  postGm('turn-summary', prompt);

/**
 * Ask the GM to introduce an event before the player chooses.
 * Prompt: event title, description, faction, year/quarter.
 * Returns: player-facing intro brief, or null for fallback.
 */
export const gmIntroduceEvent = (prompt: string): Promise<string | null> =>
  postGm('introduce-event', prompt);

/**
 * Ask the GM for a single-action review brief.
 * Prompt: action context, actor, net deltas, turn log.
 * Returns: player-facing review, or null for fallback.
 */
export const gmActionReview = (prompt: string): Promise<string | null> =>
  postGm('action-review', prompt);
