import { MAX_STAT, MIN_STAT } from './constants.js';
import { BranchId, FactionState, GameState, ResourceKey } from './types.js';
import { clamp, round1 } from './utils.js';

export const computeGlobalSafety = (state: GameState): number => {
  const factions = Object.values(state.factions);
  const totalWeight = factions.reduce((sum, faction) => sum + Math.max(10, faction.capabilityScore), 0);
  if (totalWeight === 0) return 0;
  const weighted = factions.reduce(
    (sum, faction) => sum + faction.safetyScore * Math.max(10, faction.capabilityScore),
    0,
  );
  return round1(weighted / totalWeight);
};

export const applyResourceDelta = (faction: FactionState, delta: Partial<Record<ResourceKey, number>>): void => {
  for (const [key, value] of Object.entries(delta)) {
    if (value === undefined) continue;
    const resourceKey = key as ResourceKey;
    faction.resources[resourceKey] = clamp(
      faction.resources[resourceKey] + value,
      MIN_STAT,
      MAX_STAT,
    );
  }
};

export const applyStatDelta = (faction: FactionState, key: 'safetyCulture' | 'opsec' | 'hardPower', delta: number): void => {
  faction[key] = clamp(faction[key] + delta, MIN_STAT, MAX_STAT);
};

export const applyScoreDelta = (faction: FactionState, key: 'capabilityScore' | 'safetyScore', delta: number): void => {
  faction[key] = clamp(faction[key] + delta, MIN_STAT, MAX_STAT);
};

export const computeResearchGain = (
  faction: FactionState,
  branch: BranchId,
  base: number,
): number => {
  const r = faction.resources;
  switch (branch) {
    case 'capabilities':
      return base + r.compute * 0.18 + r.capital * 0.06 + r.cybersecurity * 0.04;
    case 'safety':
      return base + r.cybersecurity * 0.12 + faction.safetyCulture * 0.15 + r.trust * 0.05;
    case 'ops':
      return base + r.capital * 0.1 + r.compute * 0.07 + r.cybersecurity * 0.08;
    case 'hardPower':
      return base + faction.hardPower * 0.12 + r.influence * 0.08 + faction.opsec * 0.06 + r.capital * 0.04;
    case 'policy':
      return base + r.influence * 0.1 + r.trust * 0.05 + faction.hardPower * 0.04;
    default:
      return base;
  }
};
