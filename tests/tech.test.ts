import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state.js';
import { applyTechEffects, unlockAvailableTechs } from '../src/core/tech.js';
import { TECH_TREE } from '../src/data/techTree.js';

describe('tech unlocks', () => {
  it('unlocks affordable tech nodes', () => {
    const state = createInitialState();
    const faction = state.factions['us_lab_a'];
    faction.research.capabilities = 20;

    const unlocked = unlockAvailableTechs(faction);

    expect(unlocked).toContain('cap_foundation_model');
    expect(faction.unlockedTechs.has('cap_foundation_model')).toBe(true);
    expect(faction.research.capabilities).toBeLessThan(20);
  });

  it('includes a government hard-power tech option in the tree', () => {
    const node = TECH_TREE.find((entry) => entry.id === 'gov_hp_force_modernization');
    expect(node).toBeDefined();
    expect(node?.branch).toBe('hardPower');
    expect(node?.allowedFor).toEqual(['government']);
    expect(node?.effects).toContainEqual({ kind: 'stat', key: 'hardPower', delta: 2 });
  });

  it('applies hard-power stat effects from tech unlocks', () => {
    const state = createInitialState();
    const faction = state.factions['us_gov'];
    const before = faction.hardPower;

    applyTechEffects(faction, [{ kind: 'stat', key: 'hardPower', delta: 5 }]);

    expect(faction.hardPower).toBeGreaterThan(before);
  });
});
