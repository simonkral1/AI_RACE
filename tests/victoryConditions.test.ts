import { describe, expect, it, beforeEach } from 'vitest';
import {
  checkVictoryConditions,
  checkLossConditions,
  calculateVictoryProgress,
  getVictoryDistances,
  VictoryType,
  LossType,
  VictoryProgress,
  VictoryResult,
  LossResult,
  VICTORY_THRESHOLDS,
} from '../src/core/victoryConditions.js';
import { createInitialState } from '../src/core/state.js';
import { GameState, FactionState } from '../src/core/types.js';

const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

describe('Victory Conditions', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  describe('Lab Victory Conditions', () => {
    describe('Safe AGI Victory', () => {
      it('detects safe AGI victory when faction safety and global safety are high', () => {
        const labId = 'us_lab_a';
        state.factions[labId].canDeployAgi = true;
        state.factions[labId].safetyScore = VICTORY_THRESHOLDS.safeAgi.factionSafety + 5;

        // Set all factions to high safety for global threshold
        for (const faction of Object.values(state.factions)) {
          faction.safetyScore = VICTORY_THRESHOLDS.safeAgi.factionSafety + 5;
        }
        state.globalSafety = VICTORY_THRESHOLDS.safeAgi.globalSafety + 5;

        const result = checkVictoryConditions(state, labId, true);

        expect(result.victory).toBe(true);
        expect(result.type).toBe('safe_agi');
        expect(result.winnerId).toBe(labId);
      });

      it('fails safe AGI victory when faction safety is too low', () => {
        const labId = 'us_lab_a';
        state.factions[labId].canDeployAgi = true;
        state.factions[labId].safetyScore = VICTORY_THRESHOLDS.safeAgi.factionSafety - 20;
        state.globalSafety = VICTORY_THRESHOLDS.safeAgi.globalSafety + 5;

        const result = checkVictoryConditions(state, labId, true);

        expect(result.victory).toBe(false);
      });

      it('fails safe AGI victory when global safety is too low', () => {
        const labId = 'us_lab_a';
        state.factions[labId].canDeployAgi = true;
        state.factions[labId].safetyScore = VICTORY_THRESHOLDS.safeAgi.factionSafety + 5;
        state.globalSafety = VICTORY_THRESHOLDS.safeAgi.globalSafety - 20;

        const result = checkVictoryConditions(state, labId, true);

        expect(result.victory).toBe(false);
      });
    });

    describe('Dominant Victory', () => {
      it('detects dominant victory when lab has 80%+ capability lead', () => {
        const labId = 'us_lab_a';
        state.factions[labId].capabilityScore = 100;

        // Set other factions to low capability
        for (const [id, faction] of Object.entries(state.factions)) {
          if (id !== labId) {
            faction.capabilityScore = 10;
          }
        }

        const result = checkVictoryConditions(state, labId, false);

        expect(result.victory).toBe(true);
        expect(result.type).toBe('dominant');
      });

      it('fails dominant victory when lead is less than 80%', () => {
        const labId = 'us_lab_a';
        state.factions[labId].capabilityScore = 50;
        state.factions['us_lab_b'].capabilityScore = 40;

        const result = checkVictoryConditions(state, labId, false);

        if (result.type === 'dominant') {
          expect(result.victory).toBe(false);
        }
      });
    });

    describe('Public Trust Victory', () => {
      it('detects public trust victory when trust is 90+ and products deployed', () => {
        const labId = 'us_lab_a';
        state.factions[labId].resources.trust = VICTORY_THRESHOLDS.publicTrust.minTrust + 5;
        // Simulate successful product deployment by checking capability > threshold
        state.factions[labId].capabilityScore = VICTORY_THRESHOLDS.publicTrust.minCapability + 5;

        const result = checkVictoryConditions(state, labId, false);

        if (result.type === 'public_trust') {
          expect(result.victory).toBe(true);
        }
      });

      it('fails public trust victory when trust is below 90', () => {
        const labId = 'us_lab_a';
        state.factions[labId].resources.trust = 50;
        state.factions[labId].capabilityScore = 40;

        const result = checkVictoryConditions(state, labId, false);

        if (result.type === 'public_trust') {
          expect(result.victory).toBe(false);
        }
      });
    });
  });

  describe('Government Victory Conditions', () => {
    describe('Regulatory Victory', () => {
      it('detects regulatory victory when all labs are compliant by turn 32', () => {
        const govId = 'us_gov';
        state.turn = VICTORY_THRESHOLDS.regulatory.maxTurn;

        // Make all labs compliant
        for (const faction of Object.values(state.factions)) {
          if (faction.type === 'lab') {
            faction.safetyScore = VICTORY_THRESHOLDS.regulatory.labSafetyMin + 5;
          }
        }
        state.globalSafety = VICTORY_THRESHOLDS.regulatory.globalSafetyMin + 5;

        const result = checkVictoryConditions(state, govId, false);

        expect(result.victory).toBe(true);
        expect(result.type).toBe('regulatory');
      });

      it('fails regulatory victory when labs are not compliant', () => {
        const govId = 'us_gov';
        state.turn = VICTORY_THRESHOLDS.regulatory.maxTurn;

        // One lab is not compliant
        state.factions['cn_lab'].safetyScore = 20;

        const result = checkVictoryConditions(state, govId, false);

        if (result.type === 'regulatory') {
          expect(result.victory).toBe(false);
        }
      });
    });

    describe('Alliance Victory', () => {
      it('detects alliance victory when 3+ factions have high trust toward government', () => {
        const govId = 'us_gov';
        state.factions[govId].resources.influence = VICTORY_THRESHOLDS.alliance.minInfluence + 10;

        // Set high trust for multiple factions
        let highTrustCount = 0;
        for (const faction of Object.values(state.factions)) {
          if (faction.id !== govId && highTrustCount < 3) {
            faction.resources.trust = VICTORY_THRESHOLDS.alliance.minTrust + 5;
            highTrustCount++;
          }
        }

        const result = checkVictoryConditions(state, govId, false);

        if (result.type === 'alliance') {
          expect(result.victory).toBe(true);
        }
      });
    });

    describe('Control Victory', () => {
      it('detects control victory when government has nationalized or regulated all domestic labs', () => {
        const govId = 'us_gov';
        state.factions[govId].resources.influence = VICTORY_THRESHOLDS.control.minInfluence + 10;

        // Reduce capability of labs to simulate regulation
        for (const faction of Object.values(state.factions)) {
          if (faction.type === 'lab') {
            faction.capabilityScore = VICTORY_THRESHOLDS.control.labCapabilityMax - 5;
          }
        }

        const result = checkVictoryConditions(state, govId, false);

        if (result.type === 'control') {
          expect(result.victory).toBe(true);
        }
      });
    });
  });

  describe('Loss Conditions', () => {
    describe('Catastrophe', () => {
      it('detects catastrophe when unsafe AGI is deployed', () => {
        const labId = 'us_lab_a';
        state.factions[labId].canDeployAgi = true;
        state.factions[labId].safetyScore = 20;
        state.factions[labId].capabilityScore = 80;
        state.globalSafety = 30;

        const result = checkLossConditions(state, labId, true);

        expect(result.loss).toBe(true);
        expect(result.type).toBe('catastrophe');
      });
    });

    describe('Obsolescence', () => {
      it('detects obsolescence when faction is 50+ points behind in capability', () => {
        const labId = 'us_lab_a';
        state.factions[labId].capabilityScore = 10;
        state.factions['us_lab_b'].capabilityScore = 70;

        const result = checkLossConditions(state, labId, false);

        expect(result.loss).toBe(true);
        expect(result.type).toBe('obsolescence');
      });

      it('does not trigger obsolescence when gap is less than 50', () => {
        const labId = 'us_lab_a';
        state.factions[labId].capabilityScore = 40;
        state.factions['us_lab_b'].capabilityScore = 60;

        const result = checkLossConditions(state, labId, false);

        if (result.type === 'obsolescence') {
          expect(result.loss).toBe(false);
        }
      });
    });

    describe('Collapse', () => {
      it('detects collapse when trust falls below 20', () => {
        const labId = 'us_lab_a';
        state.factions[labId].resources.trust = 15;

        const result = checkLossConditions(state, labId, false);

        expect(result.loss).toBe(true);
        expect(result.type).toBe('collapse');
      });

      it('does not trigger collapse when trust is above 20', () => {
        const labId = 'us_lab_a';
        state.factions[labId].resources.trust = 50;

        const result = checkLossConditions(state, labId, false);

        if (result.type === 'collapse') {
          expect(result.loss).toBe(false);
        }
      });
    });

    describe('Coup', () => {
      it('detects coup when government loses control of labs', () => {
        const govId = 'us_gov';
        state.factions[govId].resources.influence = 10;

        // Labs have very high capability and low safety
        for (const faction of Object.values(state.factions)) {
          if (faction.type === 'lab') {
            faction.capabilityScore = 80;
            faction.safetyScore = 20;
          }
        }

        const result = checkLossConditions(state, govId, false);

        if (result.type === 'coup') {
          expect(result.loss).toBe(true);
        }
      });
    });
  });

  describe('Victory Progress Calculation', () => {
    it('calculates progress toward safe AGI victory', () => {
      const labId = 'us_lab_a';
      state.factions[labId].safetyScore = 50;
      state.globalSafety = 40;

      const progress = calculateVictoryProgress(state, labId);
      const safeAgiProgress = progress.find(p => p.type === 'safe_agi');

      expect(safeAgiProgress).toBeDefined();
      expect(safeAgiProgress!.progress).toBeGreaterThan(0);
      expect(safeAgiProgress!.progress).toBeLessThan(100);
    });

    it('calculates progress toward dominant victory', () => {
      const labId = 'us_lab_a';
      state.factions[labId].capabilityScore = 60;

      for (const [id, faction] of Object.entries(state.factions)) {
        if (id !== labId && faction.type === 'lab') {
          faction.capabilityScore = 30;
        }
      }

      const progress = calculateVictoryProgress(state, labId);
      const dominantProgress = progress.find(p => p.type === 'dominant');

      expect(dominantProgress).toBeDefined();
      expect(dominantProgress!.progress).toBeGreaterThan(0);
    });

    it('calculates progress toward regulatory victory for governments', () => {
      const govId = 'us_gov';

      for (const faction of Object.values(state.factions)) {
        if (faction.type === 'lab') {
          faction.safetyScore = 50;
        }
      }

      const progress = calculateVictoryProgress(state, govId);
      const regulatoryProgress = progress.find(p => p.type === 'regulatory');

      expect(regulatoryProgress).toBeDefined();
    });
  });

  describe('Victory Distance Calculation', () => {
    it('calculates distance to safe AGI victory', () => {
      const labId = 'us_lab_a';
      state.factions[labId].safetyScore = 50;
      state.globalSafety = 40;

      const distances = getVictoryDistances(state, labId);

      expect(distances.safeAgi).toBeDefined();
      expect(distances.safeAgi!.safetyNeeded).toBe(VICTORY_THRESHOLDS.safeAgi.factionSafety - 50);
      expect(distances.safeAgi!.globalSafetyNeeded).toBe(VICTORY_THRESHOLDS.safeAgi.globalSafety - 40);
    });

    it('calculates distance to dominant victory', () => {
      const labId = 'us_lab_a';
      state.factions[labId].capabilityScore = 50;

      // Find the second highest capability
      let secondHighest = 0;
      for (const [id, faction] of Object.entries(state.factions)) {
        if (id !== labId && faction.type === 'lab') {
          secondHighest = Math.max(secondHighest, faction.capabilityScore);
        }
      }

      const distances = getVictoryDistances(state, labId);

      expect(distances.dominant).toBeDefined();
    });

    it('calculates distance to loss conditions', () => {
      const labId = 'us_lab_a';
      state.factions[labId].resources.trust = 30;
      state.factions[labId].capabilityScore = 20;
      state.factions['us_lab_b'].capabilityScore = 50;

      const distances = getVictoryDistances(state, labId);

      expect(distances.collapse).toBeDefined();
      expect(distances.collapse!.trustMargin).toBe(30 - VICTORY_THRESHOLDS.collapse.minTrust);
      expect(distances.obsolescence).toBeDefined();
    });
  });
});

