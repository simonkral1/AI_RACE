import { ACTIONS } from '../data/actions.js';
import { ACTION_POINTS_PER_TURN, DETECTION, ESPIONAGE, GOVERNMENT_VICTORY, MAX_TURN, OPENNESS_MULTIPLIERS, SAFETY_THRESHOLDS } from './constants.js';
import { computeGlobalSafety, applyResourceDelta, applyScoreDelta, applyStatDelta, computeResearchGain } from './stats.js';
import { unlockAvailableTechs } from './tech.js';
import { clamp } from './utils.js';
import { ActionChoice, ActionDefinition, FactionState, GameState, Openness } from './types.js';
import {
  checkVictoryConditions,
  checkLossConditions,
  VictoryType,
  LossType,
} from './victoryConditions.js';

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
    // Capital income - public opinion now affects funding
    const opinionBonus = (faction.publicOpinion - 50) * 0.02; // ±1 capital from opinion
    const income = 4 + faction.resources.trust * 0.04 + faction.resources.influence * 0.02 + opinionBonus;
    faction.resources.capital = clamp(faction.resources.capital + income, 0, 100);

    // Research income scales with compute, data, and talent
    const researchBase = 8;
    const computeBonus = faction.resources.compute * 0.08;
    const dataBonus = faction.resources.data * 0.05;
    const talentBonus = faction.resources.talent * 0.03;
    const researchIncome = researchBase + computeBonus + dataBonus + talentBonus;

    // Distribute research points across branches based on faction focus
    const safetyRatio = faction.safetyScore / (faction.safetyScore + faction.capabilityScore + 1);
    const capabilityRatio = 1 - safetyRatio;

    faction.research.capabilities += researchIncome * capabilityRatio * 0.6;
    faction.research.safety += researchIncome * safetyRatio * 0.4 + 2;
    faction.research.ops += researchIncome * 0.25;
    faction.research.policy += researchIncome * 0.1; // Labs get some policy research too
  } else {
    // Government capital income
    const income = 5 + faction.resources.influence * 0.03 + faction.resources.trust * 0.02;
    faction.resources.capital = clamp(faction.resources.capital + income, 0, 100);

    // Governments get policy and safety research income
    const policyIncome = 5 + faction.resources.influence * 0.05;
    faction.research.policy += policyIncome;
    faction.research.safety += 2 + faction.resources.trust * 0.02; // Govs contribute to safety research
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
  state: GameState,
  rng: () => number,
  log: string[],
): void => {
  if (!target || target.id === attacker.id) return;

  // Success scales with attacker opsec vs target security level
  const successChance = clamp(
    0.05,
    0.85,
    ESPIONAGE.baseSuccess + attacker.opsec * ESPIONAGE.opsecAttackFactor - target.opsec * ESPIONAGE.opsecDefenseFactor - target.securityLevel * 0.04,
  );

  if (rng() < successChance) {
    // Steal from highest-value branch
    const targetBranches = Object.entries(target.research).sort((a, b) => b[1] - a[1]);
    const [branch] = targetBranches[0];
    const stolen = Math.min(12 + attacker.opsec * 0.1, target.research[branch as keyof typeof target.research]);
    target.research[branch as keyof typeof target.research] -= stolen;
    attacker.research[branch as keyof typeof attacker.research] += stolen;
    log.push(`${attacker.name} stole ${stolen.toFixed(1)} ${branch} research from ${target.name}.`);

    // Chance to also steal tech insights (small capability/safety boost)
    if (rng() < 0.3 && target.capabilityScore > attacker.capabilityScore) {
      applyScoreDelta(attacker, 'capabilityScore', 2);
      log.push(`${attacker.name} gained capability insights from ${target.name}'s research.`);
    }
  }

  // Detection scales with target security level
  const detectionChance = 0.15 + target.securityLevel * 0.05 + target.opsec * 0.002;
  if (rng() < detectionChance) {
    applyResourceDelta(attacker, { trust: -6, influence: -4 });
    applyResourceDelta(target, { trust: 2 });
    // Generate tension between factions
    raiseTension(state, attacker.id, target.id, 15);
    // Public opinion hit for the attacker
    attacker.publicOpinion = clamp(attacker.publicOpinion - 8, 0, 100);
    log.push(`${attacker.name} was caught spying on ${target.name}! Tensions rise.`);
  }
};

/** Raise tension between two factions */
const raiseTension = (state: GameState, factionA: string, factionB: string, amount: number): void => {
  const key = [factionA, factionB].sort().join(':');
  const current = state.tensions.get(key) ?? 0;
  state.tensions.set(key, clamp(current + amount, 0, 100));
};

/** Get tension between two factions */
const getTension = (state: GameState, factionA: string, factionB: string): number => {
  const key = [factionA, factionB].sort().join(':');
  return state.tensions.get(key) ?? 0;
};

