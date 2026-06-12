import {
  ActionChoice,
  ActionDefinition,
  GameState,
  ResourceKey,
  BranchId,
} from '../core/types.js';
import { EventDefinition, EventChoice } from '../data/events.js';
import {
  gmExplain,
  gmAdvice,
  gmNarrateEvent,
  gmRespondDirective,
  gmInterpretDirective,
  gmSummary,
  gmAsk,
  gmOpening,
  gmTurnSummary,
  gmIntroduceEvent,
  gmActionReview,
} from './gmClient.js';
import { extractJsonSnippet } from './llmParsing.js';

const GENERIC_TEXT_FALLBACK = 'The AGI race continues. Choose your path wisely.';
const DEFAULT_GAMEMASTER_TIMEOUT_MS = 20_000;

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
      key: 'safetyCulture' | 'opsec' | 'hardPower';
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

export type DirectiveActionTarget = {
  id: string;
  name: string;
  type?: string;
};

export type DirectiveActionInterpretation = {
  orders: ActionChoice[];
  source: 'llm' | 'error';
  note: string;
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

export type ActionReviewRequest = {
  turn: number;
  year: number;
  quarter: number;
  actorName: string;
  actorId: string;
  isPlayer: boolean;
  actionName: string;
  openness: 'open' | 'secret';
  visibility: 'public' | 'private';
  targetName?: string;
  playerDirective?: string;
  netDeltas?: {
    capability: number;
    safety: number;
    trust: number;
    compute: number;
    capital: number;
    globalSafety: number;
  };
  attributeChecks?: Array<{
    label: string;
    value: number;
    delta?: number;
  }>;
  turnLog: string[];
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
  interpretDirectiveActions(
    directive: string,
    state: GameState,
    factionId: string,
    allowedActions: ActionDefinition[],
    targets: DirectiveActionTarget[],
    maxActions: number,
  ): Promise<DirectiveActionInterpretation>;
  getGameSummary(state: GameState): Promise<string>;
  askQuestion(question: string, state: GameState): Promise<string>;
  /** Generate an analytical opening briefing when the game starts */
  generateOpeningNarration(state: GameState, factionId: string): Promise<string>;
  /** Narrate what happened during a turn — GM summarizes player and AI actions */
  narrateTurnSummary(
    state: GameState,
    factionId: string,
    turnLog: string[],
    playerActions?: string[],
    diceRoll?: number,
  ): Promise<string>;
  /** Introduce an event before the player makes a choice — GM sets the scene */
  introduceEvent(event: EventDefinition, state: GameState, factionId: string): Promise<string>;
  /** Evaluate one action in narrative form for the action-review sequence */
  narrateActionReview(request: ActionReviewRequest): Promise<string>;
  recordEvent(event: GameEvent): void;
  recordDirective(turn: number, factionId: string, directive: string): void;
  getHistory(): GameEvent[];
  clearHistory(): void;
}

// Default personality
const DEFAULT_PERSONALITY: PersonalityConfig = {
  tone: 'neutral',
  verbosity: 'moderate',
  riskEmphasis: 'medium',
};

const MAX_HISTORY_SIZE = 100;

// Clamp values to safe ranges
const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// Valid effect kinds for validation
const VALID_EFFECT_KINDS = new Set(['resource', 'score', 'stat', 'research', 'log']);
const VALID_RESOURCE_KEYS = new Set<ResourceKey>(['compute', 'cybersecurity', 'capital', 'influence', 'trust']);
const VALID_SCORE_KEYS = new Set(['capabilityScore', 'safetyScore']);
const VALID_STAT_KEYS = new Set(['safetyCulture', 'opsec', 'hardPower']);
const VALID_BRANCH_KEYS = new Set<BranchId>(['capabilities', 'safety', 'ops', 'hardPower', 'policy']);

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
const UNAVAILABLE_RESPONSE = '[AI Error] LLM response failed — check proxy connection and model config.';
const DIRECTIVE_ACTION_ERROR_NOTE = '[AI Error] Unable to interpret directive. Check LLM connection and retry.';
const TARGET_REQUIRED_ACTIONS = new Set([
  'espionage',
  'subsidize',
  'regulate',
  'form_alliance',
  'executive_order',
  'strategic_initiative',
]);
const SECRET_DIRECTIVE_HINTS = [
  'secret',
  'covert',
  'quietly',
  'stealth',
  'classified',
  'black ops',
  'under the radar',
];
const OPEN_DIRECTIVE_HINTS = [
  'open',
  'public',
  'transparent',
  'announce',
  'publish',
];

// Smart template-based responses when LLM is unavailable
const TEMPLATE_RESPONSES = {
  mechanic: {
    safety: 'Safety score represents your alignment research progress. Higher safety reduces catastrophe risk when deploying AGI. Balance capability gains with adequate safety investment.',
    capability: 'Capability score tracks your AI advancement. Higher capability brings you closer to AGI but increases global risk. The first to deploy safe AGI wins.',
    actions: 'Each turn you can research capabilities, invest in safety, build compute, or deploy products. Choose wisely — every action has trade-offs.',
    trust: 'Soft power affects your funding and freedom to operate. Scandals or unsafe practices erode soft power. Open research and safety focus build it.',
    default: 'This mechanic affects how your faction competes in the AGI race. Balance short-term gains against long-term safety.',
  },
  advice: (state: GameState, factionId?: string) => {
    const faction = factionId ? state.factions[factionId] : null;
    if (!faction) return 'Focus on building a balanced portfolio of capability and safety research.';

    const safetyGap = faction.capabilityScore - faction.safetyScore;
    if (safetyGap > 20) return 'Warning: Your capability far outpaces safety. Prioritize alignment research or risk catastrophe.';
    if (faction.resources.trust < 40) return 'Your soft power is dangerously low. Consider open research or a PR campaign.';
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
    if (!faction) return 'Strategic briefing initialized. The AGI race is active.';
    const role = faction.type === 'lab' ? 'an AI research laboratory' : 'a government authority';
    return `Year ${state.year} baseline briefing: you lead ${faction.name}, ${role}, in a high-risk AGI competition. Your quarterly strategy must balance capability growth, safety discipline, and political resilience under uncertain conditions.`;
  },
  eventIntro: (event: EventDefinition) => {
    return `Event brief: ${event.title}. ${event.description} Evaluate each option by short-term gain, exposure, and downstream safety impact.`;
  },
  turnSummary: (state: GameState, playerActions: string[] = [], diceRoll?: number) => {
    const actionsText = playerActions.length > 0
      ? ` You attempted: ${playerActions.join(', ')}.`
      : '';

    if (diceRoll === undefined) {
      return `Quarter ${state.quarter} of ${state.year} concludes.${actionsText} Global safety stands at ${Math.round(state.globalSafety)}%.`;
    }

    const rollBand = diceRoll <= 5
      ? 'adverse variance'
      : diceRoll <= 10
        ? 'mild setback'
        : diceRoll <= 15
          ? 'expected progress'
          : diceRoll <= 19
            ? 'strong progress'
            : 'exceptional progress';

    return `Quarter ${state.quarter} of ${state.year} closes.${actionsText} Uncertainty signal: ${diceRoll} (${rollBand}). Global safety is ${Math.round(state.globalSafety)}%.`;
  },
};

const fallbackMechanic = (topic: string): string => {
  const key = topic.toLowerCase();
  if (key.includes('safety')) return TEMPLATE_RESPONSES.mechanic.safety;
  if (key.includes('capability')) return TEMPLATE_RESPONSES.mechanic.capability;
  if (key.includes('action')) return TEMPLATE_RESPONSES.mechanic.actions;
  if (key.includes('trust') || key.includes('soft power') || key.includes('soft-power')) return TEMPLATE_RESPONSES.mechanic.trust;
  return TEMPLATE_RESPONSES.mechanic.default;
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
  /\b[a-z]{2,}_[a-z0-9_]{2,}\b/,
  /\b(?:capabilityScore|safetyScore|globalSafety|turnLog|factionId|targetFactionId|canDeployAgi)\b/i,
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

const sanitizeLogForNarrative = (line: string): string =>
  line
    .replace(/\b[a-z]{2,}_[a-z0-9_]{2,}\b/g, 'internal milestone')
    .replace(/\b(?:capabilityScore|safetyScore|globalSafety|turnLog|factionId|targetFactionId|canDeployAgi)\b/gi, 'system metric');

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

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> =>
  new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });

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

