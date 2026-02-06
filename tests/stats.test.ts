import { describe, expect, it } from 'vitest';
import {
  computeGlobalSafety,
  applyResourceDelta,
  applyStatDelta,
  applyScoreDelta,
  computeResearchGain,
} from '../src/core/stats.js';
import { createInitialState } from '../src/core/state.js';
import { FactionState } from '../src/core/types.js';

describe('computeGlobalSafety', () => {
  it('returns weighted average of faction safety scores', () => {
    const state = createInitialState();
    const safety = computeGlobalSafety(state);

    expect(safety).toBeGreaterThanOrEqual(0);
    expect(safety).toBeLessThanOrEqual(100);
  });

  it('weighs factions by capability score', () => {
    const state = createInitialState();

    // Set one faction to have high capability and high safety
    const faction = Object.values(state.factions)[0];
    faction.capabilityScore = 100;
    faction.safetyScore = 100;

    const safety = computeGlobalSafety(state);

    // Should be pulled toward 100 by the high-capability faction
    expect(safety).toBeGreaterThan(30);
  });

  it('returns 0 for empty state', () => {
    const state = createInitialState();
    state.factions = {};

    const safety = computeGlobalSafety(state);
    expect(safety).toBe(0);
  });

  it('uses minimum weight of 10 for low capability factions', () => {
    const state = createInitialState();

    // Set all factions to low capability
    for (const faction of Object.values(state.factions)) {
      faction.capabilityScore = 0;
      faction.safetyScore = 50;
    }

    const safety = computeGlobalSafety(state);
    expect(safety).toBeCloseTo(50, 0);
  });
});

describe('applyResourceDelta', () => {
  it('applies positive delta correctly', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    const initialCapital = faction.resources.capital;

    applyResourceDelta(faction, { capital: 10 });

    expect(faction.resources.capital).toBe(Math.min(100, initialCapital + 10));
  });

  it('applies negative delta correctly', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.resources.capital = 50;

    applyResourceDelta(faction, { capital: -20 });

    expect(faction.resources.capital).toBe(30);
  });

  it('clamps to 0 minimum', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.resources.capital = 10;

    applyResourceDelta(faction, { capital: -50 });

    expect(faction.resources.capital).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.resources.capital = 90;

    applyResourceDelta(faction, { capital: 50 });

    expect(faction.resources.capital).toBe(100);
  });

  it('applies multiple resources at once', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.resources.capital = 50;
    faction.resources.trust = 50;

    applyResourceDelta(faction, { capital: 10, trust: -5 });

    expect(faction.resources.capital).toBe(60);
    expect(faction.resources.trust).toBe(45);
  });

  it('ignores undefined values', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    const initialCapital = faction.resources.capital;

    applyResourceDelta(faction, { capital: undefined as any });

    expect(faction.resources.capital).toBe(initialCapital);
  });
});

describe('applyStatDelta', () => {
  it('applies delta to safetyCulture', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.safetyCulture = 50;

    applyStatDelta(faction, 'safetyCulture', 10);

    expect(faction.safetyCulture).toBe(60);
  });

  it('applies delta to opsec', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.opsec = 50;

    applyStatDelta(faction, 'opsec', -15);

    expect(faction.opsec).toBe(35);
  });

  it('clamps within 0-100', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.opsec = 90;

    applyStatDelta(faction, 'opsec', 20);

    expect(faction.opsec).toBe(100);
  });
});

describe('applyScoreDelta', () => {
  it('applies delta to capabilityScore', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.capabilityScore = 20;

    applyScoreDelta(faction, 'capabilityScore', 15);

    expect(faction.capabilityScore).toBe(35);
  });

  it('applies delta to safetyScore', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.safetyScore = 40;

    applyScoreDelta(faction, 'safetyScore', -10);

    expect(faction.safetyScore).toBe(30);
  });

  it('clamps scores within 0-100', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.safetyScore = 5;

    applyScoreDelta(faction, 'safetyScore', -20);

    expect(faction.safetyScore).toBe(0);
  });
});

describe('computeResearchGain', () => {
  it('computes capabilities research gain', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];

    const gain = computeResearchGain(faction, 'capabilities', 10);

    expect(gain).toBeGreaterThan(10); // Should be boosted by compute, talent, data
  });

  it('computes safety research gain', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];

    const gain = computeResearchGain(faction, 'safety', 10);

    expect(gain).toBeGreaterThan(10); // Should be boosted by talent, safetyCulture, trust
  });

  it('computes ops research gain', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];

    const gain = computeResearchGain(faction, 'ops', 10);

    expect(gain).toBeGreaterThan(10); // Should be boosted by capital, compute, talent
  });

  it('computes policy research gain', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];

    const gain = computeResearchGain(faction, 'policy', 10);

    expect(gain).toBeGreaterThan(10); // Should be boosted by influence, trust
  });

  it('returns base for unknown branch', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];

    const gain = computeResearchGain(faction, 'unknown' as any, 10);

    expect(gain).toBe(10);
  });

  it('higher resources produce higher gains', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];

    const lowGain = computeResearchGain(faction, 'capabilities', 10);

    faction.resources.compute = 100;
    faction.resources.talent = 100;
    faction.resources.data = 100;

    const highGain = computeResearchGain(faction, 'capabilities', 10);

    expect(highGain).toBeGreaterThan(lowGain);
  });
});
