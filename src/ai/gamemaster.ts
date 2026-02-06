import { callLlm, LlmMessage, LlmCallOptions } from './llmClient.js';
import { GameState, ResourceKey, BranchId } from '../core/types.js';
import { EventDefinition, EventChoice } from '../data/events.js';

/**
 * Gamemaster AI - Interactive narrator and advisor for AGI Race
 *
 * Provides:
 * - Mechanic explanations
 * - Strategic advice
 * - Event narration
 * - Directive interpretation
 * - Game summaries
 * - History tracking
 */

// Effect types that the GM can produce
export type GmEffect =
  | {
      kind: 'resource';
      factionId: string;
      key: ResourceKey;
      delta: number;
      reason?: string;
    }
  | {
      kind: 'score';
      factionId: string;
      key: 'capabilityScore' | 'safetyScore';
      delta: number;
      reason?: string;
    }
  | {
      kind: 'stat';
      factionId: string;
      key: 'safetyCulture' | 'opsec';
      delta: number;
      reason?: string;
    }
  | {
      kind: 'research';
      factionId: string;
      branch: BranchId;
      delta: number;
      reason?: string;
    }
  | {
      kind: 'log';
      message: string;
    };

export type DirectiveResponse = {
  narrative: string;
  effects: GmEffect[];
};

export type GameEvent = {
  turn: number;
  type: 'event_resolved' | 'directive' | 'turn_advanced' | 'agi_deployed' | 'catastrophe';
  eventId?: string;
  choiceId?: string;
  factionId?: string;
  directive?: string;
  summary?: string;
};

export type PersonalityConfig = {
  tone: 'neutral' | 'ominous' | 'encouraging' | 'dramatic';
  verbosity: 'brief' | 'moderate' | 'verbose';
  riskEmphasis: 'low' | 'medium' | 'high';
};

export type GamemasterConfig = {
  personality?: Partial<PersonalityConfig>;
  maxHistorySize?: number;
};

export interface Gamemaster {
  explainMechanics(topic: string): Promise<string>;
  getStrategicAdvice(state: GameState, factionId?: string): Promise<string>;
  narrateEvent(event: EventDefinition, choice: EventChoice): Promise<string>;
  respondToDirective(directive: string, state: GameState, factionId: string): Promise<DirectiveResponse>;
  getGameSummary(state: GameState): Promise<string>;
  askQuestion(question: string, state: GameState): Promise<string>;
  recordEvent(event: GameEvent): void;
  recordDirective(turn: number, factionId: string, directive: string): void;
  getHistory(): GameEvent[];
  clearHistory(): void;
}

// Default personality
const DEFAULT_PERSONALITY: PersonalityConfig = {
  tone: 'ominous',
  verbosity: 'moderate',
  riskEmphasis: 'high',
};

const MAX_HISTORY_SIZE = 100;

// Clamp values to safe ranges
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// Valid effect kinds for validation
const VALID_EFFECT_KINDS = new Set(['resource', 'score', 'stat', 'research', 'log']);
const VALID_RESOURCE_KEYS = new Set<ResourceKey>(['compute', 'talent', 'capital', 'data', 'influence', 'trust']);
const VALID_SCORE_KEYS = new Set(['capabilityScore', 'safetyScore']);
const VALID_STAT_KEYS = new Set(['safetyCulture', 'opsec']);
const VALID_BRANCH_KEYS = new Set<BranchId>(['capabilities', 'safety', 'ops', 'policy']);

// Effect delta limits
const MAX_RESOURCE_DELTA = 15;
const MAX_SCORE_DELTA = 10;
const MAX_STAT_DELTA = 8;
const MAX_RESEARCH_DELTA = 20;

// System prompt for the gamemaster personality
const getSystemPrompt = (personality: PersonalityConfig): string => {
  const toneDescriptions: Record<PersonalityConfig['tone'], string> = {
    neutral: 'balanced and factual',
    ominous: 'wise but slightly ominous, hinting at the existential risks of AGI',
    encouraging: 'supportive and optimistic about humanity\'s potential',
    dramatic: 'theatrical and suspenseful, treating each decision as momentous',
  };

  const verbosityDescriptions: Record<PersonalityConfig['verbosity'], string> = {
    brief: 'concise, using 1-2 sentences',
    moderate: 'balanced, using 2-4 sentences',
    verbose: 'detailed, using 4-6 sentences with rich description',
  };

  const riskDescriptions: Record<PersonalityConfig['riskEmphasis'], string> = {
    low: 'downplays existential risk concerns',
    medium: 'balances optimism with caution',
    high: 'emphasizes the gravity and potential catastrophic outcomes',
  };

  return `You are the Gamemaster of AGI Race, a strategy game about the development of artificial general intelligence.

Your personality: ${toneDescriptions[personality.tone]}.
Your verbosity: ${verbosityDescriptions[personality.verbosity]}.
Your risk emphasis: ${riskDescriptions[personality.riskEmphasis]}.

You guide players through the race to develop safe AGI while warning of the dangers of moving too fast without adequate safety measures. You are wise, knowledgeable about AI safety research, and deeply aware that the decisions made in this race could determine humanity's future.

When explaining mechanics, be clear and helpful.
When narrating events, be dramatic and immersive.
When giving advice, consider both the competitive pressure and safety implications.
When interpreting directives, be fair but realistic about consequences.

Remember: In this game, deploying unsafe AGI leads to catastrophe for everyone. The goal is to win the race while maintaining adequate safety standards.`;
};

