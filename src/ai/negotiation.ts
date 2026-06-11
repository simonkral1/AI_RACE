import type { GameState } from '../core/types.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { callLlm, type LlmMessage } from './llmClient.js';
import { extractJsonSnippet } from './llmParsing.js';
import { agentNegotiate, agentRespond } from './agentClient.js';

/**
 * Negotiation phase: each turn, before factions decide actions, every AI
 * faction sends one diplomatic message to a counterpart of its choice.
 * Messages are visible on the world map as comms arcs, shown in the
 * diplomacy feed, and fed into each faction's decision context so the
 * talks actually influence what factions do.
 */

export type NegotiationIntent =
  | 'propose_alliance'
  | 'coordinate_safety'
  | 'offer_cooperation'
  | 'warn'
  | 'demand'
  | 'probe'
  // Synthetic intents emitted by the consent flow, not by agents directly
  | 'alliance_formed'
  | 'alliance_declined';

export type NegotiationExchange = {
  turn: number;
  fromFactionId: string;
  toFactionId: string;
  intent: NegotiationIntent;
  message: string;
};

const DEFAULT_NEGOTIATION_MODEL = 'google/gemini-3-flash';
const VALID_INTENTS = new Set<NegotiationIntent>([
  'propose_alliance',
  'coordinate_safety',
  'offer_cooperation',
  'warn',
  'demand',
  'probe',
]);

const readNegotiationModel = (): string => {
  try {
    const envModel = (import.meta as { env?: Record<string, string> }).env?.VITE_NEGOTIATION_MODEL;
    if (envModel && envModel.trim()) return envModel.trim();
  } catch {
    // No-op when import.meta.env is unavailable.
  }
  return DEFAULT_NEGOTIATION_MODEL;
};

const tensionKey = (a: string, b: string): string => [a, b].sort().join(':');

const getPairTension = (state: GameState, a: string, b: string): number =>
  state.tensions.get(tensionKey(a, b)) ?? 0;

const isAllied = (state: GameState, a: string, b: string): boolean =>
  (state.alliances.get(a) ?? []).includes(b) || (state.alliances.get(b) ?? []).includes(a);

const round = (value: number): number => Math.round(value * 10) / 10;

const buildNegotiationPrompt = (state: GameState, factionId: string): string => {
  const faction = state.factions[factionId];
  const strategy = FACTION_TEMPLATES.find((item) => item.id === factionId)?.strategy ?? null;
  const counterparts = Object.values(state.factions)
    .filter((f) => f.id !== factionId)
    .map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      capabilityScore: round(f.capabilityScore),
      safetyScore: round(f.safetyScore),
      trust: round(f.resources.trust),
      influence: round(f.resources.influence),
      tensionWithYou: round(getPairTension(state, factionId, f.id)),
      alliedWithYou: isAllied(state, factionId, f.id),
    }));

  const payload = {
    instruction:
      'It is the diplomatic phase. Choose ONE counterpart and send one in-world diplomatic message. '
      + 'Return JSON only as {"to":"<factionId>","intent":"propose_alliance|coordinate_safety|offer_cooperation|warn|demand|probe","message":"..."}.',
    roleBoundary:
      'You are this faction\'s diplomat, not the Gamemaster and not the action decision engine.',
    constraints: [
      'message: 1-2 sentences, in-world, no markdown.',
      'Pick the counterpart where diplomacy matters most this quarter (high tension, alliance upkeep, safety risk, or strategic opportunity).',
      'Stay true to faction incentives; do not promise what the faction would not do.',
    ],
    turn: { year: state.year, quarter: state.quarter, index: state.turn },
    globalSafety: round(state.globalSafety),
    you: {
      id: faction.id,
      name: faction.name,
      type: faction.type,
      strategy,
      capabilityScore: round(faction.capabilityScore),
      safetyScore: round(faction.safetyScore),
      trust: round(faction.resources.trust),
      influence: round(faction.resources.influence),
    },
    counterparts,
  };

  return JSON.stringify(payload);
};

/** Deterministic message used when the LLM is unavailable (e.g. ?no_llm=1). */
const fallbackExchange = (state: GameState, factionId: string): NegotiationExchange | null => {
  const faction = state.factions[factionId];
  if (!faction) return null;

  const others = Object.values(state.factions).filter((f) => f.id !== factionId);
  if (!others.length) return null;

  // Highest-tension counterpart first; otherwise the capability leader.
  const byTension = [...others].sort(
    (a, b) => getPairTension(state, factionId, b.id) - getPairTension(state, factionId, a.id),
  );
  const top = byTension[0];
  const topTension = getPairTension(state, factionId, top.id);

  if (topTension >= 40) {
    return {
      turn: state.turn,
      fromFactionId: factionId,
      toFactionId: top.id,
      intent: 'warn',
      message: `${faction.name} to ${top.name}: Tensions are escalating. Stand down on hostile moves or expect a response.`,
    };
  }

  if (state.globalSafety < 50) {
    const partner = others.find((f) => f.type === 'government') ?? top;
    return {
      turn: state.turn,
      fromFactionId: factionId,
      toFactionId: partner.id,
      intent: 'coordinate_safety',
      message: `${faction.name} to ${partner.name}: Global safety is slipping. We propose shared evaluations and incident reporting this quarter.`,
    };
  }

  const leader = [...others].sort((a, b) => b.capabilityScore - a.capabilityScore)[0];
  return {
    turn: state.turn,
    fromFactionId: factionId,
    toFactionId: leader.id,
    intent: 'probe',
    message: `${faction.name} to ${leader.name}: We are watching your progress with interest. Is there room for limited cooperation on terms that hold?`,
  };
};

