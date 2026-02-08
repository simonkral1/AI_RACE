/**
 * Victory Conditions System for AGI Race
 *
 * Defines multiple win and loss conditions for labs and governments.
 */

import { GameState, FactionState, FactionType } from './types.js';
import { MAX_TURN } from './constants.js';

// Victory Types
export type VictoryType =
  | 'safe_agi'       // Lab: Deploy safe AGI first
  | 'dominant'       // Lab: 80%+ capability lead
  | 'public_trust'   // Lab: 90+ trust with products deployed
  | 'regulatory'     // Government: All labs compliant by turn 32
  | 'alliance'       // Government: Form global safety treaty
  | 'control';       // Government: Nationalize/regulate all labs

// Loss Types
export type LossType =
  | 'catastrophe'    // Unsafe AGI deployed
  | 'obsolescence'   // Fall 50+ behind in capability
  | 'collapse'       // Trust below 20
  | 'coup';          // Government loses control of labs

// Minimum turn before any non-regulatory victory can trigger
export const MIN_VICTORY_TURN = 24; // No wins before 2032 Q1 - ensures games reach turn 25

// Victory thresholds
export const VICTORY_THRESHOLDS = {
  safeAgi: {
    factionSafety: 80,
    globalSafety: 70,
  },
  dominant: {
    capabilityLeadPercent: 100, // Must have 100%+ capability lead over second place
    minCapability: 90,          // Must have at least this much capability (prevents early trigger)
  },
  publicTrust: {
    minTrust: 97,               // Very high trust required
    minCapability: 80,          // Proxy for "products deployed"
  },
  regulatory: {
    maxTurn: MAX_TURN,
    labSafetyMin: 65,
    globalSafetyMin: 60,
  },
  alliance: {
    minTrust: 93,               // Trust threshold for each ally (very high to prevent early trigger)
    minAllies: 4,               // Need 4+ factions as allies
    minInfluence: 120,          // Government needs very high influence
  },
  control: {
    minInfluence: 120,          // Near-total control (raised to prevent early trigger)
    labCapabilityMax: 15,       // Labs must be heavily suppressed
  },
  // Loss thresholds
  catastrophe: {
    safetyThreshold: 70,
    globalSafetyThreshold: 60,
  },
  obsolescence: {
    capabilityGap: 50,
  },
  collapse: {
    minTrust: 20,
  },
  coup: {
    minInfluence: 30,           // Government influence threshold
    labCapabilityDanger: 70,    // Labs too powerful
  },
} as const;

// Result types
export interface VictoryResult {
  victory: boolean;
  type?: VictoryType;
  winnerId?: string;
  message: string;
  details?: Record<string, number | string>;
}

export interface LossResult {
  loss: boolean;
  type?: LossType;
  loserId?: string;
  message: string;
  details?: Record<string, number | string>;
}

export interface VictoryProgress {
  type: VictoryType | LossType;
  label: string;
  progress: number;        // 0-100
  isWarning?: boolean;     // True for loss conditions approaching threshold
  requirements: string[];
  currentStatus: string;
}

export interface VictoryDistances {
  safeAgi?: {
    safetyNeeded: number;
    globalSafetyNeeded: number;
    needsAgiCapability: boolean;
  };
  dominant?: {
    capabilityNeeded: number;
    currentLead: number;
  };
  publicTrust?: {
    trustNeeded: number;
    capabilityNeeded: number;
  };
  regulatory?: {
    labsCompliant: number;
    totalLabs: number;
    turnsRemaining: number;
  };
  alliance?: {
    alliesNeeded: number;
    currentAllies: number;
  };
  control?: {
    influenceNeeded: number;
    labsControlled: number;
  };
  // Loss warnings
  collapse?: {
    trustMargin: number;
  };
  obsolescence?: {
    capabilityGap: number;
    gapToSafe: number;
  };
  catastrophe?: {
    safetyMargin: number;
  };
}

/**
 * Check all victory conditions for a faction
 */