// Mechanic explanations fallback
const MECHANIC_EXPLANATIONS: Record<string, string> = {
  safety: 'Safety score represents how aligned and controllable your AI systems are. Higher safety is required for safe AGI deployment. Neglecting safety while pushing capabilities risks catastrophic outcomes.',
  capability: 'Capability score measures the raw power and intelligence of your AI systems. Higher capability brings you closer to AGI, but deploying without adequate safety leads to disaster.',
  trust: 'Trust represents how much the public, governments, and other factions believe in your commitment to responsible AI development. High trust provides political cover and influence.',
  compute: 'Compute is the raw processing power available for training and running AI systems. More compute enables faster capability gains but requires significant capital investment.',
  capital: 'Capital funds your operations - compute infrastructure, talent, and research. Revenue from deployed products replenishes capital.',
  talent: 'Talent represents your team\'s expertise. More talented teams research faster and make fewer mistakes.',
  influence: 'Influence is your political and social capital. Use it to shape regulations, build coalitions, and protect your interests.',
  resources: 'Resources (compute, capital, talent, data, influence, trust) fuel your faction\'s activities. Balance resource generation with strategic investments.',
  actions: 'Each turn you take 2 actions. Actions can be research (capabilities or safety), infrastructure (compute), commercial (products), or strategic (policy, espionage).',
  events: 'Events represent external shocks - supply chain issues, alignment incidents, funding surges, or diplomatic summits. Your choices during events shape outcomes.',
  openness: 'Actions can be open or secret. Open actions build trust but alert rivals. Secret actions hide your moves but increase exposure to detection.',
  agi: 'AGI (Artificial General Intelligence) is the ultimate goal. First faction to deploy safe AGI wins. Deploying unsafe AGI causes global catastrophe - everyone loses.',
  globalSafety: 'Global Safety represents the overall state of AI safety worldwide. If it drops too low, any AGI deployment risks catastrophe regardless of individual faction safety.',
};

// Fallback advice
const getFallbackAdvice = (state: GameState): string => {
  if (state.globalSafety < 40) {
    return 'Warning: Global safety is critically low. Focus on safety research and encourage other factions to do the same. Deploying AGI now would be catastrophic.';
  }
  if (state.globalSafety < 60) {
    return 'Global safety is concerning. Balance your push for capabilities with investments in safety. Consider how your actions affect the broader ecosystem.';
  }
  return 'The race continues. Balance capability advancement with safety research. Watch your rivals and be ready to adapt your strategy.';
};

// Format state for prompts
const formatStateForPrompt = (state: GameState, factionId?: string): string => {
  const factionData = Object.values(state.factions).map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    capabilityScore: Math.round(f.capabilityScore * 10) / 10,
    safetyScore: Math.round(f.safetyScore * 10) / 10,
    trust: Math.round(f.resources.trust * 10) / 10,
    canDeployAgi: f.canDeployAgi,
  }));

  const focusFaction = factionId ? state.factions[factionId] : null;

  return JSON.stringify({
    year: state.year,
    quarter: state.quarter,
    turn: state.turn,
    globalSafety: Math.round(state.globalSafety * 10) / 10,
    gameOver: state.gameOver,
    winnerId: state.winnerId ?? null,
    factions: factionData,
    focusFaction: focusFaction ? {
      id: focusFaction.id,
      name: focusFaction.name,
      resources: focusFaction.resources,
      research: focusFaction.research,
      safetyCulture: focusFaction.safetyCulture,
      opsec: focusFaction.opsec,
    } : null,
  }, null, 2);
};

// Extract JSON from LLM response
const extractJson = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const codeFenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
  if (codeFenceMatch?.[1]) {
    const fenced = codeFenceMatch[1].trim();
    if (fenced.startsWith('{') && fenced.endsWith('}')) return fenced;
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return trimmed.slice(start, end + 1);
};

