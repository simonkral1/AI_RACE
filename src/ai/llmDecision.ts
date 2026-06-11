import { ACTION_POINTS_PER_TURN, OPENNESS_MULTIPLIERS, SAFETY_THRESHOLDS } from '../core/constants.js';
import { ActionChoice, ActionDefinition, GameState } from '../core/types.js';
import { ACTIONS } from '../data/actions.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { callLlm } from './llmClient.js';
import { extractJsonSnippet } from './llmParsing.js';
import { agentDecide } from './agentClient.js';

const TARGET_REQUIRED = new Set(['espionage', 'subsidize', 'regulate']);
const DEFAULT_GAMEMASTER_MODEL = 'google/gemini-3-flash';
const DEFAULT_GAMEMASTER_TIMEOUT_MS = 20_000;

export type DecisionContext = {
  playerCommsContext?: string;
};

/**
 * Use the same model config as the gamemaster/narrator
 * This ensures consistent AI behavior across narration and faction decisions
 */
const readGamemasterModel = (): string => {
  try {
    const envModel = (import.meta as { env?: Record<string, string> }).env?.VITE_GAMEMASTER_MODEL;
    if (envModel && envModel.trim()) return envModel.trim();
  } catch {
    // No-op for runtimes without import.meta.env
  }
  return DEFAULT_GAMEMASTER_MODEL;
};


const getFactionStrategy = (factionId: string) => {
  const template = FACTION_TEMPLATES.find((item) => item.id === factionId);
  return template?.strategy;
};

const formatNumber = (value: number): number => Math.round(value * 10) / 10;

const buildPrompt = (
  state: GameState,
  factionId: string,
  allowedActions: ActionDefinition[],
  context?: DecisionContext,
): string => {
  const faction = state.factions[factionId];
  const targets = Object.values(state.factions)
    .filter((f) => f.id !== factionId)
    .map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      capabilityScore: formatNumber(f.capabilityScore),
      safetyScore: formatNumber(f.safetyScore),
      trust: formatNumber(f.resources.trust),
      compute: formatNumber(f.resources.compute),
    }));

  const strategy = getFactionStrategy(factionId);
  const objective =
    faction.type === 'lab'
      ? 'Win by being first to deploy safe AGI, but avoid triggering global catastrophe.'
      : 'Maximize global safety and national influence while keeping labs aligned with safe deployment.';

  const payload = {
    objective,
    outputFormat:
      'Return JSON only as {"actions":[{"actionId":"...","openness":"open|secret","targetFactionId":"...?"}]} with no extra text.',
    constraints: {
      maxActions: ACTION_POINTS_PER_TURN,
      targetRequiredFor: Array.from(TARGET_REQUIRED),
      deployAgiRule: 'Only choose deploy_agi if canDeployAgi is true and safety thresholds are met.',
    },
    actionReference: allowedActions.map((action) => ({
      id: action.id,
      name: action.name,
      kind: action.kind,
      requiresTarget: TARGET_REQUIRED.has(action.id),
      baseResearch: action.baseResearch,
      baseResourceDelta: action.baseResourceDelta,
      exposure: action.exposure,
    })),
    opennessEffects: OPENNESS_MULTIPLIERS,
    safetyThresholds: SAFETY_THRESHOLDS,
    turn: { year: state.year, quarter: state.quarter, index: state.turn },
    globalSafety: formatNumber(state.globalSafety),
    faction: {
      id: faction.id,
      name: faction.name,
      type: faction.type,
      strategy,
      resources: faction.resources,
      safetyCulture: formatNumber(faction.safetyCulture),
      opsec: formatNumber(faction.opsec),
      capabilityScore: formatNumber(faction.capabilityScore),
      safetyScore: formatNumber(faction.safetyScore),
      exposure: formatNumber(faction.exposure),
      canDeployAgi: faction.canDeployAgi,
      hardPower: formatNumber(faction.hardPower),
      research: faction.research,
      unlockedTechs: Array.from(faction.unlockedTechs),
    },
    otherFactions: targets,
    guidance: [
      'Choose 1-2 actions that best advance the objective.',
      'If an action requires a target, choose a valid target from otherFactions.',
      'If unsure, prioritize safety when globalSafety is low.',
      'Secret actions increase exposure; high exposure can trigger detection penalties.',
    ],
    playerCommsContext: context?.playerCommsContext ?? null,
    roleBoundary:
      'You are the faction decision engine, not the Gamemaster. Produce action decisions only.',
  };

  return `You are a strategy game AI.\n\n${JSON.stringify(payload)}`;
};

