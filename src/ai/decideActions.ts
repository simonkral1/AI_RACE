import { ACTIONS } from '../data/actions.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { SAFETY_THRESHOLDS } from '../core/constants.js';
import { ActionChoice, FactionState, GameState, Openness } from '../core/types.js';
import { pickOne } from '../core/utils.js';
import { decideActionsWithLlm } from './llmDecision.js';

const ACTION_IDS = new Set(ACTIONS.map((action) => action.id));

const getStrategy = (factionId: string) => {
  const template = FACTION_TEMPLATES.find((item) => item.id === factionId);
  if (!template) {
    throw new Error(`Missing strategy for ${factionId}`);
  }
  return template.strategy;
};

const getOpenness = (preference: number, rng: () => number): Openness => {
  const roll = rng() * 100;
  return roll < preference ? 'open' : 'secret';
};

const topCapabilityLab = (state: GameState): FactionState | undefined => {
  const labs = Object.values(state.factions).filter((f) => f.type === 'lab');
  return labs.sort((a, b) => b.capabilityScore - a.capabilityScore)[0];
};

const alliedLabs = (factionId: string, state: GameState): FactionState[] => {
  if (factionId === 'us_gov') {
    return ['us_lab_a', 'us_lab_b'].map((id) => state.factions[id]).filter(Boolean);
  }
  if (factionId === 'cn_gov') {
    return ['cn_lab'].map((id) => state.factions[id]).filter(Boolean);
  }
  return [];
};

export const decideActionsHeuristic = (state: GameState, factionId: string, rng: () => number): ActionChoice[] => {
  const faction = state.factions[factionId];
  if (!faction) return [];
  const strategy = getStrategy(factionId);

  const choices: ActionChoice[] = [];
  const openness = getOpenness(strategy.opennessPreference, rng);

  if (faction.type === 'lab') {
    if (faction.canDeployAgi) {
      const safe = faction.safetyScore >= SAFETY_THRESHOLDS.faction && state.globalSafety >= SAFETY_THRESHOLDS.global;
      if (safe) {
        choices.push({ actionId: 'deploy_agi', openness: 'open' });
        return choices;
      }
    }

    const safetyGap = SAFETY_THRESHOLDS.faction - faction.safetyScore;
    const prioritizeSafety = safetyGap > 0 || strategy.safetyFocus > strategy.riskTolerance;

    if (prioritizeSafety) {
      choices.push({ actionId: 'research_safety', openness });
    } else {
      choices.push({ actionId: 'research_capabilities', openness });
    }

    if (faction.resources.capital < 40) {
      choices.push({ actionId: 'deploy_products', openness: 'open' });
    } else if (faction.resources.compute < 60) {
      choices.push({ actionId: 'build_compute', openness: 'open' });
    } else {
      const options = ['policy', 'deploy_products', 'build_compute'];
      const pick = pickOne(rng, options.filter((id) => ACTION_IDS.has(id)));
      choices.push({ actionId: pick, openness: 'open' });
    }
  } else {
    if (state.globalSafety < SAFETY_THRESHOLDS.global) {
      const target = topCapabilityLab(state);
      if (target) {
        choices.push({ actionId: 'regulate', openness: 'open', targetFactionId: target.id });
      }
    }

    const allies = alliedLabs(factionId, state);
    if (allies.length > 0 && faction.resources.capital > 30) {
      const ally = allies.sort((a, b) => a.capabilityScore - b.capabilityScore)[0];
      choices.push({ actionId: 'subsidize', openness: 'open', targetFactionId: ally.id });
    } else {
      choices.push({ actionId: 'policy', openness: 'open' });
    }

    if (strategy.espionageFocus > 35) {
      const target = topCapabilityLab(state);
      if (target && target.id !== factionId) {
        choices.push({ actionId: 'espionage', openness: 'secret', targetFactionId: target.id });
      }
    } else {
      choices.push({ actionId: 'counterintel', openness: 'open' });
    }
  }

  return choices.slice(0, 2);
};

export const decideActions = async (
  state: GameState,
  factionId: string,
  rng: () => number,
): Promise<ActionChoice[]> => {
  const llmChoices = await decideActionsWithLlm(state, factionId);
  if (llmChoices) return llmChoices;
  return decideActionsHeuristic(state, factionId, rng);
};
