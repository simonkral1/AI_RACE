import { ACTIONS } from '../data/actions.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { ACTION_POINTS_PER_TURN } from '../core/constants.js';
import { ActionChoice, FactionState, GameState } from '../core/types.js';
import { decideActionsWithLlm, type DecisionContext } from './llmDecision.js';

const getStrategy = (factionId: string) => {
  const template = FACTION_TEMPLATES.find((item) => item.id === factionId);
  if (!template) {
    throw new Error(`Missing strategy for ${factionId}`);
  }
  return template.strategy;
};

/**
 * Minimal fallback when LLM is unavailable - just basic research
 * This ensures the game doesn't break but encourages fixing LLM issues
 */
const minimalFallback = (faction: FactionState): ActionChoice[] => {
  const primary: ActionChoice =
    faction.type === 'government'
      ? { actionId: 'policy', openness: 'open' }
      : { actionId: 'research_capabilities', openness: 'open' };

  return [primary, primary];
};

const ensureActionSlots = (faction: FactionState, choices: ActionChoice[]): ActionChoice[] => {
  const normalized = choices.slice(0, ACTION_POINTS_PER_TURN);
  const fallback: ActionChoice =
    faction.type === 'government'
      ? { actionId: 'policy', openness: 'open' }
      : { actionId: 'research_capabilities', openness: 'open' };

  while (normalized.length < ACTION_POINTS_PER_TURN) {
    normalized.push({ ...fallback });
  }

  return normalized;
};

/**
 * Decide actions for an AI faction using LLM only.
 * The heuristic system has been removed in favor of consistent LLM behavior
 * that matches the narrator/gamemaster personality.
 */
export const decideActions = async (
  state: GameState,
  factionId: string,
  _rng: () => number,
  context?: DecisionContext,
): Promise<ActionChoice[]> => {
  const faction = state.factions[factionId];
  if (!faction) return [];

  // Use LLM for all faction decisions - same model as narrator
  const llmChoices = await decideActionsWithLlm(state, factionId, context);
  if (llmChoices && llmChoices.length > 0) {
    return ensureActionSlots(faction, llmChoices);
  }

  // Minimal fallback only if LLM completely fails
  console.warn(`[decideActions] LLM failed for ${factionId}, using minimal fallback`);
  return minimalFallback(faction);
};

// Re-export for any code that still references the old heuristic
// This is now deprecated and will be removed
export const decideActionsHeuristic = (_state: GameState, factionId: string, _rng: () => number): ActionChoice[] => {
  console.warn(`[deprecated] decideActionsHeuristic called for ${factionId} - this is deprecated`);
  return [
    { actionId: 'research_capabilities', openness: 'open' },
    { actionId: 'research_capabilities', openness: 'open' },
  ];
};