const normalizeChoices = (
  raw: unknown,
  allowedActions: Set<string>,
  factionId: string,
  state: GameState,
): ActionChoice[] => {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as { actions?: unknown };
  if (!Array.isArray(obj.actions)) return [];

  const normalized: ActionChoice[] = [];
  for (const item of obj.actions) {
    if (!item || typeof item !== 'object') continue;
    const choice = item as { actionId?: unknown; openness?: unknown; targetFactionId?: unknown };
    const actionId = String(choice.actionId ?? '').trim();
    if (!allowedActions.has(actionId)) continue;
    const openness = choice.openness === 'secret' ? 'secret' : 'open';

    let targetFactionId = typeof choice.targetFactionId === 'string' ? choice.targetFactionId.trim() : '';
    if (TARGET_REQUIRED.has(actionId)) {
      if (!targetFactionId || targetFactionId === factionId || !state.factions[targetFactionId]) {
        continue;
      }
    } else {
      targetFactionId = '';
    }

    normalized.push({
      actionId,
      openness,
      targetFactionId: targetFactionId || undefined,
    });
  }

  const trimmed = normalized.slice(0, ACTION_POINTS_PER_TURN);
  const faction = state.factions[factionId];
  const fallback: ActionChoice =
    faction?.type === 'government'
      ? { actionId: 'policy', openness: 'open' }
      : { actionId: 'research_capabilities', openness: 'open' };

  while (trimmed.length < ACTION_POINTS_PER_TURN) {
    trimmed.push({ ...fallback });
  }

  return trimmed;
};

export const decideActionsWithLlm = async (
  state: GameState,
  factionId: string,
  context?: DecisionContext,
): Promise<ActionChoice[] | null> => {
  const faction = state.factions[factionId];
  if (!faction) return null;

  // form_alliance is excluded: AI alliances form through the diplomatic
  // consent flow (propose_alliance intent), never unilaterally.
  const allowed = ACTIONS.filter(
    (action) => action.allowedFor.includes(faction.type) && action.id !== 'form_alliance',
  );
  const allowedSet = new Set(allowed.map((action) => action.id));
  const prompt = buildPrompt(state, factionId, allowed, context);
  const gamemasterModel = readGamemasterModel();

  // Primary path: the faction's persistent Claude agent (Sonnet, medium effort)
  const agentOutput = await agentDecide(factionId, prompt);
  if (agentOutput) {
    const normalized = normalizeChoices(agentOutput, allowedSet, factionId, state);
    if (normalized.length) return normalized;
  }

  try {
    const content = await callLlm(
      [
        {
          role: 'system',
          content:
            'You are a faction decision engine for AGI Race. Output JSON only; never narrate, roleplay, or explain.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        model: gamemasterModel,
        maxTokens: 220,
        temperature: 0.6,
        topP: 0.8,
        timeoutMs: DEFAULT_GAMEMASTER_TIMEOUT_MS,
        reasoningEffort: 'low',
        responseFormat: { type: 'json_object' },
      },
    );
    if (!content) return null;

    const json = extractJsonSnippet(content, 'object');
    if (!json) return null;
    const parsed = JSON.parse(json);
    const normalized = normalizeChoices(parsed, allowedSet, factionId, state);
    return normalized.length ? normalized : null;
  } catch (error) {
    return null;
  }
};