/** Decay tensions slightly each turn (cool-down) */
const decayTensions = (state: GameState): void => {
  for (const [key, value] of state.tensions.entries()) {
    const decayed = value * 0.92; // 8% decay per turn
    if (decayed < 1) {
      state.tensions.delete(key);
    } else {
      state.tensions.set(key, decayed);
    }
  }
};

/** Update public opinion based on faction state */
const updatePublicOpinion = (faction: FactionState, state: GameState): void => {
  // Safety score improves opinion
  const safetyPull = (faction.safetyScore - 30) * 0.05;
  // Trust improves opinion
  const trustPull = (faction.resources.trust - 50) * 0.03;
  // High exposure hurts opinion
  const exposureDrag = -faction.exposure * 0.5;
  // High capability without safety scares people
  const safetyGap = faction.capabilityScore - faction.safetyScore;
  const gapPenalty = safetyGap > 20 ? -(safetyGap - 20) * 0.15 : 0;

  const drift = safetyPull + trustPull + exposureDrag + gapPenalty;
  faction.publicOpinion = clamp(faction.publicOpinion + drift, 0, 100);
};

/** Helper to add or retrieve alliance list for a faction */
const getAllianceList = (state: GameState, factionId: string): string[] => {
  if (!state.alliances.has(factionId)) {
    state.alliances.set(factionId, []);
  }
  return state.alliances.get(factionId)!;
};