export function checkVictoryConditions(
  state: GameState,
  factionId: string,
  isDeployingAgi: boolean = false
): VictoryResult {
  const faction = state.factions[factionId];
  if (!faction) {
    return { victory: false, message: 'Faction not found' };
  }

  // No victories before minimum turn (except regulatory which has its own turn check)
  if (state.turn < MIN_VICTORY_TURN && faction.type === 'lab') {
    return { victory: false, message: `Too early for victory (turn ${state.turn}/${MIN_VICTORY_TURN})` };
  }

  // Check based on faction type
  if (faction.type === 'lab') {
    return checkLabVictory(state, faction, isDeployingAgi);
  } else {
    return checkGovernmentVictory(state, faction);
  }
}

/**
 * Check lab-specific victory conditions
 */
function checkLabVictory(
  state: GameState,
  faction: FactionState,
  isDeployingAgi: boolean
): VictoryResult {
  // Safe AGI Victory - highest priority when deploying
  if (isDeployingAgi && faction.canDeployAgi) {
    const safetyMet = faction.safetyScore >= VICTORY_THRESHOLDS.safeAgi.factionSafety;
    const globalMet = state.globalSafety >= VICTORY_THRESHOLDS.safeAgi.globalSafety;

    if (safetyMet && globalMet) {
      return {
        victory: true,
        type: 'safe_agi',
        winnerId: faction.id,
        message: `${faction.name} deployed safe AGI and wins the race!`,
        details: {
          factionSafety: faction.safetyScore,
          globalSafety: state.globalSafety,
        },
      };
    }
  }

  // Dominant Victory - check capability lead
  const dominantResult = checkDominantVictory(state, faction);
  if (dominantResult.victory) {
    return dominantResult;
  }

  // Public Trust Victory
  const trustResult = checkPublicTrustVictory(faction);
  if (trustResult.victory) {
    return trustResult;
  }

  return { victory: false, message: 'No victory conditions met' };
}

/**
 * Check dominant victory condition
 */
function checkDominantVictory(state: GameState, faction: FactionState): VictoryResult {
  if (faction.capabilityScore < VICTORY_THRESHOLDS.dominant.minCapability) {
    return { victory: false, message: 'Capability too low for dominant victory' };
  }

  // Find the second highest capability among labs
  const labs = Object.values(state.factions).filter(f => f.type === 'lab' && f.id !== faction.id);
  const maxOtherCapability = Math.max(0, ...labs.map(f => f.capabilityScore));

  // Calculate lead percentage
  if (maxOtherCapability === 0) {
    // Only lab standing
    return {
      victory: true,
      type: 'dominant',
      winnerId: faction.id,
      message: `${faction.name} achieved total technological dominance!`,
      details: {
        capability: faction.capabilityScore,
        lead: 100,
      },
    };
  }

  const leadRatio = ((faction.capabilityScore - maxOtherCapability) / maxOtherCapability) * 100;
  const hasLead = leadRatio >= VICTORY_THRESHOLDS.dominant.capabilityLeadPercent;

  if (hasLead) {
    return {
      victory: true,
      type: 'dominant',
      winnerId: faction.id,
      message: `${faction.name} achieved technological dominance with ${leadRatio.toFixed(0)}% lead!`,
      details: {
        capability: faction.capabilityScore,
        secondPlace: maxOtherCapability,
        leadPercent: leadRatio,
      },
    };
  }

  return { victory: false, message: 'Capability lead insufficient' };
}

/**
 * Check public trust victory condition
 */
function checkPublicTrustVictory(faction: FactionState): VictoryResult {
  const hasTrust = faction.resources.trust >= VICTORY_THRESHOLDS.publicTrust.minTrust;
  const hasProducts = faction.capabilityScore >= VICTORY_THRESHOLDS.publicTrust.minCapability;

  if (hasTrust && hasProducts) {
    return {
      victory: true,
      type: 'public_trust',
      winnerId: faction.id,
      message: `${faction.name} won through public trust and successful product deployment!`,
      details: {
        trust: faction.resources.trust,
        capability: faction.capabilityScore,
      },
    };
  }

  return { victory: false, message: 'Public trust conditions not met' };
}