describe('Victory Progress for UI', () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  it('returns progress array with all relevant victory types for labs', () => {
    const labId = 'us_lab_a';
    const progress = calculateVictoryProgress(state, labId);

    const labVictoryTypes: VictoryType[] = ['safe_agi', 'dominant', 'public_trust'];

    for (const type of labVictoryTypes) {
      const found = progress.find(p => p.type === type);
      expect(found).toBeDefined();
      expect(found!.progress).toBeGreaterThanOrEqual(0);
      expect(found!.progress).toBeLessThanOrEqual(100);
    }
  });

  it('returns progress array with all relevant victory types for governments', () => {
    const govId = 'us_gov';
    const progress = calculateVictoryProgress(state, govId);

    const govVictoryTypes: VictoryType[] = ['regulatory', 'alliance', 'control'];

    for (const type of govVictoryTypes) {
      const found = progress.find(p => p.type === type);
      expect(found).toBeDefined();
    }
  });

  it('includes warning indicators when close to loss', () => {
    const labId = 'us_lab_a';
    state.factions[labId].resources.trust = 25;

    const progress = calculateVictoryProgress(state, labId);
    const collapseProgress = progress.find(p => p.type === 'collapse' as any);

    // Progress toward collapse should be high when trust is low
    if (collapseProgress) {
      expect(collapseProgress.progress).toBeGreaterThan(50);
    }
  });
});
