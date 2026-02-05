import { applyResourceDelta, applyScoreDelta, applyStatDelta, computeGlobalSafety } from '../core/stats.js';
import { unlockAvailableTechs } from '../core/tech.js';
import { clamp } from '../core/utils.js';
import { ActionChoice, BranchId, GameState, ResourceKey } from '../core/types.js';
import { ACTIONS } from '../data/actions.js';
import { TECH_TREE } from '../data/techTree.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { decideActionsHeuristic } from './decideActions.js';
import { callLlm, LlmMessage } from './llmClient.js';

export type NarrativeDirective = {
  factionId: string;
  text: string;
  source: 'player' | 'ai';
};

type GmEffect =
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
      kind: 'unlock';
      factionId: string;
      techId: string;
      reason?: string;
    }
  | {
      kind: 'log';
      message: string;
    };

type GmResult = {
  effects?: GmEffect[];
  summary?: string;
};

const ACTION_NAME = new Map(ACTIONS.map((action) => [action.id, action.name]));
const TECH_BY_ID = new Map(TECH_TREE.map((node) => [node.id, node]));
const RESOURCE_KEYS = new Set<ResourceKey>(['compute', 'talent', 'capital', 'data', 'influence', 'trust']);
const BRANCH_KEYS = new Set<BranchId>(['capabilities', 'safety', 'ops', 'policy']);
const STAT_KEYS = new Set(['safetyCulture', 'opsec']);
const SCORE_KEYS = new Set(['capabilityScore', 'safetyScore']);

const formatNumber = (value: number): number => Math.round(value * 10) / 10;

const sanitizeDirective = (text: string): string => {
  const cleaned = text.replace(/[\r\n]+/g, ' ').replace(/["`]/g, '').trim();
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
};

const actionToPhrase = (choice: ActionChoice, state: GameState): string => {
  switch (choice.actionId) {
    case 'research_capabilities':
      return 'Invest in capabilities research';
    case 'research_safety':
      return 'Invest in safety research';
    case 'build_compute':
      return 'Expand compute infrastructure';
    case 'deploy_products':
      return 'Launch new products';
    case 'deploy_agi':
      return 'Prepare to deploy AGI';
    case 'policy':
      return 'Pursue policy and diplomacy';
    case 'espionage': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId]?.name : undefined;
      return target ? `Conduct espionage against ${target}` : 'Conduct espionage';
    }
    case 'subsidize': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId]?.name : undefined;
      return target ? `Subsidize ${target}` : 'Subsidize allies';
    }
    case 'regulate': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId]?.name : undefined;
      return target ? `Regulate ${target}` : 'Tighten regulations';
    }
    case 'counterintel':
      return 'Strengthen counter-intelligence';
    default:
      return ACTION_NAME.get(choice.actionId) ?? 'Advance strategic priorities';
  }
};

const fallbackDirective = (state: GameState, factionId: string, rng: () => number): string => {
  const choices = decideActionsHeuristic(state, factionId, rng);
  if (!choices.length) return 'Maintain the current strategy';
  const phrases = choices.map((choice) => actionToPhrase(choice, state));
  return `${phrases.join(' and ')}.`;
};

const getFactionStrategy = (factionId: string) => {
  const template = FACTION_TEMPLATES.find((item) => item.id === factionId);
  return template?.strategy;
};

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

export const generateDirective = async (
  state: GameState,
  factionId: string,
  rng: () => number,
): Promise<string> => {
  const faction = state.factions[factionId];
  if (!faction) return fallbackDirective(state, factionId, rng);

  const strategy = getFactionStrategy(factionId);
  const objective =
    faction.type === 'lab'
      ? 'Win by being first to deploy safe AGI, without causing catastrophe.'
      : 'Maximize global safety and national influence while keeping labs aligned.';

  const payload = {
    objective,
    output: 'Return ONE short action sentence (max 14 words). No quotes, no markdown.',
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
    },
    otherFactions: Object.values(state.factions)
      .filter((other) => other.id !== factionId)
      .map((other) => ({
        id: other.id,
        name: other.name,
        type: other.type,
        capabilityScore: formatNumber(other.capabilityScore),
        safetyScore: formatNumber(other.safetyScore),
        trust: formatNumber(other.resources.trust),
        influence: formatNumber(other.resources.influence),
      })),
    guidance: [
      'Be specific and actionable.',
      'Align with your strategy and the current safety climate.',
      'Keep it to one sentence.',
    ],
  };

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: 'You are a strategy game player. Output a single concise action sentence only.',
    },
    {
      role: 'user',
      content: JSON.stringify(payload),
    },
  ];

  const content = await callLlm(messages, { maxTokens: 64, temperature: 0.6, topP: 0.9 });
  if (!content) return fallbackDirective(state, factionId, rng);
  return sanitizeDirective(content);
};

