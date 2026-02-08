import { GameState, ResourceKey, BranchId } from '../core/types.js';
import { EventDefinition, EventChoice } from '../data/events.js';
import { callLlm, LlmMessage, LlmCallOptions } from './llmClient.js';
import { extractJsonSnippet } from './llmParsing.js';

const GENERIC_TEXT_FALLBACK = 'The AGI race continues. Choose your path wisely.';

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
  /** Generate a D&D-style opening narration when the game starts */
  generateOpeningNarration(state: GameState, factionId: string): Promise<string>;
  /** Narrate what happened during a turn — GM summarizes player and AI actions */
  narrateTurnSummary(state: GameState, factionId: string, turnLog: string[]): Promise<string>;
  /** Introduce an event before the player makes a choice — GM sets the scene */
  introduceEvent(event: EventDefinition, state: GameState, factionId: string): Promise<string>;
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

type GmTextKind = 'mechanic' | 'advice' | 'event' | 'summary' | 'question' | 'opening' | 'turn' | 'eventIntro';

type TextOutputConfig = {
  kind: GmTextKind;
  maxWords: number;
  maxSentences: number;
  requireActionable?: boolean;
};

type SanitizeOptions = {
  jsonOnly?: boolean;
};

const DIRECTIVE_FALLBACK_NARRATIVE = 'Directive acknowledged, but no additional effects were applied.';

// Smart template-based responses when LLM is unavailable
const TEMPLATE_RESPONSES = {
  mechanic: {
    safety: 'Safety score represents your alignment research progress. Higher safety reduces catastrophe risk when deploying AGI. Balance capability gains with adequate safety investment.',
    capability: 'Capability score tracks your AI advancement. Higher capability brings you closer to AGI but increases global risk. The first to deploy safe AGI wins.',
    actions: 'Each turn you can research capabilities, invest in safety, build compute, or deploy products. Choose wisely — every action has trade-offs.',
    trust: 'Public trust affects your funding and freedom to operate. Scandals or unsafe practices erode trust. Open research and safety focus build it.',
    default: 'This mechanic affects how your faction competes in the AGI race. Balance short-term gains against long-term safety.',
  },
  advice: (state: GameState, factionId?: string) => {
    const faction = factionId ? state.factions[factionId] : null;
    if (!faction) return 'Focus on building a balanced portfolio of capability and safety research.';

    const safetyGap = faction.capabilityScore - faction.safetyScore;
    if (safetyGap > 20) return 'Warning: Your capability far outpaces safety. Prioritize alignment research or risk catastrophe.';
    if (faction.resources.trust < 40) return 'Your public trust is dangerously low. Consider open research or a PR campaign.';
    if (faction.resources.compute < 30) return 'Compute constraints are limiting progress. Invest in infrastructure.';
    if (state.globalSafety < 40) return 'Global safety is critical. Consider coordinating with other factions on safety standards.';
    return 'You are in a reasonable position. Continue balanced investment in capability and safety.';
  },
  summary: (state: GameState) => {
    const leaders = Object.values(state.factions).sort((a, b) => b.capabilityScore - a.capabilityScore);
    const leader = leaders[0];
    const safetyLevel = state.globalSafety < 40 ? 'dangerously low' : state.globalSafety < 60 ? 'concerning' : 'adequate';
    return `${state.year} Q${state.quarter}: ${leader.name} leads the capability race. Global safety is ${safetyLevel} at ${Math.round(state.globalSafety)}%. The stakes grow higher each turn.`;
  },
  opening: (state: GameState, factionId: string) => {
    const faction = state.factions[factionId];
    if (!faction) return 'The race for AGI begins. Choose your path wisely.';
    const role = faction.type === 'lab' ? 'an AI research laboratory' : 'a government authority';
    return `The year is ${state.year}. You lead ${faction.name}, ${role} competing in humanity's most consequential race. Your decisions in the coming quarters will shape the future of artificial general intelligence. Will you prioritize speed, safety, or seek a careful balance? The choice — and its consequences — are yours.`;
  },
  eventIntro: (event: EventDefinition) => {
    return `A critical moment: ${event.title}. ${event.description} Consider your options carefully — each choice carries weight.`;
  },
  turnSummary: (state: GameState) => {
    return `Quarter ${state.quarter} of ${state.year} concludes. The race continues. Global safety stands at ${Math.round(state.globalSafety)}%.`;
  },
};

