import { FactionState, GameState } from './types.js';

/**
 * Serializable version of GameState (Sets and Maps converted to arrays)
 */
export interface SerializedGameState {
  turn: number;
  year: number;
  quarter: number;
  factions: Record<string, SerializedFactionState>;
  globalSafety: number;
  gameOver: boolean;
  winnerId?: string;
  log: string[];
  version: number;
  // Faction relationships serialized as arrays
  alliances?: [string, string[]][];
  tensions?: [string, number][];
  treaties?: string[];
  victoryType?: string;
  lossType?: string;
  loserId?: string;
  // Campaign session context (v2+)
  playerFactionId?: string;
  eventHistory?: string[];
}

interface SerializedFactionState extends Omit<FactionState, 'unlockedTechs'> {
  unlockedTechs: string[];
}

/**
 * Increment this integer whenever the schema changes in a breaking way.
 * loadFromLocalStorage will discard saves with a different version and return null.
 */
export const SAVE_VERSION = 2;
const STORAGE_KEY_PREFIX = 'agi_race_save_';

/**
 * Convert GameState to a JSON-safe serializable format.
 * Optionally embed campaign session context (playerFactionId, eventHistory)
 * so a resume can fully restore the session without faction-select.
 */
export const serializeState = (
  state: GameState,
  sessionContext?: { playerFactionId?: string; eventHistory?: string[] },
): SerializedGameState => {
  const serializedFactions: Record<string, SerializedFactionState> = {};

  for (const [id, faction] of Object.entries(state.factions)) {
    serializedFactions[id] = {
      ...faction,
      unlockedTechs: Array.from(faction.unlockedTechs),
    };
  }

  return {
    turn: state.turn,
    year: state.year,
    quarter: state.quarter,
    factions: serializedFactions,
    globalSafety: state.globalSafety,
    gameOver: state.gameOver,
    winnerId: state.winnerId,
    log: state.log.slice(-50), // Keep last 50 log entries
    version: SAVE_VERSION,
    // Serialize Maps as arrays of entries
    alliances: Array.from(state.alliances.entries()),
    tensions: Array.from(state.tensions.entries()),
    treaties: state.treaties,
    victoryType: state.victoryType,
    lossType: state.lossType,
    loserId: state.loserId,
    // Session context
    playerFactionId: sessionContext?.playerFactionId,
    eventHistory: sessionContext?.eventHistory,
  };
};

/**
 * Restore GameState from serialized JSON format.
 * Throws an error if the save version is incompatible — callers should catch
 * and fall back to a fresh campaign.
 */
export const deserializeState = (json: SerializedGameState): GameState => {
  if (json.version !== SAVE_VERSION) {
    throw new Error(`Save version mismatch: expected ${SAVE_VERSION}, got ${json.version}`);
  }

  const factions: Record<string, FactionState> = {};

  for (const [id, serializedFaction] of Object.entries(json.factions)) {
    const legacyResources = serializedFaction.resources as Partial<FactionState['resources']> & {
      talent?: number;
      data?: number;
    };
    const rawResearch = (serializedFaction as { research?: Partial<FactionState['research']> }).research;
    const researchFallback = Math.max(
      rawResearch?.capabilities ?? 0,
      rawResearch?.safety ?? 0,
      rawResearch?.ops ?? 0,
      rawResearch?.policy ?? 0,
      0,
    );
    const migratedResearch: FactionState['research'] = {
      capabilities: rawResearch?.capabilities ?? researchFallback,
      safety: rawResearch?.safety ?? researchFallback,
      ops: rawResearch?.ops ?? researchFallback,
      hardPower: rawResearch?.hardPower ?? researchFallback,
      policy: rawResearch?.policy ?? researchFallback,
    };
    const migratedResources: FactionState['resources'] = {
      compute: legacyResources.compute ?? 0,
      cybersecurity:
        legacyResources.cybersecurity
        ?? legacyResources.talent
        ?? legacyResources.data
        ?? 30,
      capital: legacyResources.capital ?? 0,
      influence: legacyResources.influence ?? 0,
      trust: legacyResources.trust ?? 50,
    };

    factions[id] = {
      ...serializedFaction,
      research: migratedResearch,
      resources: migratedResources,
      hardPower: serializedFaction.hardPower ?? (serializedFaction.type === 'government' ? 70 : 25),
      unlockedTechs: new Set(serializedFaction.unlockedTechs),
    };
  }

  // Restore Maps from serialized data (arrays of key-value pairs)
  const alliances = new Map<string, string[]>();
  if (json.alliances && Array.isArray(json.alliances)) {
    for (const [key, value] of json.alliances) {
      alliances.set(key, value);
    }
  }

  const tensions = new Map<string, number>();
  if (json.tensions && Array.isArray(json.tensions)) {
    for (const [key, value] of json.tensions) {
      tensions.set(key, value);
    }
  }

  return {
    turn: json.turn,
    year: json.year,
    quarter: json.quarter,
    factions,
    globalSafety: json.globalSafety,
    gameOver: json.gameOver,
    winnerId: json.winnerId,
    log: json.log,
    alliances,
    tensions,
    treaties: json.treaties || [],
    victoryType: json.victoryType,
    lossType: json.lossType,
    loserId: json.loserId,
  };
};

