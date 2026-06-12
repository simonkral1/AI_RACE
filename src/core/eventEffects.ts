/**
 * eventEffects.ts — pure function for applying EventEffect arrays to game state.
 *
 * Extracted from main.ts so it can be imported by unit tests without pulling
 * in the browser UI stack. main.ts delegates to this module.
 */

import type { EventEffect } from '../data/events.js';
import type { GameState } from './types.js';
import { applyResourceDelta, applyScoreDelta, applyStatDelta } from './stats.js';
import { addUnifiedResearch } from './research.js';
import { clamp } from './utils.js';

function getEventTargetFactionIds(
  target: 'faction' | 'all_labs' | 'all_factions' | undefined,
  factionId: string,
  state: GameState,
): string[] {
  if (target === 'faction' || target === undefined) return [factionId];
  if (target === 'all_labs') {
    return Object.values(state.factions)
      .filter((f) => f.type === 'lab')
      .map((f) => f.id);
  }
  return Object.keys(state.factions);
}

/**
 * Apply an array of EventEffect objects to the given game state,
 * on behalf of the faction identified by factionId.
 *
 * This is a pure mutation (no rendering side-effects) and is safe to call
 * in unit tests.
 */
export function applyEventEffects(
  effects: EventEffect[],
  factionId: string,
  state: GameState,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'resource': {
        for (const id of getEventTargetFactionIds(effect.target, factionId, state)) {
          const faction = state.factions[id];
          if (!faction) continue;
          applyResourceDelta(faction, { [effect.key]: effect.delta });
        }
        break;
      }
      case 'score': {
        for (const id of getEventTargetFactionIds(effect.target, factionId, state)) {
          const faction = state.factions[id];
          if (!faction) continue;
          applyScoreDelta(faction, effect.key, effect.delta);
        }
        break;
      }
      case 'stat': {
        for (const id of getEventTargetFactionIds(effect.target, factionId, state)) {
          const faction = state.factions[id];
          if (!faction) continue;
          applyStatDelta(faction, effect.key, effect.delta);
        }
        break;
      }
      case 'research': {
        const faction = state.factions[factionId];
        if (!faction) break;
        addUnifiedResearch(faction, effect.delta);
        break;
      }
      case 'globalSafety': {
        state.globalSafety = clamp(state.globalSafety + effect.delta, 0, 100);
        break;
      }
      case 'exposure': {
        const faction = state.factions[factionId];
        if (!faction) break;
        faction.exposure = clamp(faction.exposure + effect.delta, 0, 100);
        break;
      }
      default:
        break;
    }
  }
}