const LEAK_PATTERNS: RegExp[] = [
  /\bthe user\b/i,
  /\bthe player\b/i,
  /\bi need to\b/i,
  /\bneed to\b/i,
  /\bi should\b/i,
  /\blet me\b/i,
  /\blet'?s see\b/i,
  /\blet me think\b/i,
  /\bi have to\b/i,
  /\bmy response\b/i,
  /\bmy personality\b/i,
  /\bkeep (?:it|this) under\b/i,
  /\bunder \d+\s*words?\b/i,
  /\bprompt\b/i,
  /\binstruction(?:s)?\b/i,
  /\blooking at the draft\b/i,
  /\bthe original response\b/i,
  /\boriginal response\b/i,
  /\brewrite this draft\b/i,
  /\bthe json shows\b/i,
  /\bjson shows\b/i,
  /\bcheck (?:the )?(?:current )?game state\b/i,
  /\bthe game state shows\b/i,
  /\bthe current state shows\b/i,
  /\bcurrent state shows\b/i,
  /\bword count\b/i,
  /\bverbosity\b/i,
  /\brisk emphasis\b/i,
  /\bthen mention\b/i,
  /\bmention that\b/i,
  /\bemphasize\b/i,
  /\blooking at\b/i,
  /\bmaybe (?:say|mention)\b/i,
  /\bmaybe point out\b/i,
  /\bso maybe\b/i,
  /\bmaybe:\s*["']/i,
  /\bthat'?s a basic (?:math|question)\b/i,
  /\bsimple math question\b/i,
  /\bthe answer (?:has to|should)\b/i,
  /\banswer must be\b/i,
  /\bshould tie into\b/i,
  /\bcheck the rules\b/i,
  /\bjust the answer\b/i,
  /\bfirst,\s*the answer is\b/i,
  /\bshould be straightforward\b/i,
  /\bthe question itself\b/i,
  /\bsource text\b/i,
  /\bexample response\b/i,
  /\bhow to phrase\b/i,
  /\bpersonality is\b/i,
  /\bgame(?:'s)? personality\b/i,
  /\blike,\s*["']/i,
  /\bit'?s probably\b/i,
  /\bhmm\b/i,
  /\bhere'?s a draft\b/i,
  /\bmaybe something like\b/i,
  /\bshould i\b/i,
  /\bfirst,\s*define\b/i,
  /\bfirst,\s*check\b/i,
  /\bkey points\b/i,
  /\bwait,\s*the\b/i,
];

const STATE_DUMP_PATTERNS: RegExp[] = [
  /\b(?:the\s+)?year is\b/i,
  /\bturn\s*\d+\b/i,
  /\bthe factions\b/i,
  /\bglobal safety is\b/i,
  /\blooking at (?:their|the) resources\b/i,
  /\bnone can deploy agi yet\b/i,
  /\bq[1-4]\b/i,
];

const ANSWER_KEYS = ['answer', 'text', 'response', 'narrative', 'message'] as const;
const ADVICE_ACTION_PATTERNS: RegExp[] = [
  /\bshould\b/i,
  /\bfocus on\b/i,
  /\bprioriti[sz]e\b/i,
  /\bconsider\b/i,
  /\bavoid\b/i,
  /\binvest\b/i,
  /\bbuild\b/i,
  /\bshift\b/i,
  /\bwarning\b/i,
  /\brisk\b/i,
  /\bcatastroph(?:e|ic)\b/i,
];

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

const splitIntoSentences = (text: string): string[] => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  const chunks = normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9"'`])/);
  return chunks.map((chunk) => chunk.trim()).filter(Boolean);
};

const sentenceLooksLeaky = (sentence: string): boolean => {
  const trimmed = sentence.trim();
  if (!trimmed) return true;
  return LEAK_PATTERNS.some((pattern) => pattern.test(trimmed));
};

const looksLikeStateDump = (text: string): boolean => {
  const hits = STATE_DUMP_PATTERNS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
  return hits >= 2;
};

const withWordLimit = (text: string, maxWords: number): string => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}.`;
};

const normalizeOutputPunctuation = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const isLowInformation = (text: string): boolean => {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) return true;
  if (normalized === 'text.' || normalized === 'text') return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length <= 2) {
    if (/^\d+(?:\.\d+)?[.!?]?$/.test(normalized)) return false;
    return true;
  }
  return false;
};

const pickAnswerField = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;

  for (const key of ANSWER_KEYS) {
    const candidate = obj[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  if (obj.output && typeof obj.output === 'object') {
    return pickAnswerField(obj.output);
  }

  return null;
};

const extractCandidateText = (raw: string, options?: SanitizeOptions): string | null => {
  const jsonOnly = options?.jsonOnly ?? false;
  const jsonSnippet = extractJsonSnippet(raw, 'object');
  if (jsonSnippet) {
    try {
      const parsed = JSON.parse(jsonSnippet);
      const answer = pickAnswerField(parsed);
      if (answer) return answer;
    } catch {
      // Fall through to raw text path
    }
  }
  return jsonOnly ? null : raw;
};

const sanitizePlayerFacingText = (
  raw: string,
  config: TextOutputConfig,
  options?: SanitizeOptions,
): string | null => {
  const candidate = extractCandidateText(raw, options);
  if (!candidate) return null;

  const normalized = normalizeWhitespace(candidate).replace(/^["'`]+|["'`]+$/g, '');
  if (!normalized) return null;

  const sentences = splitIntoSentences(normalized);
  if (!sentences.length) return null;

  const filtered = sentences.filter((sentence) => !sentenceLooksLeaky(sentence));
  const removedCount = sentences.length - filtered.length;
  if (removedCount > 0 && filtered.length <= Math.floor(sentences.length / 2)) {
    const salvage = normalizeWhitespace(filtered.join(' '));
    const salvageWords = salvage.split(/\s+/).filter(Boolean).length;
    if (!salvage || salvageWords < 10 || looksLikeStateDump(salvage)) return null;
  }
  const selected = (filtered.length > 0 ? filtered : sentences).slice(0, config.maxSentences);
  if (!selected.length) return null;

  const merged = normalizeWhitespace(selected.join(' '));
  if (!merged) return null;
  if (LEAK_PATTERNS.some((pattern) => pattern.test(merged))) return null;
  if ((config.kind === 'advice' || config.kind === 'question') && looksLikeStateDump(merged)) return null;
  if (config.kind === 'advice' && !ADVICE_ACTION_PATTERNS.some((pattern) => pattern.test(merged))) return null;
  if (config.requireActionable && !ADVICE_ACTION_PATTERNS.some((pattern) => pattern.test(merged))) return null;

  const limited = withWordLimit(merged, config.maxWords);
  if (!/[A-Za-z]/.test(limited)) return null;
  if (isLowInformation(limited)) return null;
  return normalizeOutputPunctuation(limited);
};

