export const MAX_STAT = 100;
export const MIN_STAT = 0;

export const SAFETY_THRESHOLDS = {
  faction: 70,
  global: 60,
};

export const ACTION_POINTS_PER_TURN = 2;

export const OPENNESS_MULTIPLIERS = {
  open: {
    research: 0.9,
    trustDelta: 2,
    globalSafetyDelta: 1,
    safetyDelta: 1,
    capabilityDelta: 0,
  },
  secret: {
    research: 1.1,
    trustDelta: -3,
    globalSafetyDelta: -1,
    safetyDelta: -2,
    capabilityDelta: 1,
  },
};

export const DETECTION = {
  baseChance: 0.1,
  perExposure: 0.08,
  opsecFactor: 0.003,
  maxChance: 0.65,
};

export const ESPIONAGE = {
  baseSuccess: 0.35,
  opsecDefenseFactor: 0.004,
  opsecAttackFactor: 0.002,
};

export const TURN_START_YEAR = 2026;
export const TURN_START_QUARTER = 1;