/**
 * Check government-specific victory conditions
 */
function checkGovernmentVictory(state: GameState, faction: FactionState): VictoryResult {
  // Regulatory Victory (has its own turn check)
  const regulatoryResult = checkRegulatoryVictory(state, faction);
  if (regulatoryResult.victory) {
    return regulatoryResult;
  }

  // No non-regulatory government victories before minimum turn
  if (state.turn < MIN_VICTORY_TURN) {
    return { victory: false, message: `Too early for victory (turn ${state.turn}/${MIN_VICTORY_TURN})` };
  }

  // Alliance Victory
  const allianceResult = checkAllianceVictory(state, faction);
  if (allianceResult.victory) {
    return allianceResult;
  }

  // Control Victory
  const controlResult = checkControlVictory(state, faction);
  if (controlResult.victory) {
    return controlResult;
  }

  return { victory: false, message: 'No victory conditions met' };
}

/**
 * Check regulatory victory condition
 */
function checkRegulatoryVictory(state: GameState, faction: FactionState): VictoryResult {
  if (state.turn < VICTORY_THRESHOLDS.regulatory.maxTurn) {
    return { victory: false, message: 'Max turn not reached yet' };
  }

  const labs = Object.values(state.factions).filter(f => f.type === 'lab');
  const compliantLabs = labs.filter(
    lab => lab.safetyScore >= VICTORY_THRESHOLDS.regulatory.labSafetyMin
  );
  const globalSafetyMet = state.globalSafety >= VICTORY_THRESHOLDS.regulatory.globalSafetyMin;

  if (compliantLabs.length === labs.length && globalSafetyMet) {
    return {
      victory: true,
      type: 'regulatory',
      winnerId: faction.id,
      message: `${faction.name} achieved regulatory victory! All labs maintained safe practices through ${state.year}.`,
      details: {
        compliantLabs: compliantLabs.length,
        totalLabs: labs.length,
        globalSafety: state.globalSafety,
      },
    };
  }

  return { victory: false, message: 'Regulatory conditions not met' };
}

/**
 * Check alliance victory condition
 */
function checkAllianceVictory(state: GameState, faction: FactionState): VictoryResult {
  if (faction.resources.influence < VICTORY_THRESHOLDS.alliance.minInfluence) {
    return { victory: false, message: 'Insufficient influence for alliance' };
  }

  // Count factions with high trust (potential allies)
  const potentialAllies = Object.values(state.factions).filter(
    f => f.id !== faction.id && f.resources.trust >= VICTORY_THRESHOLDS.alliance.minTrust
  );

  if (potentialAllies.length >= VICTORY_THRESHOLDS.alliance.minAllies) {
    return {
      victory: true,
      type: 'alliance',
      winnerId: faction.id,
      message: `${faction.name} formed a global AI safety treaty with ${potentialAllies.length} factions!`,
      details: {
        allies: potentialAllies.length,
        influence: faction.resources.influence,
      },
    };
  }

  return { victory: false, message: 'Not enough allies for treaty' };
}

/**
 * Check control victory condition
 */
function checkControlVictory(state: GameState, faction: FactionState): VictoryResult {
  if (faction.resources.influence < VICTORY_THRESHOLDS.control.minInfluence) {
    return { victory: false, message: 'Insufficient influence for control' };
  }

  const labs = Object.values(state.factions).filter(f => f.type === 'lab');
  const controlledLabs = labs.filter(
    lab => lab.capabilityScore <= VICTORY_THRESHOLDS.control.labCapabilityMax
  );

  if (controlledLabs.length === labs.length) {
    return {
      victory: true,
      type: 'control',
      winnerId: faction.id,
      message: `${faction.name} achieved total control over AI development!`,
      details: {
        controlledLabs: controlledLabs.length,
        influence: faction.resources.influence,
      },
    };
  }

  return { victory: false, message: 'Labs not fully controlled' };
}

/**
 * Check all loss conditions for a faction
 */
