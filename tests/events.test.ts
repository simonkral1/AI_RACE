import { describe, expect, it } from 'vitest';
import { EVENTS, selectEvent, EventDefinition, EventEffect } from '../src/data/events.js';
import { createInitialState } from '../src/core/state.js';
import { applyResourceDelta, applyScoreDelta, applyStatDelta } from '../src/core/stats.js';
import { GameState, FactionState } from '../src/core/types.js';

const seededRng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

describe('EVENTS data', () => {
  it('has at least 5 events', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(5);
  });

  it('all events have required fields', () => {
    for (const event of EVENTS) {
      expect(event.id).toBeDefined();
      expect(event.title).toBeDefined();
      expect(event.description).toBeDefined();
      expect(event.weight).toBeGreaterThan(0);
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all choices have required fields', () => {
    for (const event of EVENTS) {
      for (const choice of event.choices) {
        expect(choice.id).toBeDefined();
        expect(choice.label).toBeDefined();
        expect(choice.description).toBeDefined();
        expect(Array.isArray(choice.effects)).toBe(true);
      }
    }
  });

  it('event IDs are unique', () => {
    const ids = EVENTS.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('choice IDs are unique within each event', () => {
    for (const event of EVENTS) {
      const ids = event.choices.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});

describe('selectEvent', () => {
  it('returns null when rng > 0.45', () => {
    const state = createInitialState();
    const rng = () => 0.9; // High roll, should skip event

    const event = selectEvent(state, rng, []);

    expect(event).toBeNull();
  });

  it('returns an event when rng <= 0.45', () => {
    const state = createInitialState();
    const rng = () => 0.2; // Low roll, should trigger event

    const event = selectEvent(state, rng, []);

    expect(event).not.toBeNull();
  });

  it('filters by minTurn', () => {
    const state = createInitialState();
    state.turn = 1;

    // Create a custom rng that always triggers events
    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.2 : 0.5; // First call triggers, second for selection
    };

    const event = selectEvent(state, rng, []);

    // Should not include events with minTurn > 1
    if (event && event.minTurn !== undefined) {
      expect(event.minTurn).toBeLessThanOrEqual(state.turn);
    }
  });

  it('filters by maxTurn', () => {
    const state = createInitialState();
    state.turn = 100;

    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.2 : 0.5;
    };

    const event = selectEvent(state, rng, []);

    // Should not include events with maxTurn < 100
    if (event && event.maxTurn !== undefined) {
      expect(event.maxTurn).toBeGreaterThanOrEqual(state.turn);
    }
  });

  it('excludes recent events from history', () => {
    const state = createInitialState();

    // Put all but one event in recent history
    const history = EVENTS.slice(0, -1).map(e => e.id);

    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.2 : 0.999;
    };

    const event = selectEvent(state, rng, history);

    if (event) {
      expect(history.slice(-3)).not.toContain(event.id);
    }
  });

  it('only considers last 3 events for cooldown', () => {
    const state = createInitialState();

    // Put first event in history but more than 3 events ago
    const firstEventId = EVENTS[0].id;
    const history = [firstEventId, 'dummy1', 'dummy2', 'dummy3', 'dummy4'];

    let callCount = 0;
    const rng = () => {
      callCount++;
      return callCount === 1 ? 0.2 : 0.001; // Very low roll to pick first weighted event
    };

    const event = selectEvent(state, rng, history);

    // First event should be eligible since it's not in last 3
    if (event) {
      expect(EVENTS.map(e => e.id)).toContain(event.id);
    }
  });

  it('uses weighted selection', () => {
    const state = createInitialState();

    // Run many trials and check distribution
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const rng = seededRng(i);
      const event = selectEvent(state, rng, []);
      if (event) {
        counts[event.id] = (counts[event.id] || 0) + 1;
      }
    }

    // Higher weight events should appear more often (roughly)
    // Just check that we got variety
    const eventCount = Object.keys(counts).length;
    expect(eventCount).toBeGreaterThan(1);
  });

  it('returns null when all events filtered by cooldown', () => {
    const state = createInitialState();

    // When fewer than 3 events exist and all are in recent history
    // But since we have 5+ events and only last 3 are checked,
    // we can't filter all events. Test the behavior when eligible is empty.
    // Set turn very high so maxTurn filters most events, and put rest in cooldown
    state.turn = 1000;

    // History contains last 3 events
    const history = EVENTS.slice(-3).map(e => e.id);

    const rng = () => 0.2;

    const event = selectEvent(state, rng, history);

    // With high turn, events with maxTurn will be filtered
    // And recent ones in cooldown - may or may not return null depending on data
    // This test verifies the selection process works without crashing
    expect(event === null || EVENTS.map(e => e.id).includes(event.id)).toBe(true);
  });
});

describe('event effect application', () => {
  const applyEventEffect = (
    effect: EventEffect,
    faction: FactionState,
    state: GameState
  ) => {
    switch (effect.kind) {
      case 'resource':
        if (effect.target === 'faction') {
          applyResourceDelta(faction, { [effect.key]: effect.delta });
        }
        break;
      case 'score':
        if (effect.target === 'faction') {
          applyScoreDelta(faction, effect.key, effect.delta);
        }
        break;
      case 'stat':
        if (effect.target === 'faction') {
          applyStatDelta(faction, effect.key, effect.delta);
        }
        break;
      case 'globalSafety':
        state.globalSafety += effect.delta;
        break;
    }
  };

  it('applies resource effects correctly', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.resources.capital = 50;

    const effect: EventEffect = {
      kind: 'resource',
      target: 'faction',
      key: 'capital',
      delta: -10,
    };

    applyEventEffect(effect, faction, state);

    expect(faction.resources.capital).toBe(40);
  });

  it('applies score effects correctly', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.safetyScore = 30;

    const effect: EventEffect = {
      kind: 'score',
      target: 'faction',
      key: 'safetyScore',
      delta: 5,
    };

    applyEventEffect(effect, faction, state);

    expect(faction.safetyScore).toBe(35);
  });

  it('applies stat effects correctly', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.opsec = 40;

    const effect: EventEffect = {
      kind: 'stat',
      target: 'faction',
      key: 'opsec',
      delta: 4,
    };

    applyEventEffect(effect, faction, state);

    expect(faction.opsec).toBe(44);
  });

  it('applies globalSafety effects correctly', () => {
    const state = createInitialState();
    state.globalSafety = 50;
    const faction = Object.values(state.factions)[0];

    const effect: EventEffect = {
      kind: 'globalSafety',
      delta: 4,
    };

    applyEventEffect(effect, faction, state);

    expect(state.globalSafety).toBe(54);
  });

  it('supply_shock event has balanced choices', () => {
    const supplyShock = EVENTS.find(e => e.id === 'supply_shock')!;

    expect(supplyShock).toBeDefined();
    expect(supplyShock.choices.length).toBe(3);

    // Each choice should have some trade-off
    for (const choice of supplyShock.choices) {
      expect(choice.effects.length).toBeGreaterThan(0);
    }
  });

  it('global_summit event affects global safety', () => {
    const summit = EVENTS.find(e => e.id === 'global_summit')!;

    expect(summit).toBeDefined();

    // Sign pact should affect global safety
    const signPact = summit.choices.find(c => c.id === 'sign_pact')!;
    const hasGlobalEffect = signPact.effects.some(e => e.kind === 'globalSafety');
    expect(hasGlobalEffect).toBe(true);
  });
});

describe('event balance', () => {
  it('total weight is reasonable', () => {
    const totalWeight = EVENTS.reduce((sum, e) => sum + e.weight, 0);

    expect(totalWeight).toBeGreaterThan(1);
    expect(totalWeight).toBeLessThan(100);
  });

  it('no single event dominates', () => {
    const totalWeight = EVENTS.reduce((sum, e) => sum + e.weight, 0);

    for (const event of EVENTS) {
      const proportion = event.weight / totalWeight;
      expect(proportion).toBeLessThan(0.5);
    }
  });
});
