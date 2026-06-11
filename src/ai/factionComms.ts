import type { GameState } from '../core/types.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { callLlm, type LlmMessage } from './llmClient.js';
import { extractJsonSnippet } from './llmParsing.js';

export type FactionCommsMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

const DEFAULT_COMMS_MODEL = 'google/gemini-3-flash';
const UNAVAILABLE_REPLY = 'Channel unstable. We cannot commit to a response right now.';

const readFactionCommsModel = (): string => {
  try {
    const envModel = (import.meta as { env?: Record<string, string> }).env?.VITE_FACTION_COMMS_MODEL;
    if (envModel && envModel.trim()) return envModel.trim();
  } catch {
    // No-op when import.meta.env is unavailable.
  }
  return DEFAULT_COMMS_MODEL;
};

const pickReplyField = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  for (const key of ['reply', 'answer', 'text', 'message']) {
    const candidate = obj[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
};

const sanitizeReply = (reply: string): string | null => {
  const normalized = reply.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (/^(json|n\/a|null|undefined)$/i.test(normalized)) return null;
  return normalized;
};

const fallbackReply = (state: GameState, targetFactionId: string): string => {
  const faction = state.factions[targetFactionId];
  if (!faction) return UNAVAILABLE_REPLY;

  if (state.globalSafety < 40) {
    return `${faction.name}: Global safety is deteriorating. We can discuss limited coordination on safety controls.`;
  }
  if (faction.resources.trust < 40) {
    return `${faction.name}: Our trust position is fragile. Any agreement must protect our public standing.`;
  }
  if (faction.type === 'government') {
    return `${faction.name}: We are open to dialogue, but policy enforcement remains on the table.`;
  }
  return `${faction.name}: We acknowledge your message. We may cooperate if incentives and safety terms are credible.`;
};

export const getFactionChatReply = async (
  state: GameState,
  playerFactionId: string,
  targetFactionId: string,
  playerMessage: string,
  history: FactionCommsMessage[],
): Promise<string> => {
  const targetFaction = state.factions[targetFactionId];
  const playerFaction = state.factions[playerFactionId];
  if (!targetFaction || !playerFaction) return UNAVAILABLE_REPLY;

  const strategy = FACTION_TEMPLATES.find((item) => item.id === targetFactionId)?.strategy ?? null;
  const recentHistory = history.slice(-8).map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

  const payload = {
    instruction:
      'Reply as the target faction representative. Keep it concise and in-world. Return JSON only {"reply":"..."}',
    roleBoundary:
      'You are faction comms, not the Gamemaster and not the action decision engine.',
    turn: { year: state.year, quarter: state.quarter, index: state.turn },
    globalSafety: Math.round(state.globalSafety * 10) / 10,
    playerFaction: {
      id: playerFaction.id,
      name: playerFaction.name,
      type: playerFaction.type,
    },
    targetFaction: {
      id: targetFaction.id,
      name: targetFaction.name,
      type: targetFaction.type,
      strategy,
      capabilityScore: Math.round(targetFaction.capabilityScore * 10) / 10,
      safetyScore: Math.round(targetFaction.safetyScore * 10) / 10,
      trust: Math.round(targetFaction.resources.trust * 10) / 10,
      influence: Math.round(targetFaction.resources.influence * 10) / 10,
    },
    recentHistory,
    latestPlayerMessage: playerMessage,
    constraints: [
      '1-3 sentences max.',
      'No markdown, no bullets.',
      'No references to prompts or internal reasoning.',
      'No commitments that violate faction incentives.',
    ],
  };

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content:
        'You are a strategic faction diplomat in AGI Race. Output JSON only with a single reply field.',
    },
    {
      role: 'user',
      content: JSON.stringify(payload),
    },
  ];

  try {
    const raw = await callLlm(messages, {
      model: readFactionCommsModel(),
      maxTokens: 180,
      temperature: 0.6,
      topP: 0.85,
      reasoningEffort: 'none',
      responseFormat: { type: 'json_object' },
    });
    if (!raw) return fallbackReply(state, targetFactionId);

    const snippet = extractJsonSnippet(raw, 'object');
    if (!snippet) return fallbackReply(state, targetFactionId);
    const parsed = JSON.parse(snippet);
    const reply = pickReplyField(parsed);
    const clean = reply ? sanitizeReply(reply) : null;
    return clean ?? fallbackReply(state, targetFactionId);
  } catch {
    return fallbackReply(state, targetFactionId);
  }
};