export function checkLossConditions(
  state: GameState,
  factionId: string,
  isDeployingAgi: boolean = false
): LossResult {
  const faction = state.factions[factionId];
  if (!faction) {
    return { loss: false, message: 'Faction not found' };
  }

  // Catastrophe - unsafe AGI deployment
  if (isDeployingAgi && faction.canDeployAgi) {
    const safetyInsufficient = faction.safetyScore < VICTORY_THRESHOLDS.catastrophe.safetyThreshold;
    const globalInsufficient = state.globalSafety < VICTORY_THRESHOLDS.catastrophe.globalSafetyThreshold;

    if (safetyInsufficient || globalInsufficient) {
      return {
        loss: true,
        type: 'catastrophe',
        loserId: faction.id,
        message: `${faction.name} deployed unsafe AGI. Global catastrophe ensues.`,
        details: {
          factionSafety: faction.safetyScore,
          globalSafety: state.globalSafety,
        },
      };
    }
  }

  // Collapse - trust too low
  if (faction.resources.trust < VICTORY_THRESHOLDS.collapse.minTrust) {
    return {
      loss: true,
      type: 'collapse',
      loserId: faction.id,
      message: `${faction.name} collapsed due to loss of public trust.`,
      details: {
        trust: faction.resources.trust,
      },
    };
  }

  // Obsolescence - capability gap too large (for labs)
  if (faction.type === 'lab') {
    const maxCapability = Math.max(...Object.values(state.factions)
      .filter(f => f.type === 'lab' && f.id !== faction.id)
      .map(f => f.capabilityScore));

    if (maxCapability - faction.capabilityScore >= VICTORY_THRESHOLDS.obsolescence.capabilityGap) {
      return {
        loss: true,
        type: 'obsolescence',
        loserId: faction.id,
        message: `${faction.name} became obsolete, falling ${maxCapability - faction.capabilityScore} points behind.`,
        details: {
          capability: faction.capabilityScore,
          leaderCapability: maxCapability,
          gap: maxCapability - faction.capabilityScore,
        },
      };
    }
  }

  // Coup - government loses control (for governments)
  if (faction.type === 'government') {
    const lowInfluence = faction.resources.influence < VICTORY_THRESHOLDS.coup.minInfluence;
    const dangerousLabs = Object.values(state.factions)
      .filter(f => f.type === 'lab' && f.capabilityScore >= VICTORY_THRESHOLDS.coup.labCapabilityDanger);

    if (lowInfluence && dangerousLabs.length > 0) {
      return {
        loss: true,
        type: 'coup',
        loserId: faction.id,
        message: `${faction.name} lost control as AI labs became too powerful.`,
        details: {
          influence: faction.resources.influence,
          dangerousLabs: dangerousLabs.length,
        },
      };
    }
  }

  return { loss: false, message: 'No loss conditions met' };
}

/**
 * Calculate progress toward each victory condition
 */