// Format state for prompts
const formatStateForPrompt = (state: GameState, factionId?: string): string => {
  const factionData = Object.values(state.factions).map(f => ({
    id: f.id,
    name: f.name,
    type: f.type,
    capabilityScore: Math.round(f.capabilityScore * 10) / 10,
    safetyScore: Math.round(f.safetyScore * 10) / 10,
    trust: Math.round(f.resources.trust * 10) / 10,
    hardPower: Math.round(f.hardPower * 10) / 10,
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
      hardPower: focusFaction.hardPower,
    } : null,
  }, null, 2);
};

const formatCompactStateForPrompt = (state: GameState, factionId?: string): string => {
  const factions = Object.values(state.factions)
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      type: faction.type,
      capability: Math.round(faction.capabilityScore * 10) / 10,
      safety: Math.round(faction.safetyScore * 10) / 10,
      trust: Math.round(faction.resources.trust * 10) / 10,
      compute: Math.round(faction.resources.compute * 10) / 10,
      canDeployAgi: faction.canDeployAgi,
    }))
    .sort((a, b) => b.capability - a.capability);

  const focus = factionId ? factions.find((item) => item.id === factionId) ?? null : null;

  return JSON.stringify({
    year: state.year,
    quarter: state.quarter,
    turn: state.turn,
    globalSafety: Math.round(state.globalSafety * 10) / 10,
    gameOver: state.gameOver,
    winnerId: state.winnerId ?? null,
    leadersByCapability: factions.slice(0, 3),
    focusFaction: focus,
  }, null, 2);
};