export const resolveNarrativeEffects = async (
  state: GameState,
  directives: NarrativeDirective[],
): Promise<GmResult | null> => {
  if (!directives.length) return null;

  const payload = {
    role: 'Game Master',
    instruction:
      'Interpret the directives and output JSON only as {"effects":[...],"summary":"..."} with no extra text.',
    rules: {
      maxEffects: 8,
      maxDelta: {
        resource: 12,
        score: 8,
        stat: 6,
        research: 16,
      },
      unlockRule: 'Only unlock a tech if its prerequisites are already unlocked.',
      avoid: 'Do not directly set gameOver or winnerId. Do not modify year/quarter/turn.',
    },
    schema: {
      effects: [
        {
          kind: 'resource|score|stat|research|unlock|log',
          factionId: 'required for resource/score/stat/research/unlock',
          key: 'resource key or score/stat key',
          branch: 'capabilities|safety|ops|policy (for research)',
          delta: 'number',
          techId: 'tech id (for unlock)',
          message: 'string (for log)',
          reason: 'short reason',
        },
      ],
      summary: 'short 1-sentence recap',
    },
    state: {
      year: state.year,
      quarter: state.quarter,
      globalSafety: formatNumber(state.globalSafety),
      factions: Object.values(state.factions).map((faction) => ({
        id: faction.id,
        name: faction.name,
        type: faction.type,
        resources: faction.resources,
        capabilityScore: formatNumber(faction.capabilityScore),
        safetyScore: formatNumber(faction.safetyScore),
        safetyCulture: formatNumber(faction.safetyCulture),
        opsec: formatNumber(faction.opsec),
        exposure: formatNumber(faction.exposure),
        research: faction.research,
        unlockedTechs: Array.from(faction.unlockedTechs),
      })),
    },
    directives: directives.map((directive) => ({
      factionId: directive.factionId,
      factionName: state.factions[directive.factionId]?.name ?? directive.factionId,
      source: directive.source,
      text: directive.text,
    })),
  };

  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: 'You are a careful game master. Output JSON only, no markdown or extra text.',
    },
    {
      role: 'user',
      content: JSON.stringify(payload),
    },
  ];

  const content = await callLlm(messages, { maxTokens: 420, temperature: 0.4, topP: 0.9 });
  if (!content) return null;
  const json = extractJson(content);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as GmResult;
    return parsed;
  } catch {
    return null;
  }
};

export const applyNarrativeEffects = (state: GameState, result: GmResult): string[] => {
  const logEntries: string[] = [];
  const effects = Array.isArray(result.effects) ? result.effects : [];

  for (const effect of effects) {
    if (!effect || typeof effect !== 'object') continue;
    switch (effect.kind) {
      case 'resource': {
        const faction = state.factions[effect.factionId];
        if (!faction) break;
        if (!RESOURCE_KEYS.has(effect.key)) break;
        const delta = clamp(effect.delta ?? 0, -12, 12);
        if (!Number.isFinite(delta)) break;
        applyResourceDelta(faction, { [effect.key]: delta });
        logEntries.push(
          `${faction.name} ${delta >= 0 ? 'gained' : 'lost'} ${Math.abs(delta)} ${effect.key}.`,
        );
        break;
      }
      case 'score': {
        const faction = state.factions[effect.factionId];
        if (!faction) break;
        if (!SCORE_KEYS.has(effect.key)) break;
        const delta = clamp(effect.delta ?? 0, -8, 8);
        if (!Number.isFinite(delta)) break;
        applyScoreDelta(faction, effect.key, delta);
        logEntries.push(
          `${faction.name} ${effect.key === 'capabilityScore' ? 'capability' : 'safety'} ${
            delta >= 0 ? 'improved' : 'declined'
          } by ${Math.abs(delta)}.`,
        );
        break;
      }
      case 'stat': {
        const faction = state.factions[effect.factionId];
        if (!faction) break;
        if (!STAT_KEYS.has(effect.key)) break;
        const delta = clamp(effect.delta ?? 0, -6, 6);
        if (!Number.isFinite(delta)) break;
        applyStatDelta(faction, effect.key, delta);
        logEntries.push(
          `${faction.name} ${effect.key} ${delta >= 0 ? 'rose' : 'fell'} by ${Math.abs(delta)}.`,
        );
        break;
      }
      case 'research': {
        const faction = state.factions[effect.factionId];
        if (!faction) break;
        if (!BRANCH_KEYS.has(effect.branch)) break;
        const delta = clamp(effect.delta ?? 0, -16, 16);
        if (!Number.isFinite(delta)) break;
        const nextValue = Math.max(0, faction.research[effect.branch] + delta);
        faction.research[effect.branch] = nextValue;
        logEntries.push(
          `${faction.name} research in ${effect.branch} ${delta >= 0 ? 'advanced' : 'set back'} by ${Math.abs(
            delta,
          )} RP.`,
        );
        break;
      }
      case 'unlock': {
        const faction = state.factions[effect.factionId];
        if (!faction) break;
        const node = TECH_BY_ID.get(effect.techId);
        if (!node) break;
        const prereqsMet = node.prereqs.every((id) => faction.unlockedTechs.has(id));
        if (!prereqsMet) break;
        if (faction.unlockedTechs.has(node.id)) break;
        faction.unlockedTechs.add(node.id);
        logEntries.push(`${faction.name} unlocked ${node.name}.`);
        break;
      }
      case 'log': {
        if (effect.message) logEntries.push(effect.message);
        break;
      }
      default:
        break;
    }
  }

  for (const faction of Object.values(state.factions)) {
    const unlocked = unlockAvailableTechs(faction);
    for (const techId of unlocked) {
      const node = TECH_BY_ID.get(techId);
      logEntries.push(`${faction.name} unlocked ${node?.name ?? techId}.`);
    }
  }

  state.globalSafety = computeGlobalSafety(state);

  if (result.summary) {
    logEntries.push(`Narrative: ${result.summary}`);
  }

  return logEntries;
};