export function calculateVictoryProgress(state: GameState, factionId: string): VictoryProgress[] {
  const faction = state.factions[factionId];
  if (!faction) return [];

  const progress: VictoryProgress[] = [];

  if (faction.type === 'lab') {
    // Safe AGI Victory progress
    const safetyProgress = Math.min(100, (faction.safetyScore / VICTORY_THRESHOLDS.safeAgi.factionSafety) * 100);
    const globalProgress = Math.min(100, (state.globalSafety / VICTORY_THRESHOLDS.safeAgi.globalSafety) * 100);
    const agiProgress = faction.canDeployAgi ? 100 : 0;

    progress.push({
      type: 'safe_agi',
      label: 'Safe AGI Victory',
      progress: Math.round((safetyProgress + globalProgress + agiProgress) / 3),
      requirements: [
        `Safety >= ${VICTORY_THRESHOLDS.safeAgi.factionSafety}`,
        `Global Safety >= ${VICTORY_THRESHOLDS.safeAgi.globalSafety}`,
        'AGI Capability unlocked',
      ],
      currentStatus: `Safety: ${faction.safetyScore.toFixed(0)}, Global: ${state.globalSafety.toFixed(0)}, AGI: ${faction.canDeployAgi ? 'Ready' : 'Not ready'}`,
    });

    // Dominant Victory progress
    const labs = Object.values(state.factions).filter(f => f.type === 'lab' && f.id !== faction.id);
    const maxOther = Math.max(0, ...labs.map(f => f.capabilityScore));
    const capabilityLead = maxOther > 0 ? ((faction.capabilityScore - maxOther) / maxOther) * 100 : 100;
    const dominantProgress = Math.min(100, Math.max(0, (capabilityLead / VICTORY_THRESHOLDS.dominant.capabilityLeadPercent) * 100));

    progress.push({
      type: 'dominant',
      label: 'Dominant Victory',
      progress: Math.round(dominantProgress),
      requirements: [
        `${VICTORY_THRESHOLDS.dominant.capabilityLeadPercent}%+ capability lead over competitors`,
        `Capability >= ${VICTORY_THRESHOLDS.dominant.minCapability}`,
      ],
      currentStatus: `Lead: ${capabilityLead.toFixed(0)}%, Capability: ${faction.capabilityScore.toFixed(0)}`,
    });

    // Public Trust Victory progress
    const trustProgress = Math.min(100, (faction.resources.trust / VICTORY_THRESHOLDS.publicTrust.minTrust) * 100);
    const productsProgress = Math.min(100, (faction.capabilityScore / VICTORY_THRESHOLDS.publicTrust.minCapability) * 100);

    progress.push({
      type: 'public_trust',
      label: 'Public Trust Victory',
      progress: Math.round((trustProgress + productsProgress) / 2),
      requirements: [
        `Trust >= ${VICTORY_THRESHOLDS.publicTrust.minTrust}`,
        `Capability >= ${VICTORY_THRESHOLDS.publicTrust.minCapability}`,
      ],
      currentStatus: `Trust: ${faction.resources.trust.toFixed(0)}, Capability: ${faction.capabilityScore.toFixed(0)}`,
    });

    // Loss condition warnings
    const collapseMargin = faction.resources.trust - VICTORY_THRESHOLDS.collapse.minTrust;
    const collapseProgress = Math.max(0, Math.min(100, 100 - (collapseMargin / 30) * 100));

    if (collapseProgress > 50) {
      progress.push({
        type: 'collapse',
        label: 'Trust Collapse Warning',
        progress: Math.round(collapseProgress),
        isWarning: true,
        requirements: [`Trust must stay above ${VICTORY_THRESHOLDS.collapse.minTrust}`],
        currentStatus: `Trust: ${faction.resources.trust.toFixed(0)} (margin: ${collapseMargin.toFixed(0)})`,
      });
    }

    // Obsolescence warning
    const obsGap = maxOther - faction.capabilityScore;
    const obsProgress = Math.max(0, Math.min(100, (obsGap / VICTORY_THRESHOLDS.obsolescence.capabilityGap) * 100));

    if (obsProgress > 40) {
      progress.push({
        type: 'obsolescence',
        label: 'Obsolescence Warning',
        progress: Math.round(obsProgress),
        isWarning: true,
        requirements: [`Don't fall ${VICTORY_THRESHOLDS.obsolescence.capabilityGap}+ points behind`],
        currentStatus: `Gap: ${obsGap.toFixed(0)} points behind leader`,
      });
    }
  } else {
    // Government victory conditions
    const labs = Object.values(state.factions).filter(f => f.type === 'lab');
    const compliantLabs = labs.filter(l => l.safetyScore >= VICTORY_THRESHOLDS.regulatory.labSafetyMin);
    const turnsRemaining = VICTORY_THRESHOLDS.regulatory.maxTurn - state.turn;

    // Regulatory Victory progress
    const labCompliance = (compliantLabs.length / labs.length) * 100;
    const globalProgress = Math.min(100, (state.globalSafety / VICTORY_THRESHOLDS.regulatory.globalSafetyMin) * 100);
    const timeProgress = Math.min(100, (state.turn / VICTORY_THRESHOLDS.regulatory.maxTurn) * 100);

    progress.push({
      type: 'regulatory',
      label: 'Regulatory Victory',
      progress: Math.round((labCompliance + globalProgress + timeProgress) / 3),
      requirements: [
        `All labs safety >= ${VICTORY_THRESHOLDS.regulatory.labSafetyMin}`,
        `Global Safety >= ${VICTORY_THRESHOLDS.regulatory.globalSafetyMin}`,
        `Survive to turn ${VICTORY_THRESHOLDS.regulatory.maxTurn}`,
      ],
      currentStatus: `Labs: ${compliantLabs.length}/${labs.length} compliant, ${turnsRemaining} turns remaining`,
    });

    // Alliance Victory progress
    const potentialAllies = Object.values(state.factions).filter(
      f => f.id !== faction.id && f.resources.trust >= VICTORY_THRESHOLDS.alliance.minTrust
    );
    const allianceProgress = Math.min(100, (potentialAllies.length / VICTORY_THRESHOLDS.alliance.minAllies) * 100);
    const influenceProgress = Math.min(100, (faction.resources.influence / VICTORY_THRESHOLDS.alliance.minInfluence) * 100);

    progress.push({
      type: 'alliance',
      label: 'Alliance Victory',
      progress: Math.round((allianceProgress + influenceProgress) / 2),
      requirements: [
        `${VICTORY_THRESHOLDS.alliance.minAllies}+ factions with trust >= ${VICTORY_THRESHOLDS.alliance.minTrust}`,
        `Influence >= ${VICTORY_THRESHOLDS.alliance.minInfluence}`,
      ],
      currentStatus: `Allies: ${potentialAllies.length}/${VICTORY_THRESHOLDS.alliance.minAllies}, Influence: ${faction.resources.influence.toFixed(0)}`,
    });

    // Control Victory progress
    const controlledLabs = labs.filter(l => l.capabilityScore <= VICTORY_THRESHOLDS.control.labCapabilityMax);
    const controlProgress = (controlledLabs.length / labs.length) * 100;
    const controlInfluence = Math.min(100, (faction.resources.influence / VICTORY_THRESHOLDS.control.minInfluence) * 100);

    progress.push({
      type: 'control',
      label: 'Control Victory',
      progress: Math.round((controlProgress + controlInfluence) / 2),
      requirements: [
        `All labs capability <= ${VICTORY_THRESHOLDS.control.labCapabilityMax}`,
        `Influence >= ${VICTORY_THRESHOLDS.control.minInfluence}`,
      ],
      currentStatus: `Labs controlled: ${controlledLabs.length}/${labs.length}, Influence: ${faction.resources.influence.toFixed(0)}`,
    });

    // Coup warning for governments
    const coupRisk = faction.resources.influence < VICTORY_THRESHOLDS.coup.minInfluence + 20;
    const dangerousLabs = labs.filter(l => l.capabilityScore >= VICTORY_THRESHOLDS.coup.labCapabilityDanger - 10);

    if (coupRisk && dangerousLabs.length > 0) {
      const coupProgress = Math.max(0, Math.min(100, 100 - ((faction.resources.influence - VICTORY_THRESHOLDS.coup.minInfluence) / 20) * 100));
      progress.push({
        type: 'coup',
        label: 'Coup Risk Warning',
        progress: Math.round(coupProgress),
        isWarning: true,
        requirements: [
          `Influence must stay above ${VICTORY_THRESHOLDS.coup.minInfluence}`,
          `Keep labs below capability ${VICTORY_THRESHOLDS.coup.labCapabilityDanger}`,
        ],
        currentStatus: `Influence: ${faction.resources.influence.toFixed(0)}, Dangerous labs: ${dangerousLabs.length}`,
      });
    }
  }

  return progress;
}

