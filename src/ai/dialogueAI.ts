import type { GameState } from '../core/types.js';
import type { NarrativeDirective } from './narrativeAI.js';
import { FACTION_TEMPLATES } from '../data/factions.js';
import { callLlm } from './llmClient.js';
import { extractJsonSnippet } from './llmParsing.js';

export type DialogueLine = {
  factionId: string;
  speaker: string;
  text: string;
};

const getFactionStrategy = (factionId: string) => {
  const template = FACTION_TEMPLATES.find((item) => item.id === factionId);
  return template?.strategy;
};

const fallbackDialogue = (state: GameState, directives: NarrativeDirective[]): DialogueLine[] => {
  const lines: DialogueLine[] = [];
  for (const directive of directives) {
    const faction = state.factions[directive.factionId];
    if (!faction) continue;
    lines.push({
      factionId: directive.factionId,
      speaker: faction.name,
      text: directive.text,
    });
  }

  if (!lines.length) {
    const factions = Object.values(state.factions).slice(0, 2);
    for (const faction of factions) {
      lines.push({
        factionId: faction.id,
        speaker: faction.name,
        text: 'Maintaining current course while monitoring rivals.',
      });
    }
  }

  return lines;
};

const extractJsonArray = (raw: string): DialogueLine[] | null => {
  const jsonSnippet = extractJsonSnippet(raw, 'array');
  if (!jsonSnippet) return null;
  try {
    const parsed = JSON.parse(jsonSnippet);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((item) => ({
        factionId: String(item.factionId ?? ''),
        speaker: String(item.speaker ?? ''),
        text: String(item.text ?? ''),
      }))
      .filter((item) => item.factionId && item.text);
  } catch {
    return null;
  }
};

export const generateDialogue = async (
  state: GameState,
  directives: NarrativeDirective[],
): Promise<DialogueLine[]> => {
  const payload = {
    instruction:
      'Generate 3-5 short comms lines. JSON array only with {factionId, speaker, text}. No markdown.',
    turn: { year: state.year, quarter: state.quarter, index: state.turn },
    globalSafety: state.globalSafety,
    directives,
    factions: Object.values(state.factions).map((faction) => ({
      id: faction.id,
      name: faction.name,
      type: faction.type,
      strategy: getFactionStrategy(faction.id),
      capabilityScore: faction.capabilityScore,
      safetyScore: faction.safetyScore,
      trust: faction.resources.trust,
    })),
  };

  const content = await callLlm(
    [
      { role: 'system', content: 'You are an in-world comms channel. Output JSON only.' },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    { maxTokens: 220, temperature: 0.7, topP: 0.85 },
  );

  if (!content) return fallbackDialogue(state, directives);
  const parsed = extractJsonArray(content);
  return parsed && parsed.length ? parsed : fallbackDialogue(state, directives);
};
