import { FactionState, TechNode } from './types.js';

const GOV_PREFIX = 'gov_';

export const isTechAvailableForFaction = (tech: TechNode, faction: FactionState): boolean => {
  if (tech.allowedFor && tech.allowedFor.length > 0) {
    return tech.allowedFor.includes(faction.type);
  }

  // Default split: non-prefixed techs are lab-focused; gov-prefixed are country-focused.
  if (faction.type === 'government') {
    return tech.id.startsWith(GOV_PREFIX);
  }
  return !tech.id.startsWith(GOV_PREFIX);
};

export const getTechsForFaction = (techs: TechNode[], faction: FactionState): TechNode[] =>
  techs.filter((tech) => isTechAvailableForFaction(tech, faction));