const normalizeForMatch = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const resolveTargetId = (
  rawTarget: unknown,
  targets: DirectiveActionTarget[],
): string | undefined => {
  if (typeof rawTarget !== 'string') return undefined;
  const raw = rawTarget.trim();
  if (!raw) return undefined;

  const byId = targets.find((target) => target.id.toLowerCase() === raw.toLowerCase());
  if (byId) return byId.id;

  const normalizedRaw = normalizeForMatch(raw);
  if (!normalizedRaw) return undefined;

  const exactName = targets.find((target) => normalizeForMatch(target.name) === normalizedRaw);
  if (exactName) return exactName.id;

  let bestMatch: { id: string; score: number } | null = null;
  for (const target of targets) {
    const normalizedName = normalizeForMatch(target.name);
    const nameTokens = normalizedName.split(' ').filter((token) => token.length >= 3);
    let score = 0;

    if (normalizedRaw.includes(normalizedName) || normalizedName.includes(normalizedRaw)) {
      score += 3;
    }
    for (const token of nameTokens) {
      if (normalizedRaw.includes(token)) score += 1;
    }
    if (score <= 0) continue;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { id: target.id, score };
    }
  }

  return bestMatch?.id;
};

const inferDirectiveOpenness = (directive: string, actionId: string): 'open' | 'secret' => {
  const normalized = normalizeForMatch(directive);
  if (!normalized) return actionId === 'espionage' ? 'secret' : 'open';
  if (OPEN_DIRECTIVE_HINTS.some((hint) => normalized.includes(normalizeForMatch(hint)))) return 'open';
  if (SECRET_DIRECTIVE_HINTS.some((hint) => normalized.includes(normalizeForMatch(hint)))) return 'secret';
  if (actionId === 'espionage') return 'secret';
  return 'open';
};

const normalizeInterpretedOrders = (
  rawOrders: unknown[],
  directive: string,
  factionId: string,
  allowedActions: ActionDefinition[],
  targets: DirectiveActionTarget[],
  maxActions: number,
): ActionChoice[] => {
  const slots = Math.max(1, maxActions);
  const allowedById = new Map(allowedActions.map((action) => [action.id, action]));
  const directiveTargetId = resolveTargetId(directive, targets);
  const normalized: ActionChoice[] = [];

  for (const item of rawOrders) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    const actionId = typeof candidate.actionId === 'string' ? candidate.actionId.trim() : '';
    if (!actionId) continue;
    const action = allowedById.get(actionId);
    if (!action) continue;

    const openness = candidate.openness === 'secret'
      ? 'secret'
      : inferDirectiveOpenness(directive, actionId);
    const targetHint =
      candidate.targetFactionId
      ?? candidate.target
      ?? candidate.targetId
      ?? candidate.targetName;
    const resolvedTarget = resolveTargetId(targetHint, targets) ?? directiveTargetId;

    if (TARGET_REQUIRED_ACTIONS.has(actionId)) {
      if (!resolvedTarget || resolvedTarget === factionId) continue;
      normalized.push({
        actionId,
        openness,
        targetFactionId: resolvedTarget,
      });
    } else {
      normalized.push({
        actionId,
        openness,
        targetFactionId: undefined,
      });
    }

    if (normalized.length >= slots) break;
  }

  return normalized.slice(0, slots);
};

