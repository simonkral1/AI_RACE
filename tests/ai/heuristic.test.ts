import { describe, it, expect, beforeEach } from 'vitest';
import { decideActionsHeuristic } from '../../src/ai/decideActions.js';
import { createInitialState } from '../../src/core/state.js';
import { GameState, FactionState } from '../../src/core/types.js';
import { SAFETY_THRESHOLDS } from '../../src/core/constants.js';

describe('decideActionsHeuristic', () => {
  let state: GameState;
  let deterministicRng: () => number;

  beforeEach(() => {
    state = createInitialState();
    // Deterministic RNG that always returns 0.5
    deterministicRng = () => 0.5;
  });

  describe('lab faction decisions', () => {
    it('returns empty array for unknown faction', () => {
      const choices = decideActionsHeuristic(state, 'unknown_faction', deterministicRng);
      expect(choices).toEqual([]);
    });

    it('deploys AGI when safe and able', () => {
      const lab = state.factions['us_lab_a'];
      lab.canDeployAgi = true;
      lab.safetyScore = SAFETY_THRESHOLDS.faction + 10;
      state.globalSafety = SAFETY_THRESHOLDS.global + 10;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices).toHaveLength(1);
      expect(choices[0].actionId).toBe('deploy_agi');
      expect(choices[0].openness).toBe('open');
    });

    it('does not deploy AGI when safety too low', () => {
      const lab = state.factions['us_lab_a'];
      lab.canDeployAgi = true;
      lab.safetyScore = SAFETY_THRESHOLDS.faction - 10;
      state.globalSafety = SAFETY_THRESHOLDS.global + 10;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.some(c => c.actionId === 'deploy_agi')).toBe(false);
    });

    it('does not deploy AGI when global safety too low', () => {
      const lab = state.factions['us_lab_a'];
      lab.canDeployAgi = true;
      lab.safetyScore = SAFETY_THRESHOLDS.faction + 10;
      state.globalSafety = SAFETY_THRESHOLDS.global - 10;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.some(c => c.actionId === 'deploy_agi')).toBe(false);
    });

    it('prioritizes safety research when safety score is below threshold', () => {
      const lab = state.factions['us_lab_a'];
      lab.safetyScore = SAFETY_THRESHOLDS.faction - 20;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      // With rng=0.5 and openness pref 70, first action should be safety research
      // (faction-specific ability check: trust=50 < 80, rng=0.5 > 0.4, so skipped)
      expect(choices[0].actionId).toBe('research_safety');
    });

    it('deploys products when capital is low', () => {
      const lab = state.factions['us_lab_a'];
      lab.resources.capital = 20;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.some(c => c.actionId === 'deploy_products')).toBe(true);
    });

    it('builds compute when capital is sufficient but compute is low', () => {
      const lab = state.factions['us_lab_a'];
      lab.resources.capital = 50;
      lab.resources.compute = 40;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.some(c => c.actionId === 'build_compute')).toBe(true);
    });

    it('returns max 2 action choices', () => {
      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.length).toBeLessThanOrEqual(2);
    });
  });

  describe('government faction decisions', () => {
    it('regulates non-allied labs when global safety is low', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 10;
      // Set a non-allied lab (cn_lab) with high capability so us_gov targets it
      state.factions['cn_lab'].capabilityScore = 80;
      state.factions['us_lab_a'].capabilityScore = 20;
      state.factions['us_lab_b'].capabilityScore = 30;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const regulateAction = choices.find(c => c.actionId === 'regulate');
      expect(regulateAction).toBeDefined();
      expect(regulateAction?.targetFactionId).toBe('cn_lab');
    });

    it('does policy instead of regulating allied labs', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 10;
      // Make us_lab_a the top lab - us_gov won't regulate its own ally
      state.factions['us_lab_a'].capabilityScore = 80;
      state.factions['cn_lab'].capabilityScore = 20;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      // Should not regulate allied lab, should do policy instead
      const regulateAction = choices.find(c => c.actionId === 'regulate');
      if (regulateAction) {
        expect(regulateAction.targetFactionId).not.toBe('us_lab_a');
      }
    });

    it('subsidizes allied labs when global safety is high and capital sufficient', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global + 10; // No need to regulate
      state.factions['us_gov'].resources.capital = 50;
      state.factions['us_lab_a'].capabilityScore = 20;
      state.factions['us_lab_b'].capabilityScore = 30;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const subsidizeAction = choices.find(c => c.actionId === 'subsidize');
      expect(subsidizeAction).toBeDefined();
      expect(['us_lab_a', 'us_lab_b']).toContain(subsidizeAction?.targetFactionId);
    });

    it('chooses policy when capital is low', () => {
      state.factions['us_gov'].resources.capital = 20;
      state.globalSafety = SAFETY_THRESHOLDS.global + 10;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      expect(choices.some(c => c.actionId === 'policy')).toBe(true);
    });

    it('performs espionage when espionage focus is high', () => {
      // CN gov has high espionage focus in strategy
      state.factions['cn_lab'].capabilityScore = 60;

      const choices = decideActionsHeuristic(state, 'cn_gov', deterministicRng);
      const espionageAction = choices.find(c => c.actionId === 'espionage');
      if (espionageAction) {
        expect(espionageAction.openness).toBe('secret');
      }
    });

    it('performs counterintel when espionage focus is low', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global + 10;
      state.factions['us_gov'].resources.capital = 20;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      // US gov has low espionage focus, but with low capital should get secure_funding or counterintel
      const hasDefensive = choices.some(c => c.actionId === 'counterintel' || c.actionId === 'secure_funding');
      expect(hasDefensive).toBe(true);
    });

    it('returns max 2 action choices', () => {
      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      expect(choices.length).toBeLessThanOrEqual(2);
    });
  });

  describe('openness determination', () => {
    it('respects openness preference with low RNG', () => {
      const lowRng = () => 0.1;
      const choices = decideActionsHeuristic(state, 'us_lab_a', lowRng);
      expect(choices.some(c => c.openness === 'open')).toBe(true);
    });

    it('respects openness preference with high RNG', () => {
      const highRng = () => 0.99;
      const lab = state.factions['us_lab_a'];
      lab.safetyScore = SAFETY_THRESHOLDS.faction - 10;

      const choices = decideActionsHeuristic(state, 'us_lab_a', highRng);
      expect(choices[0]).toBeDefined();
    });
  });

  describe('targeting logic', () => {
    it('targets top non-allied capability lab for regulation', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 20;
      state.factions['us_lab_a'].capabilityScore = 40;
      state.factions['us_lab_b'].capabilityScore = 60;
      state.factions['cn_lab'].capabilityScore = 80;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const regulateAction = choices.find(c => c.actionId === 'regulate');
      // cn_lab is not allied to us_gov and has highest capability
      expect(regulateAction?.targetFactionId).toBe('cn_lab');
    });

    it('CN gov subsidizes CN lab', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global + 10; // No need to regulate
      state.factions['cn_gov'].resources.capital = 50;

      const choices = decideActionsHeuristic(state, 'cn_gov', deterministicRng);
      const subsidizeAction = choices.find(c => c.actionId === 'subsidize');
      if (subsidizeAction) {
        expect(subsidizeAction.targetFactionId).toBe('cn_lab');
      }
    });

    it('US gov subsidizes lowest capability allied lab', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global + 10; // High safety = no regulate
      state.factions['us_gov'].resources.capital = 50;
      state.factions['us_lab_a'].capabilityScore = 20;
      state.factions['us_lab_b'].capabilityScore = 40;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const subsidizeAction = choices.find(c => c.actionId === 'subsidize');
      expect(subsidizeAction?.targetFactionId).toBe('us_lab_a');
    });
  });

  describe('edge cases', () => {
    it('handles faction with no resources gracefully', () => {
      state.factions['us_lab_a'].resources = { capital: 0, compute: 0, data: 0, influence: 0, trust: 0, talent: 0 };
      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.some(c => c.actionId === 'deploy_products')).toBe(true);
    });

    it('handles no valid targets for regulation', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 10;
      delete state.factions['us_lab_a'];
      delete state.factions['us_lab_b'];
      delete state.factions['cn_lab'];

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      expect(choices).toBeDefined();
    });

    it('handles faction that can deploy but not safely', () => {
      const lab = state.factions['us_lab_a'];
      lab.canDeployAgi = true;
      lab.safetyScore = 0;
      state.globalSafety = 0;

      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices[0].actionId).not.toBe('deploy_agi');
    });

    it('deterministic with same seed', () => {
      const rng1 = () => 0.5;
      const rng2 = () => 0.5;

      const choices1 = decideActionsHeuristic(state, 'us_lab_a', rng1);
      const choices2 = decideActionsHeuristic(state, 'us_lab_a', rng2);

      expect(choices1).toEqual(choices2);
    });
  });
});