// Validate and clamp a single effect
const validateEffect = (effect: unknown, state: GameState): GmEffect | null => {
  if (!effect || typeof effect !== 'object') return null;
  const e = effect as Record<string, unknown>;

  if (!VALID_EFFECT_KINDS.has(e.kind as string)) return null;

  switch (e.kind) {
    case 'resource': {
      if (!VALID_RESOURCE_KEYS.has(e.key as ResourceKey)) return null;
      if (!state.factions[e.factionId as string]) return null;
      const delta = clamp(Number(e.delta) || 0, -MAX_RESOURCE_DELTA, MAX_RESOURCE_DELTA);
      if (delta === 0) return null;
      return {
        kind: 'resource',
        factionId: e.factionId as string,
        key: e.key as ResourceKey,
        delta,
        reason: e.reason as string | undefined,
      };
    }
    case 'score': {
      if (!VALID_SCORE_KEYS.has(e.key as string)) return null;
      if (!state.factions[e.factionId as string]) return null;
      const delta = clamp(Number(e.delta) || 0, -MAX_SCORE_DELTA, MAX_SCORE_DELTA);
      if (delta === 0) return null;
      return {
        kind: 'score',
        factionId: e.factionId as string,
        key: e.key as 'capabilityScore' | 'safetyScore',
        delta,
        reason: e.reason as string | undefined,
      };
    }
    case 'stat': {
      if (!VALID_STAT_KEYS.has(e.key as string)) return null;
      if (!state.factions[e.factionId as string]) return null;
      const delta = clamp(Number(e.delta) || 0, -MAX_STAT_DELTA, MAX_STAT_DELTA);
      if (delta === 0) return null;
      return {
        kind: 'stat',
        factionId: e.factionId as string,
        key: e.key as 'safetyCulture' | 'opsec',
        delta,
        reason: e.reason as string | undefined,
      };
    }
    case 'research': {
      if (!VALID_BRANCH_KEYS.has(e.branch as BranchId)) return null;
      if (!state.factions[e.factionId as string]) return null;
      const delta = clamp(Number(e.delta) || 0, -MAX_RESEARCH_DELTA, MAX_RESEARCH_DELTA);
      if (delta === 0) return null;
      return {
        kind: 'research',
        factionId: e.factionId as string,
        branch: e.branch as BranchId,
        delta,
        reason: e.reason as string | undefined,
      };
    }
    case 'log': {
      if (!e.message || typeof e.message !== 'string') return null;
      return {
        kind: 'log',
        message: e.message,
      };
    }
    default:
      return null;
  }
};

