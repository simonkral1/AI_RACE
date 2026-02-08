import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state.js';
import { unlockAvailableTechs } from '../src/core/tech.js';

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
});