const describeInterpretedOrders = (
  orders: ActionChoice[],
  allowedActions: ActionDefinition[],
  targets: DirectiveActionTarget[],
): string => {
  const actionNames = new Map(allowedActions.map((action) => [action.id, action.name]));
  const targetNames = new Map(targets.map((target) => [target.id, target.name]));

  return orders
    .map((order, index) => {
      const actionName = actionNames.get(order.actionId) ?? order.actionId;
      const opennessLabel = order.openness === 'secret' ? 'private' : 'open';
      const targetLabel = order.targetFactionId
        ? ` targeting ${targetNames.get(order.targetFactionId) ?? order.targetFactionId}`
        : '';
      return `${index + 1}. ${actionName} (${opennessLabel})${targetLabel}`;
    })
    .join('  ');
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
        key: e.key as 'safetyCulture' | 'opsec' | 'hardPower',
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
// Note: config.personality is accepted for API compatibility but personality now lives
// in the server-side GM system prompt (server/agentServer.ts GM_SYSTEM_PROMPT).
export const createGamemaster = (config?: GamemasterConfig): Gamemaster => {
  const maxHistorySize = config?.maxHistorySize ?? MAX_HISTORY_SIZE;
  const history: GameEvent[] = [];

  /**
   * Call a GM endpoint, run the result through sanitization, and fall back to
   * the supplied deterministic text if the server returns null or the response
   * is unusable. This replaces the old callLlm-based callForText helper.
   */
  const callForTextViaGm = async (
    gmFn: (prompt: string) => Promise<string | null>,
    prompt: string,
    outputConfig: TextOutputConfig,
    fallback: string,
  ): Promise<string> => {
    try {
      const raw = await withTimeout(
        gmFn(prompt),
        DEFAULT_GAMEMASTER_TIMEOUT_MS,
        null,
      );
      if (!raw) return fallback;

      const sanitized = sanitizePlayerFacingText(raw, outputConfig);
      if (sanitized && !LEAK_PATTERNS.some((p) => p.test(raw))) return sanitized;
      if (sanitized) return sanitized;
      return fallback;
    } catch {
      return fallback;
    }
  };

  const explainMechanics = async (topic: string): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'mechanic', maxWords: 80, maxSentences: 4 };
    const prompt = `Explain this game mechanic briefly (2-3 sentences): "${topic}"\n\n${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(gmExplain, prompt, outputConfig, fallbackMechanic(topic));
  };

  const getStrategicAdvice = async (state: GameState, factionId?: string): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'advice', maxWords: 60, maxSentences: 3, requireActionable: true };
    const stateJson = formatCompactStateForPrompt(state, factionId);
    const prompt = `Game state: ${stateJson}\n\nGive 1-2 sentences of strategic advice for ${factionId ? `faction "${factionId}"` : 'the player'}. Be direct and actionable.\n\n${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(
      gmAdvice,
      prompt,
      outputConfig,
      TEMPLATE_RESPONSES.advice(state, factionId),
    );
  };

  const narrateEvent = async (event: EventDefinition, choice: EventChoice): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'event', maxWords: 90, maxSentences: 5 };
    const prompt = `Event: ${event.title}
Description: ${event.description}
Player choice: ${choice.label}
Choice details: ${choice.description}

Provide an immediate consequence brief in 2-4 analytical sentences. Focus on impact, risk, and momentum changes.

${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(
      gmNarrateEvent,
      prompt,
      outputConfig,
      `Event outcome brief: ${event.title} -> ${choice.label}. ${choice.description}`,
    );
  };

  const respondToDirective = async (
    directive: string,
    state: GameState,
    factionId: string,
  ): Promise<DirectiveResponse> => {
    const prompt = `Game state:
${formatStateForPrompt(state, factionId)}

Faction: ${factionId}
Directive: ${directive}