const buildJsonAnswerInstruction = (maxWords: number): string =>
  [
    'Return JSON only in this exact shape:',
    '{"answer":"<player-facing response>"}',
    'Rules:',
    '- The answer must be final player-facing text, not analysis.',
    '- Answer directly; do not describe your process or how you derived the answer.',
    '- Do not mention prompts, instructions, word limits, or internal reasoning.',
    `- Keep the answer under ${maxWords} words.`,
  ].join('\n');

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

Remember: In this game, deploying unsafe AGI leads to catastrophe for everyone. The goal is to win the race while maintaining adequate safety standards.

IMPORTANT: Respond directly with your answer only. Do NOT include your thinking process, reasoning steps, or phrases like "let me think" or "the user is asking". Just give the final response.`;
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

  const repairLeakyResponse = async (draft: string, config: TextOutputConfig): Promise<string | null> => {
    const repairMessages: LlmMessage[] = [
      {
        role: 'system',
        content:
          'You transform source text into a clean final response for a game player. Never include analysis or planning.',
      },
      {
        role: 'user',
        content: `Convert this source text into final player-facing text.

${buildJsonAnswerInstruction(config.maxWords)}

Source text:
${draft}`,
      },
    ];

    const repaired = await callLlm(repairMessages, {
      maxTokens: Math.max(120, Math.min(360, config.maxWords * 4)),
      temperature: 0,
      topP: 0.8,
      responseFormat: { type: 'json_object' },
    });

    if (!repaired) return null;
    return sanitizePlayerFacingText(repaired, config, { jsonOnly: true });
  };

  const callForText = async (
    messages: LlmMessage[],
    options: LlmCallOptions,
    _config: TextOutputConfig,
    fallback = GENERIC_TEXT_FALLBACK,
  ): Promise<string> => {
    try {
      // Simple: just call LLM and return the response
      // The Vite proxy handles thinking extraction for Qwen
      const response = await callLlm(messages, options);
      if (!response || response.length < 5) return fallback;
      return response;
    } catch {
      return fallback;
    }
  };

  const explainMechanics = async (topic: string): Promise<string> => {
    const config: TextOutputConfig = { kind: 'mechanic', maxWords: 80, maxSentences: 4 };
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Explain this game mechanic briefly (2-3 sentences): "${topic}"`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 150, temperature: 0.5 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      const topicLower = topic.toLowerCase();
      if (topicLower.includes('safety')) return TEMPLATE_RESPONSES.mechanic.safety;
      if (topicLower.includes('capability')) return TEMPLATE_RESPONSES.mechanic.capability;
      if (topicLower.includes('action')) return TEMPLATE_RESPONSES.mechanic.actions;
      if (topicLower.includes('trust')) return TEMPLATE_RESPONSES.mechanic.trust;
      return TEMPLATE_RESPONSES.mechanic.default;
    }
    return result;
  };

  const getStrategicAdvice = async (state: GameState, factionId?: string): Promise<string> => {
    const config: TextOutputConfig = { kind: 'advice', maxWords: 60, maxSentences: 3, requireActionable: true };
    const stateJson = formatStateForPrompt(state, factionId);
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Game state: ${stateJson}

Give 1-2 sentences of strategic advice for ${factionId ? `faction "${factionId}"` : 'the player'}. Be direct and actionable.`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 150, temperature: 0.6 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      return TEMPLATE_RESPONSES.advice(state, factionId);
    }
    return result;
  };

  const narrateEvent = async (event: EventDefinition, choice: EventChoice): Promise<string> => {
    return `You chose "${choice.label}". ${choice.description} The consequences of ${event.title} ripple through the AGI landscape.`;
  };

  const respondToDirective = async (
    directive: string,
    _state: GameState,
    _factionId: string
  ): Promise<DirectiveResponse> => {
    // Simple acknowledgment without LLM - directives are logged but don't generate effects
    const shortDirective = directive.length > 50 ? directive.substring(0, 50) + '...' : directive;
    return {
      narrative: `Your directive "${shortDirective}" has been noted. Your faction adjusts its strategy accordingly.`,
      effects: [],
    };
  };

  const getGameSummary = async (state: GameState): Promise<string> => {
    const config: TextOutputConfig = { kind: 'summary', maxWords: 100, maxSentences: 5 };
    const stateJson = formatStateForPrompt(state);
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Current game state:
${stateJson}

Summarize the current state of the AGI race for the player.

${buildJsonAnswerInstruction(config.maxWords)}`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 250, temperature: 0.5 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      return TEMPLATE_RESPONSES.summary(state);
    }
    return result;
  };

  const askQuestion = async (question: string, state: GameState): Promise<string> => {
    const config: TextOutputConfig = { kind: 'question', maxWords: 80, maxSentences: 4 };
    const stateJson = formatStateForPrompt(state);
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Game state: ${stateJson}

Player asks: "${question}"

Answer briefly (2-3 sentences).`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 150, temperature: 0.5 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      const q = question.toLowerCase();
      if (q.includes('should') || q.includes('focus') || q.includes('priority') || q.includes('strategy')) {
        return TEMPLATE_RESPONSES.advice(state, undefined);
      }
      if (q.includes('safety')) return TEMPLATE_RESPONSES.mechanic.safety;
      if (q.includes('capability')) return TEMPLATE_RESPONSES.mechanic.capability;
      if (q.includes('trust')) return TEMPLATE_RESPONSES.mechanic.trust;
      if (q.includes('summary') || q.includes('state') || q.includes('status')) {
        return TEMPLATE_RESPONSES.summary(state);
      }
      return TEMPLATE_RESPONSES.mechanic.default;
    }
    return result;
  };

  const generateOpeningNarration = async (state: GameState, factionId: string): Promise<string> => {
    const faction = state.factions[factionId];
    if (!faction) return TEMPLATE_RESPONSES.opening(state, factionId);

    const config: TextOutputConfig = { kind: 'opening', maxWords: 120, maxSentences: 6 };
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Generate a D&D-style opening narration for a new game.
The player leads ${faction.name}, a ${faction.type === 'lab' ? 'private AI research laboratory' : 'government AI authority'}.
Year: ${state.year}

Create an immersive introduction setting the stakes of the AGI race.

${buildJsonAnswerInstruction(config.maxWords)}`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 300, temperature: 0.7 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      return TEMPLATE_RESPONSES.opening(state, factionId);
    }
    return result;
  };

  const narrateTurnSummary = async (state: GameState, factionId: string, turnLog: string[]): Promise<string> => {
    const config: TextOutputConfig = { kind: 'turn', maxWords: 80, maxSentences: 4 };
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Turn ${state.turn} complete. Year ${state.year} Q${state.quarter}.
Faction: ${factionId}
Events this turn: ${turnLog.length > 0 ? turnLog.join('; ') : 'None'}

Narrate a brief end-of-turn summary.

${buildJsonAnswerInstruction(config.maxWords)}`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 200, temperature: 0.6 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      return TEMPLATE_RESPONSES.turnSummary(state);
    }
    return result;
  };

  const introduceEvent = async (event: EventDefinition, state: GameState, factionId: string): Promise<string> => {
    const config: TextOutputConfig = { kind: 'eventIntro', maxWords: 80, maxSentences: 4 };
    const faction = state.factions[factionId];
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `An event has occurred: "${event.title}"
Description: ${event.description}
Faction: ${faction?.name ?? factionId}
Year: ${state.year} Q${state.quarter}

Introduce this event dramatically to the player.

${buildJsonAnswerInstruction(config.maxWords)}`,
      },
    ];
    const result = await callForText(messages, { maxTokens: 200, temperature: 0.7 }, config);
    if (result === GENERIC_TEXT_FALLBACK) {
      return TEMPLATE_RESPONSES.eventIntro(event);
    }
    return result;
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
    generateOpeningNarration,
    narrateTurnSummary,
    introduceEvent,
    recordEvent,
    recordDirective,
    getHistory,
    clearHistory,
  };
};