/**
 * Get distance to each victory/loss condition
 */
export function getVictoryDistances(state: GameState, factionId: string): VictoryDistances {
  const faction = state.factions[factionId];
  if (!faction) return {};

  const distances: VictoryDistances = {};

  if (faction.type === 'lab') {
    // Safe AGI distance
    distances.safeAgi = {
      safetyNeeded: Math.max(0, VICTORY_THRESHOLDS.safeAgi.factionSafety - faction.safetyScore),
      globalSafetyNeeded: Math.max(0, VICTORY_THRESHOLDS.safeAgi.globalSafety - state.globalSafety),
      needsAgiCapability: !faction.canDeployAgi,
    };

    // Dominant distance
    const labs = Object.values(state.factions).filter(f => f.type === 'lab' && f.id !== faction.id);
    const maxOther = Math.max(0, ...labs.map(f => f.capabilityScore));
    const targetCapability = maxOther * (1 + VICTORY_THRESHOLDS.dominant.capabilityLeadPercent / 100);

    distances.dominant = {
      capabilityNeeded: Math.max(0, targetCapability - faction.capabilityScore),
      currentLead: faction.capabilityScore - maxOther,
    };

    // Public trust distance
    distances.publicTrust = {
      trustNeeded: Math.max(0, VICTORY_THRESHOLDS.publicTrust.minTrust - faction.resources.trust),
      capabilityNeeded: Math.max(0, VICTORY_THRESHOLDS.publicTrust.minCapability - faction.capabilityScore),
    };

    // Loss warnings
    distances.collapse = {
      trustMargin: faction.resources.trust - VICTORY_THRESHOLDS.collapse.minTrust,
    };

    distances.obsolescence = {
      capabilityGap: maxOther - faction.capabilityScore,
      gapToSafe: VICTORY_THRESHOLDS.obsolescence.capabilityGap - (maxOther - faction.capabilityScore),
    };
  } else {
    // Government distances
    const labs = Object.values(state.factions).filter(f => f.type === 'lab');
    const compliantLabs = labs.filter(l => l.safetyScore >= VICTORY_THRESHOLDS.regulatory.labSafetyMin);

    distances.regulatory = {
      labsCompliant: compliantLabs.length,
      totalLabs: labs.length,
      turnsRemaining: VICTORY_THRESHOLDS.regulatory.maxTurn - state.turn,
    };

    const potentialAllies = Object.values(state.factions).filter(
      f => f.id !== faction.id && f.resources.trust >= VICTORY_THRESHOLDS.alliance.minTrust
    );

    distances.alliance = {
      alliesNeeded: Math.max(0, VICTORY_THRESHOLDS.alliance.minAllies - potentialAllies.length),
      currentAllies: potentialAllies.length,
    };

    const controlledLabs = labs.filter(l => l.capabilityScore <= VICTORY_THRESHOLDS.control.labCapabilityMax);

    distances.control = {
      influenceNeeded: Math.max(0, VICTORY_THRESHOLDS.control.minInfluence - faction.resources.influence),
      labsControlled: controlledLabs.length,
    };
  }

  return distances;
}

/**
 * Get the closest victory for a faction (lowest distance)
 */
export function getClosestVictory(state: GameState, factionId: string): {
  type: VictoryType;
  distance: number;
  label: string;
} | null {
  const progress = calculateVictoryProgress(state, factionId);
  const victoryProgress = progress.filter(p => !p.isWarning);

  if (victoryProgress.length === 0) return null;

  const sorted = victoryProgress.sort((a, b) => b.progress - a.progress);
  return {
    type: sorted[0].type as VictoryType,
    distance: 100 - sorted[0].progress,
    label: sorted[0].label,
  };
}

/**
 * Get the most urgent threat for a faction
 */
export function getMostUrgentThreat(state: GameState, factionId: string): {
  type: LossType;
  urgency: number;
  label: string;
} | null {
  const progress = calculateVictoryProgress(state, factionId);
  const threats = progress.filter(p => p.isWarning);

  if (threats.length === 0) return null;

  const sorted = threats.sort((a, b) => b.progress - a.progress);
  return {
    type: sorted[0].type as LossType,
    urgency: sorted[0].progress,
    label: sorted[0].label,
  };
}
