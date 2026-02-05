import type { GameState } from '../core/types.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import type { EventChoice, EventDefinition } from '../data/events.js';
import { callLlm } from './llmClient.js';

const getFactionStrategy = (factionId: string) => {
  const template = FACTION_TEMPLATES.find((item) => item.id === factionId);
  return template?.strategy;
};

const scoreChoice = (choice: EventChoice, factionId: string, state: GameState): number => {
  const faction = state.factions[factionId];
  if (!faction) return 0;
  const strategy = getFactionStrategy(factionId);
  const safetyWeight = (strategy?.safetyFocus ?? 50) / 50;
  const riskWeight = (strategy?.riskTolerance ?? 50) / 50;
  const influenceWeight = faction.type === 'government' ? 1.4 : 0.7;

  let score = 0;
  for (const effect of choice.effects) {
    switch (effect.kind) {
      case 'score':
        if (effect.key === 'safetyScore') score += effect.delta * safetyWeight;
        if (effect.key === 'capabilityScore') score += effect.delta * riskWeight;
        break;
      case 'resource':
        if (effect.key === 'trust') score += effect.delta * safetyWeight;
        if (effect.key === 'influence') score += effect.delta * influenceWeight;
        if (effect.key === 'compute') score += effect.delta * riskWeight;
        if (effect.key === 'capital') score += effect.delta * 0.4;
        if (effect.key === 'talent') score += effect.delta * 0.6;
        break;
      case 'stat':
        if (effect.key === 'safetyCulture') score += effect.delta * safetyWeight;
        if (effect.key === 'opsec') score += effect.delta * 0.4;
        break;
      case 'globalSafety':
        score += effect.delta * (faction.type === 'government' ? 1.5 : 0.8);
        break;
      case 'research':
        score += effect.delta * 0.5;
        break;
      default:
        break;
    }
  }

  return score;
};

const extractChoiceId = (raw: string, choices: EventChoice[]): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const json = JSON.parse(trimmed) as { choiceId?: string };
    if (json.choiceId && choices.some((choice) => choice.id === json.choiceId)) {
      return json.choiceId;
    }
  } catch {
    // fall through
  }
  const match = choices.find((choice) => trimmed.includes(choice.id));
  return match?.id ?? null;
};

export const pickEventChoice = async (
  state: GameState,
  factionId: string,
  event: EventDefinition,
): Promise<string> => {
  const faction = state.factions[factionId];
  if (!faction) return event.choices[0].id;

  const strategy = getFactionStrategy(factionId);
  const payload = {
    instruction: 'Pick the best choiceId for your faction. JSON only as {"choiceId":"..."}.',
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      choices: event.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        description: choice.description,
        effects: choice.effects,
      })),
    },
    faction: {
      id: faction.id,
      name: faction.name,
      type: faction.type,
      strategy,
      resources: faction.resources,
      safetyScore: faction.safetyScore,
      capabilityScore: faction.capabilityScore,
    },
    globalSafety: state.globalSafety,
  };

  const content = await callLlm(
    [
      { role: 'system', content: 'You are a strategy game AI. Output JSON only.' },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { maxTokens: 120, temperature: 0.4, topP: 0.8 },
  );

  if (content) {
    const choiceId = extractChoiceId(content, event.choices);
    if (choiceId) return choiceId;
  }

  const scored = event.choices
    .map((choice) => ({ id: choice.id, score: scoreChoice(choice, factionId, state) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? event.choices[0].id;
};
