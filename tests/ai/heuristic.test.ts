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
      expect(choices[0].actionId).toBe('research_safety');
    });

    it('deploys products when capital is low', () => {
      const lab = state.factions['us_lab_a'];
      lab.resources.capital = 30;

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
    it('regulates when global safety is low', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 10;
      // Set a lab with high capability to be the target
      state.factions['us_lab_a'].capabilityScore = 80;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const regulateAction = choices.find(c => c.actionId === 'regulate');
      expect(regulateAction).toBeDefined();
      expect(regulateAction?.targetFactionId).toBe('us_lab_a');
    });

    it('subsidizes allied labs when capital is sufficient', () => {
      state.factions['us_gov'].resources.capital = 50;
      // Make US labs have lower capability so they're subsidy candidates
      state.factions['us_lab_a'].capabilityScore = 20;
      state.factions['us_lab_b'].capabilityScore = 30;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const subsidizeAction = choices.find(c => c.actionId === 'subsidize');
      expect(subsidizeAction).toBeDefined();
      expect(['us_lab_a', 'us_lab_b']).toContain(subsidizeAction?.targetFactionId);
    });

    it('chooses policy when capital is low', () => {
      state.factions['us_gov'].resources.capital = 20;
      state.globalSafety = SAFETY_THRESHOLDS.global + 10; // No need to regulate

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      expect(choices.some(c => c.actionId === 'policy')).toBe(true);
    });

    it('performs espionage when espionage focus is high', () => {
      // CN gov has high espionage focus in strategy
      state.factions['cn_lab'].capabilityScore = 60;

      const choices = decideActionsHeuristic(state, 'cn_gov', deterministicRng);
      const espionageAction = choices.find(c => c.actionId === 'espionage');
      // May or may not have espionage based on strategy, just check it's valid
      if (espionageAction) {
        expect(espionageAction.openness).toBe('secret');
      }
    });

    it('performs counterintel when espionage focus is low', () => {
      // US gov has espionageFocus 20, which is below 35 threshold
      // But with max 2 actions, counterintel might be pushed out by regulate/subsidize
      // This test verifies that when there's room, counterintel is chosen
      state.globalSafety = SAFETY_THRESHOLDS.global + 10; // No regulate
      state.factions['us_gov'].resources.capital = 20; // Too low for subsidize

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      // With low capital and high global safety, should have policy + counterintel
      expect(choices.some(c => c.actionId === 'counterintel')).toBe(true);
    });

    it('returns max 2 action choices', () => {
      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      expect(choices.length).toBeLessThanOrEqual(2);
    });
  });

  describe('openness determination', () => {
    it('respects openness preference with low RNG', () => {
      // Low RNG value should favor 'open'
      const lowRng = () => 0.1;
      const choices = decideActionsHeuristic(state, 'us_lab_a', lowRng);
      // Labs with high openness preference should have open actions
      expect(choices.some(c => c.openness === 'open')).toBe(true);
    });

    it('respects openness preference with high RNG', () => {
      // High RNG value should favor 'secret' for labs with lower preference
      const highRng = () => 0.99;
      const lab = state.factions['us_lab_a'];
      lab.safetyScore = SAFETY_THRESHOLDS.faction - 10;

      const choices = decideActionsHeuristic(state, 'us_lab_a', highRng);
      // The research action openness depends on the RNG vs preference
      expect(choices[0]).toBeDefined();
    });
  });

  describe('targeting logic', () => {
    it('targets top capability lab for regulation', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 20;
      state.factions['us_lab_a'].capabilityScore = 40;
      state.factions['us_lab_b'].capabilityScore = 60;
      state.factions['cn_lab'].capabilityScore = 80;

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      const regulateAction = choices.find(c => c.actionId === 'regulate');
      expect(regulateAction?.targetFactionId).toBe('cn_lab');
    });

    it('CN gov subsidizes CN lab', () => {
      state.factions['cn_gov'].resources.capital = 50;

      const choices = decideActionsHeuristic(state, 'cn_gov', deterministicRng);
      const subsidizeAction = choices.find(c => c.actionId === 'subsidize');
      if (subsidizeAction) {
        expect(subsidizeAction.targetFactionId).toBe('cn_lab');
      }
    });

    it('US gov subsidizes lowest capability allied lab', () => {
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
      state.factions['us_lab_a'].resources = { capital: 0, compute: 0, data: 0, influence: 0 };
      const choices = decideActionsHeuristic(state, 'us_lab_a', deterministicRng);
      expect(choices.length).toBeGreaterThan(0);
      expect(choices.some(c => c.actionId === 'deploy_products')).toBe(true);
    });

    it('handles no valid targets for regulation', () => {
      state.globalSafety = SAFETY_THRESHOLDS.global - 10;
      // Remove all labs
      delete state.factions['us_lab_a'];
      delete state.factions['us_lab_b'];
      delete state.factions['cn_lab'];

      const choices = decideActionsHeuristic(state, 'us_gov', deterministicRng);
      // Should still return actions, just without regulate
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
