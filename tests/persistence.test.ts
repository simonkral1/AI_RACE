import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  serializeState,
  deserializeState,
  saveToLocalStorage,
  loadFromLocalStorage,
  getSaveSlots,
  deleteSaveSlot,
  hasSaveSlot,
  getSaveMetadata,
} from '../src/core/persistence.js';
import { createInitialState } from '../src/core/state.js';
import { GameState } from '../src/core/types.js';

// Mock localStorage for Node environment
const createMockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] || null,
  };
};

describe('serializeState', () => {
  it('converts GameState to serializable format', () => {
    const state = createInitialState();
    const serialized = serializeState(state);

    expect(serialized.turn).toBe(state.turn);
    expect(serialized.year).toBe(state.year);
    expect(serialized.quarter).toBe(state.quarter);
    expect(serialized.globalSafety).toBe(state.globalSafety);
    expect(serialized.gameOver).toBe(state.gameOver);
    expect(serialized.version).toBe(1);
  });

  it('converts Set to array for unlockedTechs', () => {
    const state = createInitialState();
    const faction = Object.values(state.factions)[0];
    faction.unlockedTechs.add('tech1');
    faction.unlockedTechs.add('tech2');

    const serialized = serializeState(state);
    const serializedFaction = Object.values(serialized.factions)[0];

    expect(Array.isArray(serializedFaction.unlockedTechs)).toBe(true);
    expect(serializedFaction.unlockedTechs).toContain('tech1');
    expect(serializedFaction.unlockedTechs).toContain('tech2');
  });

  it('limits log entries to 50', () => {
    const state = createInitialState();
    for (let i = 0; i < 100; i++) {
      state.log.push(`Log entry ${i}`);
    }

    const serialized = serializeState(state);

    expect(serialized.log.length).toBe(50);
    expect(serialized.log[0]).toBe('Log entry 50');
  });

  it('preserves all faction data', () => {
    const state = createInitialState();
    const serialized = serializeState(state);

    expect(Object.keys(serialized.factions).length).toBe(Object.keys(state.factions).length);

    for (const id of Object.keys(state.factions)) {
      expect(serialized.factions[id]).toBeDefined();
      expect(serialized.factions[id].id).toBe(state.factions[id].id);
      expect(serialized.factions[id].name).toBe(state.factions[id].name);
      expect(serialized.factions[id].type).toBe(state.factions[id].type);
    }
  });
});

