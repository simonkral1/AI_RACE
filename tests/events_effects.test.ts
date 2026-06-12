/**
 * events_effects.test.ts
 *
 * Regression tests for P0.4: apply EVERY choice in EVERY event in events.ts
 * to a representative turn-2 game state and assert:
 *   1. No NaN / undefined in any faction's resources, scores, stats, or globalSafety
 *   2. All numeric values are within valid ranges [0, 100]
 *   3. No victory or loss condition fires from baseline turn-2 state
 *
 * Uses the extracted pure function applyEventEffects from src/core/eventEffects.ts
 * to avoid pulling in any browser UI code.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EVENTS } from '../src/data/events.js';
import { createInitialState } from '../src/core/state.js';
import { applyEventEffects } from '../src/core/eventEffects.js';
import { checkVictoryConditions, checkLossConditions } from '../src/core/victoryConditions.js';
import { GameState, FactionState } from '../src/core/types.js';
import { addUnifiedResearch } from '../src/core/research.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a representative turn-2 game state for regression testing. */
function makeTurn2State(): GameState {
  const state = createInitialState();
  state.turn = 2;
  state.year = 2026;
  state.quarter = 2;

  // Give every faction a modest research pool so research effects don't crash.
  for (const faction of Object.values(state.factions)) {
    addUnifiedResearch(faction, 20);
  }

  return state;
}

/** Deep-clone a game state so each test gets a fresh copy. */
function cloneState(state: GameState): GameState {
  const factions: Record<string, FactionState> = {};
  for (const [id, f] of Object.entries(state.factions)) {
    factions[id] = {
      ...f,
      resources: { ...f.resources },
      research: { ...f.research },
      unlockedTechs: new Set(f.unlockedTechs),
    };
  }
  return {
    ...state,
    factions,
    alliances: new Map(
      Array.from(state.alliances.entries()).map(([k, v]) => [k, [...v]])
    ),
    tensions: new Map(state.tensions),
    treaties: [...state.treaties],
    log: [],
  };
}

/** Collect every numeric leaf value from a FactionState. */
function factionNumericValues(f: FactionState): [string, number][] {
  const pairs: [string, number][] = [
    ['capabilityScore', f.capabilityScore],
    ['safetyScore', f.safetyScore],
    ['safetyCulture', f.safetyCulture],
    ['opsec', f.opsec],
    ['hardPower', f.hardPower],
    ['exposure', f.exposure],
    ['publicOpinion', f.publicOpinion],
    ['securityLevel', f.securityLevel],
    ['resources.compute', f.resources.compute],
    ['resources.cybersecurity', f.resources.cybersecurity],
    ['resources.capital', f.resources.capital],
    ['resources.influence', f.resources.influence],
    ['resources.trust', f.resources.trust],
  ];
  for (const [branch, value] of Object.entries(f.research)) {
    pairs.push([`research.${branch}`, value]);
  }
  return pairs;
}

/** Assert no NaN / undefined / out-of-range in a state after effect application. */
function assertStateIntegrity(state: GameState, context: string): void {
  // globalSafety
  expect(
    Number.isFinite(state.globalSafety),
    `${context}: globalSafety is not finite (got ${state.globalSafety})`
  ).toBe(true);
  expect(
    state.globalSafety,
    `${context}: globalSafety out of range`
  ).toBeGreaterThanOrEqual(0);
  expect(
    state.globalSafety,
    `${context}: globalSafety out of range`
  ).toBeLessThanOrEqual(100);

  for (const [factionId, faction] of Object.entries(state.factions)) {
    for (const [key, value] of factionNumericValues(faction)) {
      const label = `${context} — faction ${factionId}.${key}`;
      expect(
        value,
        `${label}: value is undefined`
      ).toBeDefined();
      expect(
        Number.isFinite(value),
        `${label}: value is NaN or Infinity (got ${value})`
      ).toBe(true);
      // Core game fields are clamped [0, 100]; research can accumulate higher
      // temporarily (clamping happens at spend time), so only check non-negative.
      if (key.startsWith('research')) {
        expect(value, `${label}: negative research`).toBeGreaterThanOrEqual(0);
      } else {
        expect(value, `${label}: below 0`).toBeGreaterThanOrEqual(0);
        expect(value, `${label}: above 100`).toBeLessThanOrEqual(100);
      }
    }
  }
}

