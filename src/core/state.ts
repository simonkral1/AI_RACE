import { FACTION_TEMPLATES } from '../data/factions.js';
import { TURN_START_QUARTER, TURN_START_YEAR } from './constants.js';
import { FactionState, GameState } from './types.js';
import { computeGlobalSafety } from './stats.js';

export const createInitialState = (): GameState => {
  const factions: Record<string, FactionState> = {};

  for (const template of FACTION_TEMPLATES) {
    factions[template.id] = {
      id: template.id,
      name: template.name,
      type: template.type,
      resources: { ...template.resources },
      safetyCulture: template.safetyCulture,
      opsec: template.opsec,
      capabilityScore: template.capabilityScore,
      safetyScore: template.safetyScore,
      exposure: 0,
      unlockedTechs: new Set<string>(),
      research: {
        capabilities: 0,
        safety: 0,
        ops: 0,
        policy: 0,
      },
      canDeployAgi: false,
      // New expanded resources - use template values or defaults
      publicOpinion: template.publicOpinion ?? (template.type === 'government' ? 50 : template.resources.trust),
      securityLevel: template.securityLevel ?? (template.type === 'government' ? 3 : 2),
    };
  }

  const state: GameState = {
    turn: 0,
    year: TURN_START_YEAR,
    quarter: TURN_START_QUARTER,
    factions,
    globalSafety: 0,
    gameOver: false,
    log: [],
    // New faction relationship systems
    alliances: new Map<string, string[]>(),
    tensions: new Map<string, number>(),
    treaties: [],
  };

  state.globalSafety = computeGlobalSafety(state);
  return state;
};
