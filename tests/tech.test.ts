import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state.js';
import { unlockAvailableTechs } from '../src/core/tech.js';

describe('tech unlocks', () => {
  it('unlocks affordable tech nodes', () => {
    const state = createInitialState();
    const faction = state.factions['us_lab_a'];
    faction.research.capabilities = 25;

    const unlocked = unlockAvailableTechs(faction);

    expect(unlocked).toContain('cap_eff_training');
    expect(faction.unlockedTechs.has('cap_eff_training')).toBe(true);
    expect(faction.research.capabilities).toBeLessThan(25);
  });
});