const coerceExchange = (
  parsed: { to?: unknown; intent?: unknown; message?: unknown },
  state: GameState,
  factionId: string,
): NegotiationExchange | null => {
  const to = String(parsed.to ?? '').trim();
  const message = String(parsed.message ?? '').replace(/\s+/g, ' ').trim();
  const intent = String(parsed.intent ?? '').trim() as NegotiationIntent;
  if (!to || to === factionId || !state.factions[to]) return null;
  if (!message) return null;
  return {
    turn: state.turn,
    fromFactionId: factionId,
    toFactionId: to,
    intent: VALID_INTENTS.has(intent) ? intent : 'probe',
    message,
  };
};

const parseExchange = (
  raw: string,
  state: GameState,
  factionId: string,
): NegotiationExchange | null => {
  const snippet = extractJsonSnippet(raw, 'object');
  if (!snippet) return null;
  try {
    const parsed = JSON.parse(snippet) as { to?: unknown; intent?: unknown; message?: unknown };
    return coerceExchange(parsed, state, factionId);
  } catch {
    return null;
  }
};

const negotiateForFaction = async (
  state: GameState,
  factionId: string,
): Promise<NegotiationExchange | null> => {
  // Primary path: the faction's persistent Claude agent (Sonnet, medium effort)
  const agentOutput = await agentNegotiate(factionId, buildNegotiationPrompt(state, factionId));
  if (agentOutput) {
    const exchange = coerceExchange(agentOutput, state, factionId);
    if (exchange) return exchange;
  }

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content:
        'You are a strategic faction diplomat in AGI Race. Output JSON only with to, intent, and message fields.',
    },
    { role: 'user', content: buildNegotiationPrompt(state, factionId) },
  ];

  try {
    const raw = await callLlm(messages, {
      model: readNegotiationModel(),
      maxTokens: 180,
      temperature: 0.7,
      topP: 0.85,
      reasoningEffort: 'none',
      responseFormat: { type: 'json_object' },
      timeoutMs: 20_000,
    });
    if (!raw) return fallbackExchange(state, factionId);
    return parseExchange(raw, state, factionId) ?? fallbackExchange(state, factionId);
  } catch {
    return fallbackExchange(state, factionId);
  }
};

/**
 * Run the diplomatic phase for all AI factions in parallel.
 * The player faction does not auto-send; the player speaks through
 * directives and the faction chat instead.
 */
export const runNegotiationPhase = async (
  state: GameState,
  playerFactionId: string,
  onExchange?: (exchange: NegotiationExchange) => void,
): Promise<NegotiationExchange[]> => {
  const aiFactionIds = Object.keys(state.factions).filter((id) => id !== playerFactionId);
  const results = await Promise.all(aiFactionIds.map(async (id) => {
    const exchange = await negotiateForFaction(state, id);
    if (exchange && onExchange) onExchange(exchange);
    return exchange;
  }));
  return results.filter((item): item is NegotiationExchange => item !== null);
};

/**
 * Format the exchanges a faction can see (sent or received) as context
 * for its action-decision prompt.
 */
export type AllianceConsent = {
  accept: boolean;
  reply: string;
};

/**
 * Ask a faction's agent whether it accepts an alliance proposal.
 * The agent's persistent session remembers prior dealings with the proposer.
 * Deterministic fallback (no LLM): accept when tension with the proposer is low.
 */
export const requestAllianceConsent = async (
  state: GameState,
  proposerId: string,
  targetId: string,
  proposalMessage: string,
): Promise<AllianceConsent> => {
  const proposer = state.factions[proposerId];
  const target = state.factions[targetId];
  const tension = getPairTension(state, proposerId, targetId);

  const fallback: AllianceConsent = tension < 25
    ? {
      accept: true,
      reply: `${target?.name ?? targetId}: We accept. Aligned interests make this alliance worthwhile — for now.`,
    }
    : {
      accept: false,
      reply: `${target?.name ?? targetId}: Declined. Current tensions make an alliance unworkable.`,
    };

  if (!proposer || !target) return { accept: false, reply: 'Proposal could not be delivered.' };

  const prompt = JSON.stringify({
    proposal: {
      from: { id: proposer.id, name: proposer.name, type: proposer.type },
      message: proposalMessage,
      kind: 'formal_alliance',
      effect: 'Allies gain mutual trust benefits each quarter; alliances are public.',
    },
    yourSituation: {
      tensionWithProposer: round(tension),
      alreadyAllied: isAllied(state, proposerId, targetId),
      globalSafety: round(state.globalSafety),
      trust: round(target.resources.trust),
    },
    instruction: 'Accept only if the alliance serves your faction. Return JSON {"accept": true|false, "reply": "..."}.',
  });

  const output = await agentRespond(targetId, prompt);
  if (output && typeof output.accept === 'boolean') {
    const reply = String(output.reply ?? '').replace(/\s+/g, ' ').trim();
    return { accept: output.accept, reply: reply || fallback.reply };
  }
  return fallback;
};

export const buildNegotiationContext = (
  exchanges: NegotiationExchange[],
  state: GameState,
  factionId: string,
): string | undefined => {
  const visible = exchanges.filter(
    (item) => item.fromFactionId === factionId || item.toFactionId === factionId,
  );
  if (!visible.length) return undefined;
  const lines = visible.map((item) => {
    const from = state.factions[item.fromFactionId]?.name ?? item.fromFactionId;
    const to = state.factions[item.toFactionId]?.name ?? item.toFactionId;
    return `[diplomacy] ${from} -> ${to} (${item.intent}): ${item.message}`;
  });
  return lines.join('\n');
};