/**
 * Get all available save slots
 */
export const getSaveSlots = (): string[] => {
  if (typeof localStorage === 'undefined') return [];

  const slots: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      slots.push(key.replace(STORAGE_KEY_PREFIX, ''));
    }
  }
  return slots.sort();
};

/**
 * Save game state to localStorage with optional session context.
 */
export const saveToLocalStorage = (
  state: GameState,
  slot: string = 'autosave',
  sessionContext?: { playerFactionId?: string; eventHistory?: string[] },
): boolean => {
  if (typeof localStorage === 'undefined') {
    console.warn('localStorage not available');
    return false;
  }

  try {
    const serialized = serializeState(state, sessionContext);
    const key = `${STORAGE_KEY_PREFIX}${slot}`;
    const data = JSON.stringify({
      ...serialized,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, data);
    return true;
  } catch (error) {
    console.error('Failed to save game:', error);
    return false;
  }
};

/**
 * Load game state from localStorage.
 * Returns null if the slot is missing, corrupt, or has an incompatible schema version.
 * A bad/stale save is automatically removed so it cannot block future boots.
 */
export const loadFromLocalStorage = (slot: string = 'autosave'): GameState | null => {
  if (typeof localStorage === 'undefined') {
    console.warn('localStorage not available');
    return null;
  }

  const key = `${STORAGE_KEY_PREFIX}${slot}`;
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data) as SerializedGameState & { savedAt?: string };
    return deserializeState(parsed);
  } catch (error) {
    console.error('Failed to load game — clearing bad save:', error);
    // Remove the bad/incompatible save so the player is never stuck
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

/**
 * Load the full serialized payload from localStorage (including session context
 * fields such as playerFactionId and eventHistory) without full deserialization.
 * Returns null if missing, corrupt, or incompatible version.
 */
export const loadRawAutosave = (slot: string = 'autosave'): (SerializedGameState & { savedAt?: string }) | null => {
  if (typeof localStorage === 'undefined') return null;

  const key = `${STORAGE_KEY_PREFIX}${slot}`;
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    const parsed = JSON.parse(data) as SerializedGameState & { savedAt?: string };
    if (parsed.version !== SAVE_VERSION) {
      // Version mismatch — clear so boot is not blocked
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

/**
 * Delete a save slot
 */
export const deleteSaveSlot = (slot: string): boolean => {
  if (typeof localStorage === 'undefined') return false;

  try {
    const key = `${STORAGE_KEY_PREFIX}${slot}`;
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to delete save:', error);
    return false;
  }
};

/**
 * Check if a save slot exists
 */
export const hasSaveSlot = (slot: string = 'autosave'): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${slot}`) !== null;
};

/**
 * Get save metadata without loading full state
 */
export const getSaveMetadata = (slot: string): { savedAt: string; turn: number; year: number; quarter: number; playerFactionId?: string } | null => {
  if (typeof localStorage === 'undefined') return null;

  try {
    const key = `${STORAGE_KEY_PREFIX}${slot}`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return {
      savedAt: parsed.savedAt || 'Unknown',
      turn: parsed.turn,
      year: parsed.year,
      quarter: parsed.quarter,
      playerFactionId: parsed.playerFactionId,
    };
  } catch {
    return null;
  }
};

/**
 * Export game state as a downloadable JSON file
 */
export const exportToFile = (state: GameState, filename: string = 'agi_race_save.json'): void => {
  const serialized = serializeState(state);
  const data = JSON.stringify(serialized, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import game state from a JSON file
 */
export const importFromFile = (): Promise<GameState | null> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as SerializedGameState;
        const state = deserializeState(parsed);
        resolve(state);
      } catch (error) {
        console.error('Failed to import save:', error);
        resolve(null);
      }
    };

    input.click();
  });
};