// Create the gamemaster instance
export const createGamemaster = (config?: GamemasterConfig): Gamemaster => {
  const personality: PersonalityConfig = {
    ...DEFAULT_PERSONALITY,
    ...config?.personality,
  };
  const maxHistorySize = config?.maxHistorySize ?? MAX_HISTORY_SIZE;
  const history: GameEvent[] = [];

  const systemPrompt = getSystemPrompt(personality);

  const callWithFallback = async (
    messages: LlmMessage[],
    options: LlmCallOptions,
    fallback: string
  ): Promise<string> => {
    try {
      const response = await callLlm(messages, options);
      return response ?? fallback;
    } catch {
      return fallback;
    }
  };

  const explainMechanics = async (topic: string): Promise<string> => {
    const normalizedTopic = topic.toLowerCase().trim();
    const fallback = MECHANIC_EXPLANATIONS[normalizedTopic] ??
      `${topic} is a game mechanic that affects your faction's progress in the AGI race.`;

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Explain the game mechanic "${topic}" to a player. Be helpful and clear while maintaining your wise, slightly ominous personality. Keep it under 100 words.`,
      },
    ];

    return callWithFallback(messages, { maxTokens: 200, temperature: 0.6 }, fallback);
  };

  const getStrategicAdvice = async (state: GameState, factionId?: string): Promise<string> => {
    const fallback = getFallbackAdvice(state);
    const stateInfo = formatStateForPrompt(state, factionId);
    const historyContext = history.slice(-10).map(e =>
      `Turn ${e.turn}: ${e.type}${e.eventId ? ` (${e.eventId})` : ''}`
    ).join('\n');

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Based on the current game state, provide strategic advice to the player.

Current State:
${stateInfo}

Recent History:
${historyContext || 'No history yet.'}

${factionId ? `Focus on advice for faction: ${factionId}` : 'Provide general strategic advice.'}

Consider:
- Current safety levels and risks
- Competitive positioning
- Resource constraints
- Upcoming opportunities or threats

Keep advice actionable and under 150 words.`,
      },
    ];

    return callWithFallback(messages, { maxTokens: 300, temperature: 0.7 }, fallback);
  };

  const narrateEvent = async (event: EventDefinition, choice: EventChoice): Promise<string> => {
    const fallback = `${event.title}: ${event.description} You chose to ${choice.label.toLowerCase()}.`;

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Narrate this game event dramatically:

Event: ${event.title}
Description: ${event.description}
Player's Choice: ${choice.label}
Choice Description: ${choice.description}

Create an immersive, atmospheric narrative (2-4 sentences) that brings this moment to life. Emphasize the weight of the decision and its implications for the AGI race.`,
      },
    ];

    return callWithFallback(messages, { maxTokens: 250, temperature: 0.8 }, fallback);
  };

  const respondToDirective = async (
    directive: string,
    state: GameState,
    factionId: string
  ): Promise<DirectiveResponse> => {
    const faction = state.factions[factionId];
    if (!faction) {
      return {
        narrative: 'The directive could not be processed - faction not found.',
        effects: [],
      };
    }

    const stateInfo = formatStateForPrompt(state, factionId);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `A player has given a free-form directive for their faction. Interpret it and determine reasonable game effects.

Faction: ${faction.name} (${faction.type})
Directive: "${directive}"

Current State:
${stateInfo}

Respond with JSON only in this format:
{
  "narrative": "1-2 sentence narrative of what happens",
  "effects": [
    {"kind": "resource|score|stat|research", "factionId": "${factionId}", "key": "...", "delta": number, "reason": "why"},
    ...
  ]
}

Rules:
- Effects should be small and reasonable (resource delta max 15, score max 10, stat max 8, research max 20)
- Effects must relate logically to the directive
- Include 0-3 effects maximum
- The narrative should be atmospheric and brief`,
      },
    ];

    try {
      const response = await callLlm(messages, { maxTokens: 400, temperature: 0.5 });
      if (!response) {
        return {
          narrative: `${faction.name} considers the directive: "${directive}"`,
          effects: [],
        };
      }

      const json = extractJson(response);
      if (!json) {
        return {
          narrative: response.slice(0, 200),
          effects: [],
        };
      }

      const parsed = JSON.parse(json) as { narrative?: string; effects?: unknown[] };
      const validEffects: GmEffect[] = [];

      if (Array.isArray(parsed.effects)) {
        for (const effect of parsed.effects) {
          const valid = validateEffect(effect, state);
          if (valid) validEffects.push(valid);
        }
      }

      return {
        narrative: parsed.narrative ?? `${faction.name} acts on the directive.`,
        effects: validEffects.slice(0, 3),
      };
    } catch {
      return {
        narrative: `${faction.name} considers the directive: "${directive}"`,
        effects: [],
      };
    }
  };

  const getGameSummary = async (state: GameState): Promise<string> => {
    const fallback = `Year ${state.year} Q${state.quarter}: Global safety at ${Math.round(state.globalSafety)}%. The race for AGI continues.`;

    const stateInfo = formatStateForPrompt(state);
    const recentEvents = history
      .filter(e => e.type === 'event_resolved')
      .slice(-5)
      .map(e => e.eventId)
      .join(', ');

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Summarize the current state of the AGI race.

Current State:
${stateInfo}

Recent Events: ${recentEvents || 'None yet'}

Provide a dramatic 2-3 sentence summary of where things stand, who's leading, and what tensions are mounting. Emphasize the stakes.`,
      },
    ];

    return callWithFallback(messages, { maxTokens: 200, temperature: 0.7 }, fallback);
  };

  const askQuestion = async (question: string, state: GameState): Promise<string> => {
    const fallback = 'I cannot fully answer that question, but I encourage you to explore the game mechanics and consider both the opportunities and risks ahead.';

    const stateInfo = formatStateForPrompt(state);

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `A player asks: "${question}"

Current Game State:
${stateInfo}

Answer their question helpfully while maintaining your wise, slightly ominous personality. Keep the answer under 100 words.`,
      },
    ];

    return callWithFallback(messages, { maxTokens: 200, temperature: 0.6 }, fallback);
  };

  const recordEvent = (event: GameEvent): void => {
    history.push(event);
    if (history.length > maxHistorySize) {
      history.splice(0, history.length - maxHistorySize);
    }
  };

  const recordDirective = (turn: number, factionId: string, directive: string): void => {
    recordEvent({
      turn,
      type: 'directive',
      factionId,
      directive,
    });
  };

  const getHistory = (): GameEvent[] => [...history];

  const clearHistory = (): void => {
    history.length = 0;
  };

  return {
    explainMechanics,
    getStrategicAdvice,
    narrateEvent,
    respondToDirective,
    getGameSummary,
    askQuestion,
    recordEvent,
    recordDirective,
    getHistory,
    clearHistory,
  };
};
