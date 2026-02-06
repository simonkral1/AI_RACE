import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/data/actions.js';
import { createInitialState } from '../src/core/state.js';
import { resolveTurn } from '../src/core/engine.js';
import { ActionChoice } from '../src/core/types.js';

const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

describe('Expanded Actions', () => {
  describe('hire_talent action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'hire_talent');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('increases talent resource', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialTalent = state.factions[factionId].resources.talent;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'hire_talent', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.talent).toBeGreaterThan(initialTalent);
    });
  });

  describe('publish_research action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'publish_research');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('gains trust and shares capability', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialTrust = state.factions[factionId].resources.trust;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'publish_research', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.trust).toBeGreaterThan(initialTrust);
    });
  });

  describe('form_alliance action', () => {
    it('exists and is available to labs and governments', () => {
      const action = ACTIONS.find(a => a.id === 'form_alliance');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
      expect(action!.allowedFor).toContain('government');
    });

    it('creates alliance between factions when targeted', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const targetId = 'us_lab_b';

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'form_alliance', openness: 'open', targetFactionId: targetId },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.alliances?.get(factionId)?.includes(targetId) ||
             state.alliances?.get(targetId)?.includes(factionId)).toBe(true);
    });
  });

  describe('secure_funding action', () => {
    it('exists and is available to governments', () => {
      const action = ACTIONS.find(a => a.id === 'secure_funding');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('government');
    });

    it('increases capital for government', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_gov';
      const initialCapital = state.factions[factionId].resources.capital;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'secure_funding', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.capital).toBeGreaterThan(initialCapital);
    });
  });

  describe('hardware_partnership action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'hardware_partnership');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('increases compute resource', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialCompute = state.factions[factionId].resources.compute;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'hardware_partnership', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.compute).toBeGreaterThan(initialCompute);
    });
  });

  describe('open_source_release action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'open_source_release');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('provides significant trust gain', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialTrust = state.factions[factionId].resources.trust;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'open_source_release', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.trust).toBeGreaterThan(initialTrust + 3);
    });
  });

  describe('defensive_measures action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'defensive_measures');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('increases security level', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialSecurity = state.factions[factionId].securityLevel ?? 1;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'defensive_measures', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].securityLevel).toBeGreaterThan(initialSecurity);
    });
  });

  describe('accelerate_timeline action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'accelerate_timeline');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('boosts capability but decreases safety', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialCap = state.factions[factionId].capabilityScore;
      const initialSafety = state.factions[factionId].safetyScore;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'accelerate_timeline', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].capabilityScore).toBeGreaterThan(initialCap);
      expect(state.factions[factionId].safetyScore).toBeLessThan(initialSafety);
    });
  });

  describe('safety_pause action', () => {
    it('exists and is available to labs', () => {
      const action = ACTIONS.find(a => a.id === 'safety_pause');
      expect(action).toBeDefined();
      expect(action!.allowedFor).toContain('lab');
    });

    it('increases safety score', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialSafety = state.factions[factionId].safetyScore;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'safety_pause', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].safetyScore).toBeGreaterThan(initialSafety);
    });
  });
});

