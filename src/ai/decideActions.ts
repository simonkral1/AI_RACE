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

/** Pick the best secondary action for a lab based on current state */
const pickLabSecondary = (
  faction: FactionState,
  strategy: ReturnType<typeof getStrategy>,
  state: GameState,
  openness: Openness,
  rng: () => number,
): ActionChoice => {
  // Critical needs first
  if (faction.resources.capital < 30) {
    return { actionId: 'deploy_products', openness: 'open' };
  }
  if (faction.resources.compute < 50) {
    return { actionId: 'build_compute', openness: 'open' };
  }
  if (faction.resources.talent < 40) {
    return { actionId: 'hire_talent', openness: 'open' };
  }

  // Strategic choices based on personality
  if (strategy.safetyFocus > 60 && faction.resources.trust < 70) {
    return { actionId: 'publish_research', openness: 'open' };
  }
  if (strategy.riskTolerance > 50 && faction.resources.compute > 70) {
    return { actionId: 'hardware_partnership', openness };
  }
  if (faction.publicOpinion < 40) {
    return { actionId: 'publish_research', openness: 'open' };
  }
  if (faction.opsec < 40 && strategy.opennessPreference < 50) {
    return { actionId: 'defensive_measures', openness: 'open' };
  }

  // Fallback to weighted random
  const options = ['policy', 'deploy_products', 'build_compute', 'hire_talent'];
  const pick = pickOne(rng, options.filter((id) => ACTION_IDS.has(id)));
  return { actionId: pick, openness: 'open' };
};

export const decideActionsHeuristic = (state: GameState, factionId: string, rng: () => number): ActionChoice[] => {
  const faction = state.factions[factionId];
  if (!faction) return [];
  const strategy = getStrategy(factionId);

  const choices: ActionChoice[] = [];
  const openness = getOpenness(strategy.opennessPreference, rng);

  if (faction.type === 'lab') {
    // AGI deployment check
    if (faction.canDeployAgi) {
      const safe = faction.safetyScore >= SAFETY_THRESHOLDS.faction && state.globalSafety >= SAFETY_THRESHOLDS.global;
      if (safe) {
        choices.push({ actionId: 'deploy_agi', openness: 'open' });
        return choices;
      }
    }

    // Faction-specific abilities - use them when conditions are right
    if (factionId === 'us_lab_a' && faction.resources.trust < 80 && rng() < 0.4) {
      choices.push({ actionId: 'open_research', openness: 'open' });
    } else if (factionId === 'us_lab_b' && strategy.riskTolerance > 50 && faction.capabilityScore < 60 && rng() < 0.35) {
      choices.push({ actionId: 'move_fast', openness: 'secret' });
    } else if (factionId === 'cn_lab' && faction.resources.compute < 70 && rng() < 0.4) {
      choices.push({ actionId: 'state_resources', openness: 'secret' });
    } else {
      // Primary action: research
      const safetyGap = SAFETY_THRESHOLDS.faction - faction.safetyScore;
      const capSafetyRatio = faction.capabilityScore / (faction.safetyScore + 1);
      const prioritizeSafety = safetyGap > 0 || strategy.safetyFocus > strategy.riskTolerance || capSafetyRatio > 2;

      // Aggressive labs occasionally accelerate
      if (!prioritizeSafety && strategy.riskTolerance > 55 && rng() < 0.2) {
        choices.push({ actionId: 'accelerate_timeline', openness: 'secret' });
      } else if (prioritizeSafety) {
        choices.push({ actionId: 'research_safety', openness });
      } else {
        choices.push({ actionId: 'research_capabilities', openness });
      }
    }

    // Secondary action
    if (choices.length < 2) {
      choices.push(pickLabSecondary(faction, strategy, state, openness, rng));
    }
  } else {
    // Government logic - more nuanced
    const allies = alliedLabs(factionId, state);

    // Primary action
    if (state.globalSafety < SAFETY_THRESHOLDS.global) {
      const target = topCapabilityLab(state);
      if (target && !allies.some(a => a.id === target.id)) {
        // Regulate non-allied labs
        choices.push({ actionId: 'regulate', openness: 'open', targetFactionId: target.id });
      } else {
        // If top lab is an ally, focus on policy instead
        choices.push({ actionId: 'policy', openness: 'open' });
      }
    } else if (allies.length > 0 && faction.resources.capital > 30) {
      // Boost weakest ally
      const weakest = allies.sort((a, b) => a.capabilityScore - b.capabilityScore)[0];
      choices.push({ actionId: 'subsidize', openness: 'open', targetFactionId: weakest.id });
    } else {
      choices.push({ actionId: 'policy', openness: 'open' });
    }

    // Use faction-specific abilities
    if (factionId === 'us_gov' && state.globalSafety < 40 && rng() < 0.3) {
      const target = topCapabilityLab(state);
      if (target) {
        choices.push({ actionId: 'executive_order', openness: 'open', targetFactionId: target.id });
      }
    } else if (factionId === 'cn_gov' && allies.length > 0 && faction.resources.capital > 20) {
      const ally = allies[0];
      if (rng() < 0.35) {
        choices.push({ actionId: 'strategic_initiative', openness: 'secret', targetFactionId: ally.id });
      }
    }

    // Secondary action if needed
    if (choices.length < 2) {
      if (strategy.espionageFocus > 35) {
        const target = topCapabilityLab(state);
        if (target && target.id !== factionId && !allies.some(a => a.id === target.id)) {
          choices.push({ actionId: 'espionage', openness: 'secret', targetFactionId: target.id });
        } else {
          choices.push({ actionId: 'counterintel', openness: 'open' });
        }
      } else if (faction.resources.capital < 40) {
        choices.push({ actionId: 'secure_funding', openness: 'open' });
      } else {
        choices.push({ actionId: 'counterintel', openness: 'open' });
      }
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
