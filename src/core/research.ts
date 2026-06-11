import { BranchId, FactionState } from './types.js';

const RESEARCH_BRANCHES: BranchId[] = ['capabilities', 'safety', 'ops', 'hardPower', 'policy'];

const sanitize = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);

export const getUnifiedResearchPool = (faction: FactionState): number => {
  const values = RESEARCH_BRANCHES.map((branch) => sanitize(faction.research[branch]));
  if (values.every((value) => Math.abs(value - values[0]) < 0.0001)) {
    return values[0];
  }
  // Migration path for legacy saves where research was split by branch.
  // Use the strongest branch value (not sum) to avoid 4x inflation.
  return Math.max(...values);
};

export const setUnifiedResearchPool = (faction: FactionState, pool: number): number => {
  const next = sanitize(pool);
  for (const branch of RESEARCH_BRANCHES) {
    faction.research[branch] = next;
  }
  return next;
};

export const addUnifiedResearch = (faction: FactionState, delta: number): number => {
  return setUnifiedResearchPool(faction, getUnifiedResearchPool(faction) + delta);
};

export const spendUnifiedResearch = (faction: FactionState, amount: number): boolean => {
  const pool = getUnifiedResearchPool(faction);
  const cost = sanitize(amount);
  if (pool < cost) return false;
  setUnifiedResearchPool(faction, pool - cost);
  return true;
};

export const normalizeUnifiedResearch = (faction: FactionState): number => {
  return setUnifiedResearchPool(faction, getUnifiedResearchPool(faction));
};