/** Apply score effects from an action definition */
const applyActionScoreEffects = (faction: FactionState, action: ActionDefinition): void => {
  if (action.scoreEffects) {
    if (action.scoreEffects.capabilityDelta) {
      applyScoreDelta(faction, 'capabilityScore', action.scoreEffects.capabilityDelta);
    }
    if (action.scoreEffects.safetyDelta) {
      applyScoreDelta(faction, 'safetyScore', action.scoreEffects.safetyDelta);
    }
  }
  if (action.securityLevelDelta) {
    faction.securityLevel = clamp(faction.securityLevel + action.securityLevelDelta, 1, 5);
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

  // Check faction type permission
  if (!action.allowedFor.includes(faction.type)) {
    state.log.push(`${faction.name} attempted invalid action ${action.name}.`);
    return;
  }

  // Check faction-specific permission
  if (action.factionSpecific && action.factionSpecific !== faction.id) {
    state.log.push(`${faction.name} attempted ${action.name} which is not available to them.`);
    return;
  }

  applyResourceDelta(faction, action.baseResourceDelta);
  applyOpenness(faction, choice.openness);
  resolveResearch(faction, action, choice.openness);
  applyActionScoreEffects(faction, action);

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
      resolveEspionage(faction, target, state, rng, state.log);
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

    // ============================================================
    // NEW EXPANDED ACTION HANDLERS
    // ============================================================

    case 'hire_talent':
      state.log.push(`${faction.name} recruited top talent.`);
      break;

    case 'publish_research':
      state.log.push(`${faction.name} published research findings.`);
      break;

    case 'form_alliance': {
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId] : undefined;
      if (target && target.id !== faction.id) {
        const factionAlliances = getAllianceList(state, faction.id);
        const targetAlliances = getAllianceList(state, target.id);

        if (!factionAlliances.includes(target.id)) {
          factionAlliances.push(target.id);
          targetAlliances.push(faction.id);
          state.log.push(`${faction.name} formed an alliance with ${target.name}.`);
        }
      }
      break;
    }

    case 'secure_funding':
      state.log.push(`${faction.name} secured additional funding.`);
      break;

    case 'hardware_partnership':
      state.log.push(`${faction.name} established a hardware partnership.`);
      break;

    case 'open_source_release':
      // Give capability boost to all other labs (capability leak)
      for (const otherFaction of Object.values(state.factions)) {
        if (otherFaction.type === 'lab' && otherFaction.id !== faction.id) {
          applyScoreDelta(otherFaction, 'capabilityScore', 2);
        }
      }
      state.log.push(`${faction.name} released an open source model.`);
      break;

    case 'defensive_measures':
      applyStatDelta(faction, 'opsec', 8);
      state.log.push(`${faction.name} implemented defensive security measures.`);
      break;

    case 'accelerate_timeline':
      state.log.push(`${faction.name} accelerated their development timeline.`);
      break;

    case 'safety_pause':
      state.log.push(`${faction.name} initiated a safety pause.`);
      break;

    // ============================================================
    // FACTION-SPECIFIC ABILITY HANDLERS
    // ============================================================

    case 'open_research':
      // OpenBrain: Share research openly for trust
      state.log.push(`${faction.name} openly shared their research methodology.`);
      break;

    case 'move_fast':
      // Nexus Labs: Rapid development with exposure
      faction.exposure += 2; // Additional exposure on top of base
      state.log.push(`${faction.name} moved fast on capability development.`);
      break;

    case 'state_resources':
      // DeepCent: Access state compute resources
      state.log.push(`${faction.name} leveraged state compute resources.`);
      break;

    case 'executive_order': {
      // US Gov: Instant strong regulation
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId] : undefined;
      if (target && target.type === 'lab') {
        applyResourceDelta(target, { compute: -10, influence: -4 });
        applyScoreDelta(target, 'capabilityScore', -8);
        applyScoreDelta(target, 'safetyScore', 4);
        state.log.push(`${faction.name} issued an executive order affecting ${target.name}.`);
      }
      break;
    }

    case 'strategic_initiative': {
      // CN Gov: Boost allied lab
      const target = choice.targetFactionId ? state.factions[choice.targetFactionId] : undefined;
      if (target && target.type === 'lab') {
        applyResourceDelta(target, { compute: 12, capital: 8, data: 6 });
        applyScoreDelta(target, 'capabilityScore', 4);
        state.log.push(`${faction.name} launched a strategic initiative supporting ${target.name}.`);
      }
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

  // Alliance benefits: allies share small research bonuses
  for (const [factionId, allies] of state.alliances.entries()) {
    const faction = state.factions[factionId];
    if (!faction || allies.length === 0) continue;
    for (const allyId of allies) {
      const ally = state.factions[allyId];
      if (!ally) continue;
      // Small trust bonus from alliance
      const tension = getTension(state, factionId, allyId);
      if (tension < 30) {
        faction.resources.trust = clamp(faction.resources.trust + 0.5, 0, 100);
      }
    }
  }

  // Update public opinion and decay tensions
  for (const faction of Object.values(state.factions)) {
    updatePublicOpinion(faction, state);
  }
  decayTensions(state);

  state.globalSafety = computeGlobalSafety(state);

  // Check AGI deployments using expanded victory conditions
  for (const factionId of deployAttempts) {
    const faction = state.factions[factionId];
    if (!faction) continue;

    // Check for safe AGI victory
    const victoryResult = checkVictoryConditions(state, factionId, true);
    if (victoryResult.victory && victoryResult.type === 'safe_agi') {
      state.gameOver = true;
      state.winnerId = faction.id;
      state.victoryType = victoryResult.type;
      state.log.push(victoryResult.message);
      return;
    }

    // Check for catastrophe loss
    const lossResult = checkLossConditions(state, factionId, true);
    if (lossResult.loss && lossResult.type === 'catastrophe') {
      state.gameOver = true;
      state.winnerId = undefined;
      state.lossType = lossResult.type;
      state.loserId = factionId;
      state.log.push(lossResult.message);
      return;
    }
  }

  // Check for non-deployment victory/loss conditions for all factions
  for (const faction of Object.values(state.factions)) {
    // Check victory conditions (dominant, public trust, alliance, control)
    const victoryResult = checkVictoryConditions(state, faction.id, false);
    if (victoryResult.victory) {
      state.gameOver = true;
      state.winnerId = faction.id;
      state.victoryType = victoryResult.type;
      state.log.push(victoryResult.message);
      return;
    }

    // Check loss conditions (collapse, obsolescence, coup)
    const lossResult = checkLossConditions(state, faction.id, false);
    if (lossResult.loss) {
      // For now, only end game if the player faction would lose
      // (can be expanded to handle AI faction losses differently)
      state.log.push(`Warning: ${lossResult.message}`);
    }
  }

  // Check for government victory: time limit reached with all labs safe
  if (state.turn >= MAX_TURN) {
    const result = checkGovernmentVictory(state);
    if (result.victory) {
      state.gameOver = true;
      state.winnerId = result.winnerId;
      state.victoryType = 'regulatory';
      state.log.push(result.message);
    } else {
      // Time ran out without resolution - stalemate
      state.gameOver = true;
      state.winnerId = undefined;
      state.log.push('The AGI race ended in stalemate. No faction achieved a decisive outcome.');
    }
  }
};

/**
 * Check if governments have achieved victory by keeping all labs safe until the time limit.
 * Governments win if all labs have safetyScore >= threshold and global safety is high.
 */
export const checkGovernmentVictory = (state: GameState): {
  victory: boolean;
  winnerId?: string;
  message: string;
} => {
  const labs = Object.values(state.factions).filter(f => f.type === 'lab');
  const governments = Object.values(state.factions).filter(f => f.type === 'government');

  // Check if all labs meet safety threshold
  const allLabsSafe = labs.every(lab => lab.safetyScore >= GOVERNMENT_VICTORY.allLabsSafeThreshold);
  const globalSafetyMet = state.globalSafety >= GOVERNMENT_VICTORY.globalSafetyThreshold;

  if (allLabsSafe && globalSafetyMet) {
    // Find the government with highest influence as the winner
    const winningGov = governments.sort((a, b) => b.resources.influence - a.resources.influence)[0];
    return {
      victory: true,
      winnerId: winningGov?.id,
      message: `${winningGov?.name ?? 'Governments'} achieved regulatory victory! All labs maintained safe practices through ${state.year}.`,
    };
  }

  return {
    victory: false,
    message: 'Government victory conditions not met.',
  };
};
