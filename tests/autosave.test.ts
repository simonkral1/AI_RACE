/**
 * P0.2 Autosave + Resume — Vitest round-trip and fault-tolerance tests.
 *
 * Covers:
 *  1. Full mid-game state round-trip through serialize/deserialize.
 *  2. Session context (playerFactionId, eventHistory) survives the round-trip.
 *  3. saveToLocalStorage / loadFromLocalStorage with session context.
 *  4. Corrupt JSON string falls back gracefully (null, slot cleared).
 *  5. Version-mismatch save falls back gracefully (null, slot cleared).
 *  6. loadRawAutosave returns session context without full deserialization.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  serializeState,
  deserializeState,
  saveToLocalStorage,
  loadFromLocalStorage,
  loadRawAutosave,
  hasSaveSlot,
  SAVE_VERSION,
} from '../src/core/persistence.js';
import { createInitialState } from '../src/core/state.js';
import { GameState } from '../src/core/types.js';

// ── Mock localStorage ──────────────────────────────────────────────────────────

const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const buildMidGameState = (): GameState => {
  const state = createInitialState();

  // Advance the simulation meaningfully
  state.turn = 12;
  state.year = 2029;
  state.quarter = 1;
  state.globalSafety = 63;
  state.gameOver = false;

  // Player faction with real progress
  const player = state.factions['us_lab_a'];
  if (player) {
    player.capabilityScore = 48;
    player.safetyScore = 55;
    player.resources.compute = 72;
    player.resources.capital = 88;
    player.resources.trust = 61;
    player.resources.cybersecurity = 44;
    player.resources.influence = 37;
    player.hardPower = 30;
    player.safetyCulture = 58;
    player.opsec = 42;
    player.publicOpinion = 67;
    player.securityLevel = 3;
    player.research.capabilities = 120;
    player.research.safety = 95;
    player.research.ops = 45;
    player.research.hardPower = 20;
    player.research.policy = 30;
    player.unlockedTechs.add('interpretability_tools');
    player.unlockedTechs.add('scalable_oversight');
    player.unlockedTechs.add('constitutional_ai');
    player.canDeployAgi = false;
  }

  // Some alliances and tensions
  state.alliances.set('us_lab_a', ['eu_gov']);
  state.alliances.set('eu_gov', ['us_lab_a']);
  state.tensions.set('us_lab_a:cn_lab', 72);
  state.tensions.set('cn_lab:us_lab_a', 72);

  // Treaties and log
  state.treaties = ['safety_framework_2028'];
  state.log = [
    'Turn 10: Research capabilities advanced.',
    'Turn 11: Alliance formed with EU Gov.',
    'Turn 12: Unsafe deployment risk rising in CN Lab.',
  ];

  return state;
};

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('P0.2 autosave: serialize/deserialize round-trip', () => {
  it('preserves all essential mid-game fields through a full round-trip', () => {
    const original = buildMidGameState();
    const serialized = serializeState(original);
    const restored = deserializeState(serialized);

    // Top-level game state
    expect(restored.turn).toBe(12);
    expect(restored.year).toBe(2029);
    expect(restored.quarter).toBe(1);
    expect(restored.globalSafety).toBe(63);
    expect(restored.gameOver).toBe(false);

    // Log preserved
    expect(restored.log).toHaveLength(3);
    expect(restored.log[0]).toBe('Turn 10: Research capabilities advanced.');

    // Faction resources
    const player = restored.factions['us_lab_a'];
    expect(player).toBeDefined();
    expect(player.capabilityScore).toBe(48);
    expect(player.safetyScore).toBe(55);
    expect(player.resources.compute).toBe(72);
    expect(player.resources.capital).toBe(88);
    expect(player.resources.trust).toBe(61);
    expect(player.resources.cybersecurity).toBe(44);
    expect(player.resources.influence).toBe(37);
    expect(player.hardPower).toBe(30);
    expect(player.safetyCulture).toBe(58);
    expect(player.opsec).toBe(42);
    expect(player.publicOpinion).toBe(67);
    expect(player.securityLevel).toBe(3);

    // Research pool
    expect(player.research.capabilities).toBe(120);
    expect(player.research.safety).toBe(95);
    expect(player.research.ops).toBe(45);
    expect(player.research.hardPower).toBe(20);
    expect(player.research.policy).toBe(30);

    // Unlocked techs (must restore as Set)
    expect(player.unlockedTechs).toBeInstanceOf(Set);
    expect(player.unlockedTechs.has('interpretability_tools')).toBe(true);
    expect(player.unlockedTechs.has('scalable_oversight')).toBe(true);
    expect(player.unlockedTechs.has('constitutional_ai')).toBe(true);

    // Alliance Map
    expect(restored.alliances).toBeInstanceOf(Map);
    expect(restored.alliances.get('us_lab_a')).toContain('eu_gov');

    // Tension Map
    expect(restored.tensions).toBeInstanceOf(Map);
    expect(restored.tensions.get('us_lab_a:cn_lab')).toBe(72);

    // Treaties array
    expect(restored.treaties).toContain('safety_framework_2028');
  });

  it('embeds session context (playerFactionId, eventHistory) in the serialized payload', () => {
    const state = buildMidGameState();
    const context = {
      playerFactionId: 'us_lab_a',
      eventHistory: ['first_board_meeting', 'whistleblower_leak', 'compute_embargo'],
    };
    const serialized = serializeState(state, context);

    expect(serialized.playerFactionId).toBe('us_lab_a');
    expect(serialized.eventHistory).toEqual(context.eventHistory);
    expect(serialized.version).toBe(SAVE_VERSION);
  });
});

describe('P0.2 autosave: localStorage round-trip with session context', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('saves and loads mid-game state preserving all faction fields', () => {
    const original = buildMidGameState();
    const saved = saveToLocalStorage(original, 'autosave', { playerFactionId: 'us_lab_a' });
    expect(saved).toBe(true);

    const restored = loadFromLocalStorage('autosave');
    expect(restored).not.toBeNull();
    expect(restored!.turn).toBe(12);

    const player = restored!.factions['us_lab_a'];
    expect(player.unlockedTechs.has('interpretability_tools')).toBe(true);
    expect(restored!.alliances.get('us_lab_a')).toContain('eu_gov');
    expect(restored!.tensions.get('us_lab_a:cn_lab')).toBe(72);
  });

  it('loadRawAutosave returns session context without full deserialization', () => {
    const state = buildMidGameState();
    const eventHistory = ['first_board_meeting', 'safety_incident_q3'];
    saveToLocalStorage(state, 'autosave', { playerFactionId: 'cn_lab', eventHistory });

    const raw = loadRawAutosave('autosave');
    expect(raw).not.toBeNull();
    expect(raw!.playerFactionId).toBe('cn_lab');
    expect(raw!.eventHistory).toEqual(eventHistory);
    expect(raw!.turn).toBe(12);
  });

  it('loadFromLocalStorage returns null for a missing slot', () => {
    expect(loadFromLocalStorage('no_such_slot')).toBeNull();
  });
});

describe('P0.2 autosave: corrupt/incompatible save fallback', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('loadFromLocalStorage returns null for a corrupt JSON string and clears the slot', () => {
    mockStorage.setItem('agi_race_save_autosave', '{this is not valid json{{{{');

    const result = loadFromLocalStorage('autosave');

    expect(result).toBeNull();
    // The bad save must be removed so the player is never stuck
    expect(mockStorage.getItem('agi_race_save_autosave')).toBeNull();
  });

  it('loadFromLocalStorage returns null for a version-mismatch save and clears the slot', () => {
    const state = buildMidGameState();
    const serialized = serializeState(state);
    // Forge an old version number
    const stale = JSON.stringify({ ...serialized, version: SAVE_VERSION - 1, savedAt: new Date().toISOString() });
    mockStorage.setItem('agi_race_save_autosave', stale);

    const result = loadFromLocalStorage('autosave');

    expect(result).toBeNull();
    // Slot must be cleared
    expect(mockStorage.getItem('agi_race_save_autosave')).toBeNull();
  });

  it('loadRawAutosave returns null for a version-mismatch save and clears the slot', () => {
    const state = buildMidGameState();
    const serialized = serializeState(state);
    const stale = JSON.stringify({ ...serialized, version: 99, savedAt: new Date().toISOString() });
    mockStorage.setItem('agi_race_save_autosave', stale);

    const raw = loadRawAutosave('autosave');

    expect(raw).toBeNull();
    expect(mockStorage.getItem('agi_race_save_autosave')).toBeNull();
  });

  it('loadRawAutosave returns null for corrupt JSON and clears the slot', () => {
    mockStorage.setItem('agi_race_save_autosave', 'not json at all');

    const raw = loadRawAutosave('autosave');

    expect(raw).toBeNull();
    expect(mockStorage.getItem('agi_race_save_autosave')).toBeNull();
  });

  it('loadFromLocalStorage returns null when localStorage is absent', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadFromLocalStorage('autosave')).toBeNull();
    // Restore
    vi.stubGlobal('localStorage', mockStorage);
  });
});

describe('P0.2 autosave: schema version', () => {
  it('exported SAVE_VERSION is a positive integer', () => {
    expect(typeof SAVE_VERSION).toBe('number');
    expect(Number.isInteger(SAVE_VERSION)).toBe(true);
    expect(SAVE_VERSION).toBeGreaterThan(0);
  });

  it('serializeState stamps the current SAVE_VERSION', () => {
    const serialized = serializeState(buildMidGameState());
    expect(serialized.version).toBe(SAVE_VERSION);
  });

  it('deserializeState throws on version mismatch', () => {
    const serialized = serializeState(buildMidGameState());
    const broken = { ...serialized, version: SAVE_VERSION + 99 };
    expect(() => deserializeState(broken)).toThrow();
  });
});
