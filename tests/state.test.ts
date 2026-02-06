import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state.js';
import { FACTION_TEMPLATES } from '../src/data/factions.js';
import { TURN_START_QUARTER, TURN_START_YEAR } from '../src/core/constants.js';

describe('createInitialState', () => {
  it('creates state with correct initial turn and calendar', () => {
    const state = createInitialState();

    expect(state.turn).toBe(0);
    expect(state.year).toBe(TURN_START_YEAR);
    expect(state.quarter).toBe(TURN_START_QUARTER);
    expect(state.gameOver).toBe(false);
    expect(state.winnerId).toBeUndefined();
    expect(state.log).toEqual([]);
  });

  it('initializes all factions from templates', () => {
    const state = createInitialState();

    expect(Object.keys(state.factions).length).toBe(FACTION_TEMPLATES.length);

    for (const template of FACTION_TEMPLATES) {
      expect(state.factions[template.id]).toBeDefined();
      expect(state.factions[template.id].name).toBe(template.name);
      expect(state.factions[template.id].type).toBe(template.type);
    }
  });

  it('initializes faction resources correctly', () => {
    const state = createInitialState();

    for (const template of FACTION_TEMPLATES) {
      const faction = state.factions[template.id];
      expect(faction.resources.compute).toBe(template.resources.compute);
      expect(faction.resources.talent).toBe(template.resources.talent);
      expect(faction.resources.capital).toBe(template.resources.capital);
      expect(faction.resources.data).toBe(template.resources.data);
      expect(faction.resources.influence).toBe(template.resources.influence);
      expect(faction.resources.trust).toBe(template.resources.trust);
    }
  });

  it('initializes faction stats correctly', () => {
    const state = createInitialState();

    for (const template of FACTION_TEMPLATES) {
      const faction = state.factions[template.id];
      expect(faction.safetyCulture).toBe(template.safetyCulture);
      expect(faction.opsec).toBe(template.opsec);
      expect(faction.capabilityScore).toBe(template.capabilityScore);
      expect(faction.safetyScore).toBe(template.safetyScore);
    }
  });

  it('initializes research branches to zero', () => {
    const state = createInitialState();

    for (const faction of Object.values(state.factions)) {
      expect(faction.research.capabilities).toBe(0);
      expect(faction.research.safety).toBe(0);
      expect(faction.research.ops).toBe(0);
      expect(faction.research.policy).toBe(0);
    }
  });

  it('initializes exposure to zero', () => {
    const state = createInitialState();

    for (const faction of Object.values(state.factions)) {
      expect(faction.exposure).toBe(0);
    }
  });

  it('initializes canDeployAgi to false', () => {
    const state = createInitialState();

    for (const faction of Object.values(state.factions)) {
      expect(faction.canDeployAgi).toBe(false);
    }
  });

  it('initializes unlockedTechs as empty Set', () => {
    const state = createInitialState();

    for (const faction of Object.values(state.factions)) {
      expect(faction.unlockedTechs).toBeInstanceOf(Set);
      expect(faction.unlockedTechs.size).toBe(0);
    }
  });

  it('computes initial global safety', () => {
    const state = createInitialState();

    expect(state.globalSafety).toBeGreaterThan(0);
    expect(state.globalSafety).toBeLessThanOrEqual(100);
  });

  it('resources are within valid range 0-100', () => {
    const state = createInitialState();

    for (const faction of Object.values(state.factions)) {
      for (const value of Object.values(faction.resources)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('does not share resource objects between factions', () => {
    const state = createInitialState();
    const factionIds = Object.keys(state.factions);

    if (factionIds.length >= 2) {
      const faction1 = state.factions[factionIds[0]];
      const faction2 = state.factions[factionIds[1]];

      faction1.resources.capital = 999;
      expect(faction2.resources.capital).not.toBe(999);
    }
  });

  it('contains expected faction types', () => {
    const state = createInitialState();

    const labs = Object.values(state.factions).filter(f => f.type === 'lab');
    const govs = Object.values(state.factions).filter(f => f.type === 'government');

    expect(labs.length).toBeGreaterThan(0);
    expect(govs.length).toBeGreaterThan(0);
  });
});