/** Assert no spurious victory/loss fires from the post-effect state. */
function assertNoEarlyEndgame(state: GameState, context: string): void {
  for (const factionId of Object.keys(state.factions)) {
    const victory = checkVictoryConditions(state, factionId);
    expect(
      victory.victory,
      `${context} — faction ${factionId} won unexpectedly: ${victory.message}`
    ).toBe(false);

    const loss = checkLossConditions(state, factionId);
    expect(
      loss.loss,
      `${context} — faction ${factionId} lost unexpectedly (turn-2 baseline): ${loss.message}`
    ).toBe(false);
  }
}

// ---------------------------------------------------------------------------
// Baseline sanity: the turn-2 state itself should be clean
// ---------------------------------------------------------------------------

describe('turn-2 baseline state', () => {
  it('has no NaN values at baseline', () => {
    const state = makeTurn2State();
    assertStateIntegrity(state, 'baseline');
  });

  it('fires no victory or loss conditions at turn 2 baseline', () => {
    const state = makeTurn2State();
    assertNoEarlyEndgame(state, 'baseline');
  });
});

// ---------------------------------------------------------------------------
// Per-event, per-choice regression tests
// ---------------------------------------------------------------------------

describe('EVENTS — every choice applied to turn-2 state', () => {
  const baseState = makeTurn2State();
  const factionIds = Object.keys(baseState.factions);
  // Pick the first lab faction as the target for per-faction effects.
  const labFactionId = factionIds.find(id => baseState.factions[id].type === 'lab') ?? factionIds[0];

  it('EVENTS array is non-empty', () => {
    expect(EVENTS.length).toBeGreaterThan(0);
  });

  for (const event of EVENTS) {
    describe(`event "${event.id}"`, () => {
      for (const choice of event.choices) {
        it(`choice "${choice.id}" produces valid state`, () => {
          const state = cloneState(baseState);
          // Apply all effects of this choice on behalf of the lab faction
          applyEventEffects(choice.effects, labFactionId, state);

          assertStateIntegrity(
            state,
            `event=${event.id} choice=${choice.id}`
          );
          assertNoEarlyEndgame(
            state,
            `event=${event.id} choice=${choice.id}`
          );
        });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Target coverage: all_labs and all_factions effects
// ---------------------------------------------------------------------------

describe('all_labs and all_factions targeting', () => {
  it('effects targeting all_labs do not produce NaN for any faction', () => {
    // Synthesise a minimal event with all_labs target
    const state = makeTurn2State();
    const effects = [
      { kind: 'resource' as const, target: 'all_labs' as const, key: 'compute' as const, delta: -3 },
      { kind: 'score' as const, target: 'all_labs' as const, key: 'safetyScore' as const, delta: 2 },
    ];
    const labFactionId = Object.keys(state.factions).find(id => state.factions[id].type === 'lab')!;
    applyEventEffects(effects, labFactionId, state);
    assertStateIntegrity(state, 'all_labs target');
  });

  it('effects targeting all_factions do not produce NaN for any faction', () => {
    const state = makeTurn2State();
    const effects = [
      { kind: 'resource' as const, target: 'all_factions' as const, key: 'trust' as const, delta: -2 },
    ];
    const anyFactionId = Object.keys(state.factions)[0];
    applyEventEffects(effects, anyFactionId, state);
    assertStateIntegrity(state, 'all_factions target');
  });
});

// ---------------------------------------------------------------------------
// globalSafety edge cases
// ---------------------------------------------------------------------------

describe('globalSafety clamping', () => {
  it('stays at 0 when driven below 0', () => {
    const state = makeTurn2State();
    state.globalSafety = 5;
    const effects = [{ kind: 'globalSafety' as const, delta: -100 }];
    applyEventEffects(effects, Object.keys(state.factions)[0], state);
    expect(state.globalSafety).toBe(0);
  });

  it('stays at 100 when driven above 100', () => {
    const state = makeTurn2State();
    state.globalSafety = 95;
    const effects = [{ kind: 'globalSafety' as const, delta: 100 }];
    applyEventEffects(effects, Object.keys(state.factions)[0], state);
    expect(state.globalSafety).toBe(100);
  });
});