Return JSON only in this exact shape:
{"narrative":"<brief consequence narration>","effects":[{"kind":"resource|score|stat|research|log","factionId":"<id>","key":"<resource-or-score-key>","branch":"<branch-if-research>","delta":<number>,"message":"<for-log-only>","reason":"<optional>"}]}
Rules:
- Keep narrative concise and player-facing.
- Effects must be modest and plausible for one quarter.
- Use only valid effect kinds and keys.
- Use empty effects array when no clear mechanical effect applies.`;

    try {
      const raw = await withTimeout(
        gmRespondDirective(prompt),
        DEFAULT_GAMEMASTER_TIMEOUT_MS,
        null,
      );
      if (!raw) return { narrative: DIRECTIVE_FALLBACK_NARRATIVE, effects: [] };

      const snippet = extractJsonSnippet(raw, 'object');
      if (!snippet) return { narrative: DIRECTIVE_FALLBACK_NARRATIVE, effects: [] };

      const parsed = JSON.parse(snippet) as Record<string, unknown>;
      const rawNarrative =
        (typeof parsed.narrative === 'string' ? parsed.narrative : pickAnswerField(parsed)) ??
        DIRECTIVE_FALLBACK_NARRATIVE;
      const narrative =
        sanitizePlayerFacingText(rawNarrative, { kind: 'turn', maxWords: 60, maxSentences: 3 }) ??
        DIRECTIVE_FALLBACK_NARRATIVE;

      const effects = (Array.isArray(parsed.effects) ? parsed.effects : [])
        .map((effect) => validateEffect(effect, state))
        .filter((effect): effect is GmEffect => effect !== null);

      return { narrative, effects };
    } catch {
      return { narrative: DIRECTIVE_FALLBACK_NARRATIVE, effects: [] };
    }
  };

  const interpretDirectiveActions = async (
    directive: string,
    state: GameState,
    factionId: string,
    allowedActions: ActionDefinition[],
    targets: DirectiveActionTarget[],
    maxActions: number,
  ): Promise<DirectiveActionInterpretation> => {
    const trimmedDirective = directive.trim();
    if (!trimmedDirective) {
      return { orders: [], source: 'error', note: '[AI Error] Directive is empty.' };
    }
    if (!allowedActions.length) {
      return { orders: [], source: 'error', note: 'No actions are available for the selected faction.' };
    }

    const stateJson = formatCompactStateForPrompt(state, factionId);
    const actionCatalog = allowedActions.map((action) => ({
      id: action.id,
      name: action.name,
      requiresTarget: TARGET_REQUIRED_ACTIONS.has(action.id),
    }));

    const prompt = `Game snapshot:
${stateJson}

Faction: ${factionId}
Directive: "${trimmedDirective}"
Max action slots: ${Math.max(1, maxActions)}

Allowed actions:
${JSON.stringify(actionCatalog, null, 2)}

Valid targets:
${JSON.stringify(targets, null, 2)}

Return JSON only with this exact shape:
{
  "orders": [
    {"actionId":"<allowed action id>","openness":"open|secret","targetFactionId":"<target id if required>"}
  ]
}

Rules:
- Choose exactly ${Math.max(1, maxActions)} orders when possible.
- Use only allowed action ids.
- Use a targetFactionId only for actions that require a target.
- If a target is required, it must be one of the valid targets.
- Use "secret" only when the directive clearly implies covert/private behavior.`;

    try {
      const raw = await withTimeout(
        gmInterpretDirective(prompt),
        DEFAULT_GAMEMASTER_TIMEOUT_MS,
        null,
      );
      if (!raw) return { orders: [], source: 'error', note: DIRECTIVE_ACTION_ERROR_NOTE };

      const snippet = extractJsonSnippet(raw, 'object');
      if (!snippet) return { orders: [], source: 'error', note: DIRECTIVE_ACTION_ERROR_NOTE };

      const parsed = JSON.parse(snippet) as Record<string, unknown>;
      const rawOrders = Array.isArray(parsed.orders)
        ? parsed.orders
        : Array.isArray(parsed.actions)
          ? parsed.actions
          : [];
      const orders = normalizeInterpretedOrders(
        rawOrders,
        directive,
        factionId,
        allowedActions,
        targets,
        maxActions,
      );

      if (orders.length < Math.max(1, maxActions)) {
        return { orders: [], source: 'error', note: DIRECTIVE_ACTION_ERROR_NOTE };
      }

      return {
        orders,
        source: 'llm',
        note: `Plan: ${describeInterpretedOrders(orders, allowedActions, targets)}`,
      };
    } catch {
      return { orders: [], source: 'error', note: DIRECTIVE_ACTION_ERROR_NOTE };
    }
  };

  const getGameSummary = async (state: GameState): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'summary', maxWords: 100, maxSentences: 5 };
    const stateJson = formatCompactStateForPrompt(state);
    const recentHistory = history.slice(-10);
    const prompt = `Current game state:
${stateJson}

Recent history:
${JSON.stringify(recentHistory, null, 2)}

Summarize the current state of the AGI race for the player.

${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(gmSummary, prompt, outputConfig, TEMPLATE_RESPONSES.summary(state));
  };

  const askQuestion = async (question: string, state: GameState): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'question', maxWords: 80, maxSentences: 4 };
    const stateJson = formatCompactStateForPrompt(state);
    const prompt = `Game state: ${stateJson}

Player asks: "${question}"

Answer briefly (2-3 sentences).`;
    return callForTextViaGm(gmAsk, prompt, outputConfig, UNAVAILABLE_RESPONSE);
  };

  const generateOpeningNarration = async (state: GameState, factionId: string): Promise<string> => {
    const faction = state.factions[factionId];
    if (!faction) return UNAVAILABLE_RESPONSE;

    const outputConfig: TextOutputConfig = { kind: 'opening', maxWords: 120, maxSentences: 6 };
    const prompt = `Generate an analytical opening briefing for a new game.
The player leads ${faction.name}, a ${faction.type === 'lab' ? 'private AI research laboratory' : 'government AI authority'}.
Year: ${state.year}

Create a concise strategic baseline describing stakes, constraints, and decision priorities.

${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(
      gmOpening,
      prompt,
      outputConfig,
      TEMPLATE_RESPONSES.opening(state, factionId),
    );
  };

  const narrateTurnSummary = async (
    state: GameState,
    factionId: string,
    turnLog: string[],
    playerActions?: string[],
    diceRoll?: number,
  ): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'turn', maxWords: 80, maxSentences: 4 };
    const resolvedPlayerActions = playerActions ?? [];
    const turnNarrativeLog = turnLog.slice(-8).map((entry) => sanitizeLogForNarrative(entry));
    const resolvedDiceRoll = typeof diceRoll === 'number'
      ? Math.max(1, Math.min(20, Math.floor(diceRoll)))
      : undefined;
    const diceOutcome = resolvedDiceRoll === undefined
      ? 'No roll provided.'
      : resolvedDiceRoll <= 5
        ? 'Adverse variance (1-5)'
        : resolvedDiceRoll <= 10
          ? 'Mild setback (6-10)'
          : resolvedDiceRoll <= 15
            ? 'Expected progress (11-15)'
            : resolvedDiceRoll <= 19
              ? 'Strong progress (16-19)'
              : 'Exceptional progress (20)';

    const prompt = `Turn ${state.turn} complete. Year ${state.year} Q${state.quarter}.
Faction: ${state.factions[factionId]?.name ?? factionId}
Events this turn: ${turnNarrativeLog.length > 0 ? turnNarrativeLog.join('; ') : 'None'}
Player chosen actions: ${resolvedPlayerActions.length > 0 ? resolvedPlayerActions.join('; ') : 'None listed'}
Uncertainty indicator (d20): ${resolvedDiceRoll ?? 'None'} -> ${diceOutcome}

Write a brief end-of-turn narrative briefing with an analyst voice.
Keep it vivid but concrete, and directly reference what the player tried this turn.
Never use variable names, IDs, or code-like notation.
Use this interpretation: 1-5 adverse variance, 6-10 mild setback, 11-15 expected progress, 16-19 strong progress, 20 exceptional progress.

${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(
      gmTurnSummary,
      prompt,
      outputConfig,
      TEMPLATE_RESPONSES.turnSummary(state, resolvedPlayerActions, resolvedDiceRoll),
    );
  };

  const narrateActionReview = async (request: ActionReviewRequest): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'turn', maxWords: 95, maxSentences: 4 };
    const describeShift = (value: number, noun: string): string => {
      if (value >= 8) return `${noun} surged`;
      if (value >= 3) return `${noun} improved`;
      if (value > 0) return `${noun} edged up`;
      if (value <= -8) return `${noun} fell sharply`;
      if (value <= -3) return `${noun} slipped`;
      if (value < 0) return `${noun} softened`;
      return `${noun} held steady`;
    };
    const describeMoneyShift = (value: number): string => {
      if (value >= 10) return 'funding rose strongly';
      if (value >= 3) return 'funding improved';
      if (value > 0) return 'funding inched upward';
      if (value <= -10) return 'funding dropped sharply';
      if (value <= -3) return 'funding weakened';
      if (value < 0) return 'funding dipped';
      return 'funding stayed flat';
    };
    const netDeltasText = request.netDeltas
      ? `Observed shifts for this actor this turn:
- ${describeShift(request.netDeltas.capability, 'capability')}
- ${describeShift(request.netDeltas.safety, 'safety discipline')}
- ${describeShift(request.netDeltas.trust, 'soft power')}
- ${describeShift(request.netDeltas.compute, 'compute capacity')}
- ${describeMoneyShift(request.netDeltas.capital)}
- ${describeShift(request.netDeltas.globalSafety, 'overall global safety')}`
      : 'No precise per-action deltas were measured; infer likely impact from logs and visibility.';
    const directiveText = request.playerDirective?.trim()
      ? `Player directive context: "${request.playerDirective.trim()}".`
      : 'No player directive provided.';
    const reviewLog = request.turnLog.slice(-8).map((entry) => sanitizeLogForNarrative(entry));
    const attributeCheckText = request.attributeChecks && request.attributeChecks.length > 0
      ? `Attribute checks (use these to validate whether the action actually worked):
${request.attributeChecks
  .map((attribute) => {
    const deltaText = typeof attribute.delta === 'number'
      ? ` (${attribute.delta >= 0 ? '+' : ''}${attribute.delta.toFixed(1)})`
      : '';
    return `- ${attribute.label}: ${attribute.value.toFixed(1)}${deltaText}`;
  })
  .join('\n')}`
      : 'Attribute checks unavailable.';

    const prompt = `Write one concise action-review brief as a strategic analyst.
The brief must:
- Explicitly name the action and actor.
- State whether the action was open/public or secret/private.
- Explain expected immediate impact this quarter and likely second-order effects next quarter.
- If this is the player action, evaluate whether their directive aligned with observed outcomes.
- Validate your judgement against the attribute checks and call out mismatches.
- Do not write generic summary; focus on this single action.
- Do not use variable names, IDs, stat keys, or code-like tokens.
- Output exactly three short lines with these prefixes:
  1) This turn:
  2) Why it matters:
  3) Next turn:

Turn context: ${request.year} Q${request.quarter} (turn ${request.turn})
Actor: ${request.actorName} | Player actor: ${request.isPlayer ? 'yes' : 'no'}
Action: ${request.actionName}
Openness: ${request.openness}
Visibility: ${request.visibility}
${request.targetName ? `Target: ${request.targetName}` : 'Target: none'}
${directiveText}
${netDeltasText}
${attributeCheckText}
Turn log context:
${reviewLog.length > 0 ? reviewLog.map((entry) => `- ${entry}`).join('\n') : '- No logged outcomes'}

${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(gmActionReview, prompt, outputConfig, UNAVAILABLE_RESPONSE);
  };

  const introduceEvent = async (event: EventDefinition, state: GameState, factionId: string): Promise<string> => {
    const outputConfig: TextOutputConfig = { kind: 'eventIntro', maxWords: 80, maxSentences: 4 };
    const faction = state.factions[factionId];
    const prompt = `An event has occurred: "${event.title}"
Description: ${event.description}
Faction: ${faction?.name ?? factionId}
Year: ${state.year} Q${state.quarter}

Introduce this event as an analyst briefing with concrete implications.

${buildJsonAnswerInstruction(outputConfig.maxWords)}`;
    return callForTextViaGm(gmIntroduceEvent, prompt, outputConfig, TEMPLATE_RESPONSES.eventIntro(event));
  };

  const recordEvent = (event: GameEvent): void => {
    history.push(event);
    if (history.length > maxHistorySize) {
      history.splice(0, history.length - maxHistorySize);
    }
  };

  const recordDirective = (turn: number, factionId: string, directive: string): void => {
    recordEvent({ turn, type: 'directive', factionId, directive });
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
    interpretDirectiveActions,
    getGameSummary,
    askQuestion,
    generateOpeningNarration,
    narrateTurnSummary,
    narrateActionReview,
    introduceEvent,
    recordEvent,
    recordDirective,
    getHistory,
    clearHistory,
  };
};
