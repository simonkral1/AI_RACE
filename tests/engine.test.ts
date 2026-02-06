import { describe, expect, it } from 'vitest';
import { resolveTurn, checkGovernmentVictory } from '../src/core/engine.js';
import { createInitialState } from '../src/core/state.js';
import { SAFETY_THRESHOLDS, ACTION_POINTS_PER_TURN, GOVERNMENT_VICTORY, MAX_TURN } from '../src/core/constants.js';
import { ActionChoice, GameState } from '../src/core/types.js';

const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

describe('resolveTurn', () => {
  describe('calendar advancement', () => {
    it('advances turn counter', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      resolveTurn(state, {}, rng);

      expect(state.turn).toBe(1);
    });

    it('advances quarters', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      state.quarter = 1;

      resolveTurn(state, {}, rng);

      expect(state.quarter).toBe(2);
    });

    it('advances year when quarter exceeds 4', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      state.quarter = 4;
      state.year = 2026;

      resolveTurn(state, {}, rng);

      expect(state.quarter).toBe(1);
      expect(state.year).toBe(2027);
    });
  });

  describe('income application', () => {
    it('applies income to all factions', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      const initialCapitals: Record<string, number> = {};
      for (const [id, faction] of Object.entries(state.factions)) {
        initialCapitals[id] = faction.resources.capital;
      }

      resolveTurn(state, {}, rng);

      for (const [id, faction] of Object.entries(state.factions)) {
        expect(faction.resources.capital).toBeGreaterThanOrEqual(initialCapitals[id]);
      }
    });

    it('income scales with trust and influence for labs', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      const lab = Object.values(state.factions).find(f => f.type === 'lab')!;
      lab.resources.capital = 20;
      lab.resources.trust = 100;
      lab.resources.influence = 100;

      const initialCapital = lab.resources.capital;
      resolveTurn(state, {}, rng);

      expect(lab.resources.capital).toBeGreaterThan(initialCapital + 4);
    });
  });

  describe('action resolution', () => {
    it('applies research from research actions', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'research_capabilities', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].research.capabilities).toBeGreaterThan(0);
    });

    it('limits actions to ACTION_POINTS_PER_TURN', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'research_capabilities', openness: 'open' },
          { actionId: 'research_capabilities', openness: 'open' },
          { actionId: 'research_capabilities', openness: 'open' },
          { actionId: 'research_capabilities', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      // Research gain should be limited to 2 actions worth
      // Each action gives ~12 base + modifiers
      expect(state.factions[factionId].research.capabilities).toBeLessThan(100);
    });

    it('rejects invalid actions for faction type', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const govId = 'us_gov';

      const choices: Record<string, ActionChoice[]> = {
        [govId]: [
          { actionId: 'build_compute', openness: 'open' }, // Labs only
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.log.some(l => l.includes('invalid action'))).toBe(true);
    });

    it('applies resource deltas from actions', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      state.factions[factionId].resources.capital = 50;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'build_compute', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      // build_compute costs 10 capital, gives 8 compute
      expect(state.factions[factionId].resources.capital).toBeLessThan(50);
    });
  });

  describe('openness effects', () => {
    it('open actions give trust bonus', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialTrust = state.factions[factionId].resources.trust;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'research_capabilities', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.trust).toBeGreaterThanOrEqual(initialTrust);
    });

    it('secret actions accumulate exposure', () => {
      const state = createInitialState();
      const rng = () => 0.99; // High roll to avoid detection
      const factionId = 'us_lab_a';

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'research_capabilities', openness: 'secret' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].exposure).toBeGreaterThan(0);
    });
  });

  describe('detection', () => {
    it('high exposure increases detection chance', () => {
      const state = createInitialState();
      const rng = () => 0.1; // Low roll
      const factionId = 'us_lab_a';

      state.factions[factionId].exposure = 50;
      state.factions[factionId].resources.trust = 50;

      resolveTurn(state, {}, rng);

      // With high exposure and low roll, should be detected
      expect(state.factions[factionId].resources.trust).toBeLessThan(50);
    });

    it('detection resets exposure', () => {
      const state = createInitialState();
      const rng = () => 0.01; // Very low roll to trigger detection
      const factionId = 'us_lab_a';

      state.factions[factionId].exposure = 100;

      resolveTurn(state, {}, rng);

      expect(state.factions[factionId].exposure).toBe(0);
    });
  });

  describe('espionage', () => {
    it('successful espionage steals research', () => {
      const state = createInitialState();
      const rng = () => 0.01; // Low roll for success
      const attackerId = 'us_lab_a';
      const targetId = 'cn_lab';

      state.factions[targetId].research.capabilities = 50;

      const choices: Record<string, ActionChoice[]> = {
        [attackerId]: [
          { actionId: 'espionage', openness: 'secret', targetFactionId: targetId },
        ],
      };

      resolveTurn(state, choices, rng);

      // Research should have been stolen
      expect(state.factions[attackerId].research.capabilities).toBeGreaterThan(0);
    });
  });

  describe('government actions', () => {
    it('subsidize adds capital to target lab', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const govId = 'us_gov';
      const labId = 'us_lab_a';

      state.factions[labId].resources.capital = 40;

      const choices: Record<string, ActionChoice[]> = {
        [govId]: [
          { actionId: 'subsidize', openness: 'open', targetFactionId: labId },
        ],
      };

      resolveTurn(state, choices, rng);

      // Lab should have gained capital (6 from subsidize)
      expect(state.log.some(l => l.includes('subsidized'))).toBe(true);
    });

    it('regulate reduces lab capabilities', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const govId = 'us_gov';
      const labId = 'us_lab_a';

      const initialCap = state.factions[labId].capabilityScore;

      const choices: Record<string, ActionChoice[]> = {
        [govId]: [
          { actionId: 'regulate', openness: 'open', targetFactionId: labId },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[labId].capabilityScore).toBeLessThan(initialCap);
    });

    it('counterintel increases opsec', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const govId = 'us_gov';

      const initialOpsec = state.factions[govId].opsec;

      const choices: Record<string, ActionChoice[]> = {
        [govId]: [
          { actionId: 'counterintel', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[govId].opsec).toBeGreaterThan(initialOpsec);
    });
  });

  describe('AGI deployment', () => {
    it('does not deploy without canDeployAgi', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';

      // Ensure no other victory conditions are accidentally triggered
      for (const faction of Object.values(state.factions)) {
        faction.resources.influence = 50; // Below alliance/control thresholds
        faction.resources.trust = 50; // Below public trust threshold
        faction.capabilityScore = 30; // Below dominant threshold
      }

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'deploy_agi', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.gameOver).toBe(false);
      expect(state.log.some(l => l.includes('without the breakthrough'))).toBe(true);
    });

    it('safe AGI deployment wins the game', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';

      state.factions[factionId].canDeployAgi = true;
      state.factions[factionId].safetyScore = SAFETY_THRESHOLDS.faction + 10;

      // Set ALL factions to high safety so globalSafety will be high after recomputation
      for (const faction of Object.values(state.factions)) {
        faction.safetyScore = SAFETY_THRESHOLDS.faction + 10;
      }

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'deploy_agi', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.gameOver).toBe(true);
      expect(state.winnerId).toBe(factionId);
      expect(state.log.some(l => l.includes('safe AGI'))).toBe(true);
    });

    it('unsafe AGI deployment causes catastrophe', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';

      state.factions[factionId].canDeployAgi = true;
      state.factions[factionId].safetyScore = 20; // Below threshold
      state.globalSafety = 20; // Below threshold

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'deploy_agi', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.gameOver).toBe(true);
      expect(state.winnerId).toBeUndefined();
      expect(state.log.some(l => l.includes('catastrophe'))).toBe(true);
    });
  });

  describe('game over handling', () => {
    it('does not resolve turns when game is over', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      state.gameOver = true;
      const initialTurn = state.turn;

      resolveTurn(state, {}, rng);

      expect(state.turn).toBe(initialTurn);
    });
  });

  describe('global safety update', () => {
    it('updates globalSafety after each turn', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      const initialSafety = state.globalSafety;
      const factionId = 'us_lab_a';

      // Do something that affects safety
      state.factions[factionId].safetyScore = 100;

      resolveTurn(state, {}, rng);

      // Safety should have changed
      expect(state.globalSafety).not.toBe(initialSafety);
    });
  });

  describe('tech unlocking', () => {
    it('unlocks techs when research is sufficient', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';

      // Give enough research to unlock a tech
      state.factions[factionId].research.capabilities = 30;

      resolveTurn(state, {}, rng);

      expect(state.factions[factionId].unlockedTechs.size).toBeGreaterThan(0);
    });
  });

  describe('government victory', () => {
    it('triggers government victory when max turn reached with all labs safe', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      // Set to just before max turn
      state.turn = MAX_TURN - 1;
      state.year = 2033;
      state.quarter = 4;

      // Make all labs safe
      for (const faction of Object.values(state.factions)) {
        if (faction.type === 'lab') {
          faction.safetyScore = GOVERNMENT_VICTORY.allLabsSafeThreshold + 10;
        }
      }

      // Set global safety high
      state.globalSafety = GOVERNMENT_VICTORY.globalSafetyThreshold + 10;

      resolveTurn(state, {}, rng);

      expect(state.gameOver).toBe(true);
      expect(state.winnerId).toBeDefined();
      expect(state.log.some(l => l.includes('regulatory victory'))).toBe(true);
    });

    it('ends in stalemate when max turn reached without safety', () => {
      const state = createInitialState();
      const rng = seededRng(42);

      // Set to just before max turn
      state.turn = MAX_TURN - 1;
      state.year = 2033;
      state.quarter = 4;

      // Ensure no victory conditions are met
      for (const faction of Object.values(state.factions)) {
        faction.resources.influence = 50; // Below alliance/control thresholds
        faction.resources.trust = 50; // Below trust thresholds
        faction.capabilityScore = 30; // Below dominant threshold
        if (faction.type === 'lab') {
          faction.safetyScore = 20;
        }
      }
      state.globalSafety = 20;

      resolveTurn(state, {}, rng);

      expect(state.gameOver).toBe(true);
      expect(state.winnerId).toBeUndefined();
      expect(state.log.some(l => l.includes('stalemate'))).toBe(true);
    });

    it('checkGovernmentVictory returns correct result for safe labs', () => {
      const state = createInitialState();

      // Make all labs safe
      for (const faction of Object.values(state.factions)) {
        if (faction.type === 'lab') {
          faction.safetyScore = GOVERNMENT_VICTORY.allLabsSafeThreshold + 5;
        }
      }
      state.globalSafety = GOVERNMENT_VICTORY.globalSafetyThreshold + 5;

      const result = checkGovernmentVictory(state);

      expect(result.victory).toBe(true);
      expect(result.winnerId).toBeDefined();
    });

    it('checkGovernmentVictory fails when labs are not safe', () => {
      const state = createInitialState();

      // One lab is unsafe
      const labs = Object.values(state.factions).filter(f => f.type === 'lab');
      labs[0].safetyScore = 30; // Below threshold
      state.globalSafety = GOVERNMENT_VICTORY.globalSafetyThreshold + 5;

      const result = checkGovernmentVictory(state);

      expect(result.victory).toBe(false);
    });

    it('checkGovernmentVictory fails when global safety is low', () => {
      const state = createInitialState();

      // All labs safe but global safety too low
      for (const faction of Object.values(state.factions)) {
        if (faction.type === 'lab') {
          faction.safetyScore = GOVERNMENT_VICTORY.allLabsSafeThreshold + 5;
        }
      }
      state.globalSafety = 20; // Below threshold

      const result = checkGovernmentVictory(state);

      expect(result.victory).toBe(false);
    });

    it('winning government is the one with highest influence', () => {
      const state = createInitialState();

      // Make all labs safe
      for (const faction of Object.values(state.factions)) {
        if (faction.type === 'lab') {
          faction.safetyScore = GOVERNMENT_VICTORY.allLabsSafeThreshold + 5;
        }
      }
      state.globalSafety = GOVERNMENT_VICTORY.globalSafetyThreshold + 5;

      // Set US gov to have highest influence
      state.factions['us_gov'].resources.influence = 100;
      state.factions['cn_gov'].resources.influence = 50;

      const result = checkGovernmentVictory(state);

      expect(result.victory).toBe(true);
      expect(result.winnerId).toBe('us_gov');
    });
  });
});
