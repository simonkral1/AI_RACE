import { ACTIONS } from '../data/actions.js';
import { ACTION_POINTS_PER_TURN, DETECTION, OPENNESS_MULTIPLIERS, SAFETY_THRESHOLDS } from './constants.js';
import { computeGlobalSafety, applyResourceDelta, applyScoreDelta, applyStatDelta, computeResearchGain } from './stats.js';
import { unlockAvailableTechs } from './tech.js';
import { clamp } from './utils.js';
import { ActionChoice, ActionDefinition, FactionState, GameState, Openness } from './types.js';

const ACTION_MAP = new Map(ACTIONS.map((action) => [action.id, action]));

const getAction = (actionId: string): ActionDefinition => {
  const action = ACTION_MAP.get(actionId);
  if (!action) {
    throw new Error(`Unknown action: ${actionId}`);
  }
  return action;
};

const applyIncome = (faction: FactionState): void => {
  if (faction.type === 'lab') {
    const income = 4 + faction.resources.trust * 0.04 + faction.resources.influence * 0.02;
    faction.resources.capital = clamp(faction.resources.capital + income, 0, 100);
  } else {
    const income = 5 + faction.resources.influence * 0.03 + faction.resources.trust * 0.02;
    faction.resources.capital = clamp(faction.resources.capital + income, 0, 100);
  }
};

const applyOpenness = (faction: FactionState, openness: Openness): void => {
  const mod = OPENNESS_MULTIPLIERS[openness];
  if (mod.trustDelta) {
    applyResourceDelta(faction, { trust: mod.trustDelta });
  }
  if (mod.safetyDelta) {
    applyScoreDelta(faction, 'safetyScore', mod.safetyDelta);
  }
  if (mod.capabilityDelta) {
    applyScoreDelta(faction, 'capabilityScore', mod.capabilityDelta);
  }
};

const resolveResearch = (faction: FactionState, action: ActionDefinition, openness: Openness): void => {
  for (const [branch, base] of Object.entries(action.baseResearch)) {
    const branchId = branch as keyof typeof action.baseResearch;
    if (base === undefined) continue;
    const gain = computeResearchGain(faction, branchId, base) * OPENNESS_MULTIPLIERS[openness].research;
    faction.research[branchId] += gain;
  }
};

const resolveEspionage = (
  attacker: FactionState,
  target: FactionState | undefined,
  rng: () => number,
  log: string[],
): void => {
  if (!target || target.id === attacker.id) return;
  const successChance = clamp(
    0.05,
    0.85,
    0.35 + attacker.opsec * 0.002 - target.opsec * 0.004,
  );

  if (rng() < successChance) {
    const targetBranches = Object.entries(target.research).sort((a, b) => b[1] - a[1]);
    const [branch] = targetBranches[0];
    const stolen = Math.min(12, target.research[branch as keyof typeof target.research]);
    target.research[branch as keyof typeof target.research] -= stolen;
    attacker.research[branch as keyof typeof attacker.research] += stolen;
    log.push(`${attacker.name} stole ${stolen.toFixed(1)} research from ${target.name}.`);
  }

  const detectionRoll = rng();
  if (detectionRoll < 0.25) {
    applyResourceDelta(attacker, { trust: -6, influence: -4 });
    applyResourceDelta(target, { trust: 2 });
    log.push(`${attacker.name} was caught conducting espionage against ${target.name}.`);
  }
};

const resolveAction = (
  faction: FactionState,
  choice: ActionChoice,
  state: GameState,
  rng: () => number,
  deployAttempts: string[],
): void => {
  const action = getAction(choice.actionId);
  if (!action.allowedFor.includes(faction.type)) {
    state.log.push(`${faction.name} attempted invalid action ${action.name}.`);
    return;
  }

  applyResourceDelta(faction, action.baseResourceDelta);
  applyOpenness(faction, choice.openness);
  resolveResearch(faction, action, choice.openness);

  if (choice.openness === 'secret') {
    faction.exposure += action.exposure;
  }

  switch (action.kind) {
    case 'build_compute':
      break;
    case 'deploy_products':
      break;
    case 'deploy_agi': {
      if (!faction.canDeployAgi) {
        state.log.push(`${faction.name} attempted AGI deployment without the breakthrough.`);
        break;
      }
      deployAttempts.push(faction.id);
      break;
    }
    case 'policy':
      break;
    case 'espionage': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId] : undefined;
      resolveEspionage(faction, target, rng, state.log);
      break;
    }
    case 'subsidize': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId] : undefined;
      if (target && target.type === 'lab') {
        applyResourceDelta(target, { capital: 6 });
        state.log.push(`${faction.name} subsidized ${target.name}.`);
      }
      break;
    }
    case 'regulate': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId] : undefined;
      if (target && target.type === 'lab') {
        applyResourceDelta(target, { compute: -6, influence: -2 });
        applyScoreDelta(target, 'capabilityScore', -4);
        state.log.push(`${faction.name} imposed regulations on ${target.name}.`);
      }
      break;
    }
    case 'counterintel': {
      applyStatDelta(faction, 'opsec', 6);
      break;
    }
    default:
      break;
  }
};

const resolveDetection = (faction: FactionState, state: GameState, rng: () => number): void => {
  if (faction.exposure <= 0) return;
  const chance = clamp(
    0,
    DETECTION.maxChance,
    DETECTION.baseChance + faction.exposure * DETECTION.perExposure - faction.opsec * DETECTION.opsecFactor,
  );
  if (rng() < chance) {
    applyResourceDelta(faction, { trust: -8, influence: -5 });
    applyScoreDelta(faction, 'safetyScore', -5);
    state.log.push(`${faction.name} was exposed for secret activity.`);
    faction.exposure = 0;
  }
};

const advanceCalendar = (state: GameState): void => {
  state.turn += 1;
  state.quarter += 1;
  if (state.quarter > 4) {
    state.quarter = 1;
    state.year += 1;
  }
};

export const resolveTurn = (
  state: GameState,
  choices: Record<string, ActionChoice[]>,
  rng: () => number,
): void => {
  if (state.gameOver) return;

  const deployAttempts: string[] = [];
  advanceCalendar(state);
  state.log.push(`--- ${state.year} Q${state.quarter} ---`);

  for (const faction of Object.values(state.factions)) {
    applyIncome(faction);
  }

  for (const [factionId, actionChoices] of Object.entries(choices)) {
    const faction = state.factions[factionId];
    if (!faction) continue;
    const limited = actionChoices.slice(0, ACTION_POINTS_PER_TURN);
    for (const choice of limited) {
      resolveAction(faction, choice, state, rng, deployAttempts);
    }
  }

  for (const faction of Object.values(state.factions)) {
    resolveDetection(faction, state, rng);
  }

  for (const faction of Object.values(state.factions)) {
    const unlocked = unlockAvailableTechs(faction);
    for (const techId of unlocked) {
      state.log.push(`${faction.name} unlocked ${techId}.`);
    }
  }

  state.globalSafety = computeGlobalSafety(state);

  for (const factionId of deployAttempts) {
    const faction = state.factions[factionId];
    if (!faction) continue;
    const hasSafety = faction.safetyScore >= SAFETY_THRESHOLDS.faction && state.globalSafety >= SAFETY_THRESHOLDS.global;
    if (hasSafety) {
      state.gameOver = true;
      state.winnerId = faction.id;
      state.log.push(`${faction.name} deployed safe AGI and wins.`);
      return;
    }
    state.gameOver = true;
    state.winnerId = undefined;
    state.log.push(`${faction.name} deployed unsafe AGI. Global catastrophe.`);
    return;
  }
};