describe('deserializeState', () => {
  it('restores GameState from serialized format', () => {
    const original = createInitialState();
    original.turn = 5;
    original.year = 2027;
    original.quarter = 2;
    original.globalSafety = 45;

    const serialized = serializeState(original);
    const restored = deserializeState(serialized);

    expect(restored.turn).toBe(original.turn);
    expect(restored.year).toBe(original.year);
    expect(restored.quarter).toBe(original.quarter);
    expect(restored.globalSafety).toBe(original.globalSafety);
  });

  it('restores unlockedTechs as Set', () => {
    const original = createInitialState();
    const faction = Object.values(original.factions)[0];
    faction.unlockedTechs.add('tech1');
    faction.unlockedTechs.add('tech2');

    const serialized = serializeState(original);
    const restored = deserializeState(serialized);
    const restoredFaction = Object.values(restored.factions)[0];

    expect(restoredFaction.unlockedTechs).toBeInstanceOf(Set);
    expect(restoredFaction.unlockedTechs.has('tech1')).toBe(true);
    expect(restoredFaction.unlockedTechs.has('tech2')).toBe(true);
  });

  it('handles version mismatch gracefully', () => {
    const serialized = serializeState(createInitialState());
    (serialized as any).version = 999;

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const restored = deserializeState(serialized);

    expect(restored).toBeDefined();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('preserves winnerId when game is over', () => {
    const original = createInitialState();
    original.gameOver = true;
    original.winnerId = 'us_lab_a';

    const serialized = serializeState(original);
    const restored = deserializeState(serialized);

    expect(restored.gameOver).toBe(true);
    expect(restored.winnerId).toBe('us_lab_a');
  });
});

describe('localStorage operations', () => {
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('saveToLocalStorage saves state correctly', () => {
    const state = createInitialState();
    const result = saveToLocalStorage(state, 'test_slot');

    expect(result).toBe(true);
    expect(mockStorage.getItem('agi_race_save_test_slot')).toBeTruthy();
  });

  it('loadFromLocalStorage restores state correctly', () => {
    const original = createInitialState();
    original.turn = 10;

    saveToLocalStorage(original, 'test_slot');
    const restored = loadFromLocalStorage('test_slot');

    expect(restored).not.toBeNull();
    expect(restored!.turn).toBe(10);
  });

  it('loadFromLocalStorage returns null for missing slot', () => {
    const result = loadFromLocalStorage('nonexistent');
    expect(result).toBeNull();
  });

  it('getSaveSlots returns all save slots', () => {
    saveToLocalStorage(createInitialState(), 'slot1');
    saveToLocalStorage(createInitialState(), 'slot2');
    saveToLocalStorage(createInitialState(), 'autosave');

    const slots = getSaveSlots();

    expect(slots).toContain('slot1');
    expect(slots).toContain('slot2');
    expect(slots).toContain('autosave');
  });

  it('deleteSaveSlot removes save', () => {
    saveToLocalStorage(createInitialState(), 'to_delete');
    expect(hasSaveSlot('to_delete')).toBe(true);

    deleteSaveSlot('to_delete');
    expect(hasSaveSlot('to_delete')).toBe(false);
  });

  it('hasSaveSlot correctly detects existence', () => {
    expect(hasSaveSlot('missing')).toBe(false);

    saveToLocalStorage(createInitialState(), 'exists');
    expect(hasSaveSlot('exists')).toBe(true);
  });

  it('getSaveMetadata returns correct info', () => {
    const state = createInitialState();
    state.turn = 15;
    state.year = 2029;
    state.quarter = 3;

    saveToLocalStorage(state, 'meta_test');

    const meta = getSaveMetadata('meta_test');

    expect(meta).not.toBeNull();
    expect(meta!.turn).toBe(15);
    expect(meta!.year).toBe(2029);
    expect(meta!.quarter).toBe(3);
    expect(meta!.savedAt).toBeTruthy();
  });

  it('getSaveMetadata returns null for missing slot', () => {
    const meta = getSaveMetadata('nonexistent');
    expect(meta).toBeNull();
  });

  it('autosave slot is default', () => {
    const state = createInitialState();
    saveToLocalStorage(state);

    expect(hasSaveSlot('autosave')).toBe(true);

    const restored = loadFromLocalStorage();
    expect(restored).not.toBeNull();
  });
});

describe('round-trip serialization', () => {
  it('preserves complete game state through serialize/deserialize', () => {
    const original = createInitialState();

    // Modify state significantly
    original.turn = 20;
    original.year = 2031;
    original.quarter = 4;
    original.globalSafety = 75;
    original.gameOver = true;
    original.winnerId = 'cn_lab';
    original.log = ['Entry 1', 'Entry 2', 'Entry 3'];

    const faction = original.factions['us_lab_a'];
    faction.resources.capital = 95;
    faction.resources.compute = 80;
    faction.capabilityScore = 85;
    faction.safetyScore = 70;
    faction.research.capabilities = 150;
    faction.unlockedTechs.add('advanced_tech_1');
    faction.unlockedTechs.add('advanced_tech_2');
    faction.canDeployAgi = true;

    const serialized = serializeState(original);
    const restored = deserializeState(serialized);

    // Verify top-level state
    expect(restored.turn).toBe(original.turn);
    expect(restored.year).toBe(original.year);
    expect(restored.quarter).toBe(original.quarter);
    expect(restored.globalSafety).toBe(original.globalSafety);
    expect(restored.gameOver).toBe(original.gameOver);
    expect(restored.winnerId).toBe(original.winnerId);
    expect(restored.log).toEqual(original.log);

    // Verify faction state
    const restoredFaction = restored.factions['us_lab_a'];
    expect(restoredFaction.resources.capital).toBe(95);
    expect(restoredFaction.resources.compute).toBe(80);
    expect(restoredFaction.capabilityScore).toBe(85);
    expect(restoredFaction.safetyScore).toBe(70);
    expect(restoredFaction.research.capabilities).toBe(150);
    expect(restoredFaction.unlockedTechs.has('advanced_tech_1')).toBe(true);
    expect(restoredFaction.unlockedTechs.has('advanced_tech_2')).toBe(true);
    expect(restoredFaction.canDeployAgi).toBe(true);
  });
});