describe('Expanded Resources', () => {
  describe('publicOpinion', () => {
    it('factions have publicOpinion initialized', () => {
      const state = createInitialState();
      for (const faction of Object.values(state.factions)) {
        expect(faction.publicOpinion).toBeDefined();
        expect(faction.publicOpinion).toBeGreaterThanOrEqual(0);
        expect(faction.publicOpinion).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('securityLevel', () => {
    it('factions have securityLevel initialized', () => {
      const state = createInitialState();
      for (const faction of Object.values(state.factions)) {
        expect(faction.securityLevel).toBeDefined();
        expect(faction.securityLevel).toBeGreaterThanOrEqual(1);
        expect(faction.securityLevel).toBeLessThanOrEqual(5);
      }
    });
  });
});

describe('Faction Relationships', () => {
  describe('alliances', () => {
    it('game state has alliances map', () => {
      const state = createInitialState();
      expect(state.alliances).toBeDefined();
      expect(state.alliances).toBeInstanceOf(Map);
    });
  });

  describe('tensions', () => {
    it('game state has tensions map', () => {
      const state = createInitialState();
      expect(state.tensions).toBeDefined();
      expect(state.tensions).toBeInstanceOf(Map);
    });
  });

  describe('treaties', () => {
    it('game state has treaties array', () => {
      const state = createInitialState();
      expect(state.treaties).toBeDefined();
      expect(Array.isArray(state.treaties)).toBe(true);
    });
  });
});

describe('Special Faction Abilities', () => {
  describe('OpenBrain - open_research', () => {
    it('exists and is unique to OpenBrain', () => {
      const action = ACTIONS.find(a => a.id === 'open_research');
      expect(action).toBeDefined();
      expect(action!.factionSpecific).toBe('us_lab_a');
    });

    it('shares capability for trust boost', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_lab_a';
      const initialTrust = state.factions[factionId].resources.trust;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'open_research', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.trust).toBeGreaterThan(initialTrust);
    });
  });

  describe('Nexus Labs - move_fast', () => {
    it('exists and is unique to Nexus Labs', () => {
      const action = ACTIONS.find(a => a.id === 'move_fast');
      expect(action).toBeDefined();
      expect(action!.factionSpecific).toBe('us_lab_b');
    });

    it('provides capability boost but exposure', () => {
      const state = createInitialState();
      const rng = () => 0.99; // High roll to avoid detection
      const factionId = 'us_lab_b';
      const initialCap = state.factions[factionId].capabilityScore;
      const initialExposure = state.factions[factionId].exposure;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'move_fast', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].capabilityScore).toBeGreaterThan(initialCap);
      expect(state.factions[factionId].exposure).toBeGreaterThan(initialExposure);
    });
  });

  describe('DeepCent - state_resources', () => {
    it('exists and is unique to DeepCent', () => {
      const action = ACTIONS.find(a => a.id === 'state_resources');
      expect(action).toBeDefined();
      expect(action!.factionSpecific).toBe('cn_lab');
    });

    it('provides compute access boost', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'cn_lab';
      const initialCompute = state.factions[factionId].resources.compute;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'state_resources', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[factionId].resources.compute).toBeGreaterThan(initialCompute);
    });
  });

  describe('US Gov - executive_order', () => {
    it('exists and is unique to US Gov', () => {
      const action = ACTIONS.find(a => a.id === 'executive_order');
      expect(action).toBeDefined();
      expect(action!.factionSpecific).toBe('us_gov');
    });

    it('applies instant regulation to target', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'us_gov';
      const targetId = 'us_lab_a';
      const initialTargetCap = state.factions[targetId].capabilityScore;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'executive_order', openness: 'open', targetFactionId: targetId },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[targetId].capabilityScore).toBeLessThan(initialTargetCap);
    });
  });

  describe('CN Gov - strategic_initiative', () => {
    it('exists and is unique to CN Gov', () => {
      const action = ACTIONS.find(a => a.id === 'strategic_initiative');
      expect(action).toBeDefined();
      expect(action!.factionSpecific).toBe('cn_gov');
    });

    it('boosts allied lab', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const factionId = 'cn_gov';
      const targetId = 'cn_lab';
      const initialCompute = state.factions[targetId].resources.compute;

      const choices: Record<string, ActionChoice[]> = {
        [factionId]: [
          { actionId: 'strategic_initiative', openness: 'open', targetFactionId: targetId },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.factions[targetId].resources.compute).toBeGreaterThan(initialCompute);
    });
  });

  describe('faction-specific action validation', () => {
    it('rejects faction-specific action from wrong faction', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const wrongFactionId = 'us_lab_b'; // Nexus Labs trying OpenBrain's ability

      const choices: Record<string, ActionChoice[]> = {
        [wrongFactionId]: [
          { actionId: 'open_research', openness: 'open' },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.log.some(l => l.includes('invalid action') || l.includes('not available'))).toBe(true);
    });
  });
});

describe('Backward Compatibility', () => {
  describe('existing actions still work', () => {
    it('research_capabilities works', () => {
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

    it('subsidize works', () => {
      const state = createInitialState();
      const rng = seededRng(42);
      const govId = 'us_gov';
      const labId = 'us_lab_a';

      const choices: Record<string, ActionChoice[]> = {
        [govId]: [
          { actionId: 'subsidize', openness: 'open', targetFactionId: labId },
        ],
      };

      resolveTurn(state, choices, rng);

      expect(state.log.some(l => l.includes('subsidized'))).toBe(true);
    });
  });

  describe('existing game state fields preserved', () => {
    it('has all original fields', () => {
      const state = createInitialState();
      expect(state.turn).toBeDefined();
      expect(state.year).toBeDefined();
      expect(state.quarter).toBeDefined();
      expect(state.factions).toBeDefined();
      expect(state.globalSafety).toBeDefined();
      expect(state.gameOver).toBeDefined();
      expect(state.log).toBeDefined();
    });

    it('factions have all original fields', () => {
      const state = createInitialState();
      const faction = Object.values(state.factions)[0];

      expect(faction.id).toBeDefined();
      expect(faction.name).toBeDefined();
      expect(faction.type).toBeDefined();
      expect(faction.resources).toBeDefined();
      expect(faction.safetyCulture).toBeDefined();
      expect(faction.opsec).toBeDefined();
      expect(faction.capabilityScore).toBeDefined();
      expect(faction.safetyScore).toBeDefined();
      expect(faction.exposure).toBeDefined();
      expect(faction.unlockedTechs).toBeDefined();
      expect(faction.research).toBeDefined();
      expect(faction.canDeployAgi).toBeDefined();
    });
  });
});
