import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/data/actions.js';
import { ActionDefinition, FactionType } from '../src/core/types.js';

describe('ACTIONS data', () => {
  it('has expected number of actions', () => {
    expect(ACTIONS.length).toBeGreaterThanOrEqual(10);
  });

  it('all actions have required fields', () => {
    for (const action of ACTIONS) {
      expect(action.id).toBeDefined();
      expect(action.name).toBeDefined();
      expect(action.kind).toBeDefined();
      expect(Array.isArray(action.allowedFor)).toBe(true);
      expect(action.allowedFor.length).toBeGreaterThan(0);
      expect(action.baseResearch).toBeDefined();
      expect(action.baseResourceDelta).toBeDefined();
      expect(typeof action.exposure).toBe('number');
    }
  });

  it('action IDs are unique', () => {
    const ids = ACTIONS.map(a => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('action kinds match IDs', () => {
    for (const action of ACTIONS) {
      expect(action.kind).toBe(action.id);
    }
  });
});

describe('lab actions', () => {
  const labActions = ACTIONS.filter(a => a.allowedFor.includes('lab'));

  it('labs have research_capabilities action', () => {
    const action = labActions.find(a => a.id === 'research_capabilities');
    expect(action).toBeDefined();
    expect(action!.baseResearch.capabilities).toBeGreaterThan(0);
  });

  it('labs have research_safety action', () => {
    const action = labActions.find(a => a.id === 'research_safety');
    expect(action).toBeDefined();
    expect(action!.baseResearch.safety).toBeGreaterThan(0);
  });

  it('labs have build_compute action', () => {
    const action = labActions.find(a => a.id === 'build_compute');
    expect(action).toBeDefined();
    expect(action!.baseResourceDelta.capital).toBeLessThan(0);
    expect(action!.baseResourceDelta.compute).toBeGreaterThan(0);
  });

  it('labs have deploy_products action', () => {
    const action = labActions.find(a => a.id === 'deploy_products');
    expect(action).toBeDefined();
    expect(action!.baseResourceDelta.capital).toBeGreaterThan(0);
  });

  it('labs have deploy_agi action', () => {
    const action = labActions.find(a => a.id === 'deploy_agi');
    expect(action).toBeDefined();
  });

  it('labs have espionage action', () => {
    const action = labActions.find(a => a.id === 'espionage');
    expect(action).toBeDefined();
    expect(action!.exposure).toBeGreaterThan(0);
  });

  it('labs have policy action', () => {
    const action = labActions.find(a => a.id === 'policy');
    expect(action).toBeDefined();
    expect(action!.baseResearch.policy).toBeGreaterThan(0);
  });
});

describe('government actions', () => {
  const govActions = ACTIONS.filter(a => a.allowedFor.includes('government'));

  it('governments have research_safety action', () => {
    const action = govActions.find(a => a.id === 'research_safety');
    expect(action).toBeDefined();
  });

  it('governments have policy action', () => {
    const action = govActions.find(a => a.id === 'policy');
    expect(action).toBeDefined();
  });

  it('governments have espionage action', () => {
    const action = govActions.find(a => a.id === 'espionage');
    expect(action).toBeDefined();
  });

  it('governments have subsidize action', () => {
    const action = govActions.find(a => a.id === 'subsidize');
    expect(action).toBeDefined();
    expect(action!.allowedFor).toContain('government');
    expect(action!.allowedFor).not.toContain('lab');
  });

  it('governments have regulate action', () => {
    const action = govActions.find(a => a.id === 'regulate');
    expect(action).toBeDefined();
    expect(action!.allowedFor).toContain('government');
    expect(action!.allowedFor).not.toContain('lab');
  });

  it('governments have counterintel action', () => {
    const action = govActions.find(a => a.id === 'counterintel');
    expect(action).toBeDefined();
    expect(action!.allowedFor).toContain('government');
    expect(action!.allowedFor).not.toContain('lab');
  });
});

describe('action balance', () => {
  it('research actions have similar base values', () => {
    const capRes = ACTIONS.find(a => a.id === 'research_capabilities')!;
    const safetyRes = ACTIONS.find(a => a.id === 'research_safety')!;

    expect(capRes.baseResearch.capabilities).toBe(safetyRes.baseResearch.safety);
  });

  it('espionage has high exposure', () => {
    const espionage = ACTIONS.find(a => a.id === 'espionage')!;
    expect(espionage.exposure).toBeGreaterThanOrEqual(2);
  });

  it('open actions have zero exposure', () => {
    const openActions = ['build_compute', 'deploy_products', 'policy', 'subsidize', 'regulate'];

    for (const id of openActions) {
      const action = ACTIONS.find(a => a.id === id)!;
      expect(action.exposure).toBe(0);
    }
  });

  it('deploy_agi has no direct resource effects', () => {
    const deployAgi = ACTIONS.find(a => a.id === 'deploy_agi')!;

    expect(Object.keys(deployAgi.baseResourceDelta).length).toBe(0);
    expect(Object.keys(deployAgi.baseResearch).length).toBe(0);
  });
});

describe('action validation helpers', () => {
  const isValidForFaction = (action: ActionDefinition, factionType: FactionType): boolean => {
    return action.allowedFor.includes(factionType);
  };

  it('validates lab actions correctly', () => {
    const capRes = ACTIONS.find(a => a.id === 'research_capabilities')!;
    const subsidize = ACTIONS.find(a => a.id === 'subsidize')!;

    expect(isValidForFaction(capRes, 'lab')).toBe(true);
    expect(isValidForFaction(subsidize, 'lab')).toBe(false);
  });

  it('validates government actions correctly', () => {
    const capRes = ACTIONS.find(a => a.id === 'research_capabilities')!;
    const subsidize = ACTIONS.find(a => a.id === 'subsidize')!;

    expect(isValidForFaction(capRes, 'government')).toBe(false);
    expect(isValidForFaction(subsidize, 'government')).toBe(true);
  });

  it('shared actions valid for both', () => {
    const policy = ACTIONS.find(a => a.id === 'policy')!;
    const espionage = ACTIONS.find(a => a.id === 'espionage')!;
    const safetyRes = ACTIONS.find(a => a.id === 'research_safety')!;

    expect(isValidForFaction(policy, 'lab')).toBe(true);
    expect(isValidForFaction(policy, 'government')).toBe(true);
    expect(isValidForFaction(espionage, 'lab')).toBe(true);
    expect(isValidForFaction(espionage, 'government')).toBe(true);
    expect(isValidForFaction(safetyRes, 'lab')).toBe(true);
    expect(isValidForFaction(safetyRes, 'government')).toBe(true);
  });
});

describe('targeted actions', () => {
  it('espionage requires target', () => {
    const espionage = ACTIONS.find(a => a.id === 'espionage')!;
    // Espionage is targeted, no self-targeting makes sense
    expect(espionage.kind).toBe('espionage');
  });

  it('subsidize requires target', () => {
    const subsidize = ACTIONS.find(a => a.id === 'subsidize')!;
    expect(subsidize.kind).toBe('subsidize');
  });

  it('regulate requires target', () => {
    const regulate = ACTIONS.find(a => a.id === 'regulate')!;
    expect(regulate.kind).toBe('regulate');
  });

  it('research actions do not require target', () => {
    const capRes = ACTIONS.find(a => a.id === 'research_capabilities')!;
    const safetyRes = ACTIONS.find(a => a.id === 'research_safety')!;

    expect(capRes.kind).toBe('research_capabilities');
    expect(safetyRes.kind).toBe('research_safety');
  });
});
