import { TECH_TREE } from '../data/techTree.js';
import { FactionState, TechEffect, TechNode } from './types.js';
import { applyResourceDelta, applyScoreDelta, applyStatDelta } from './stats.js';

const byBranch = (branch: TechNode['branch']) => TECH_TREE.filter((node) => node.branch === branch);

const prereqsMet = (faction: FactionState, node: TechNode): boolean =>
  node.prereqs.every((id) => faction.unlockedTechs.has(id));

export const unlockAvailableTechs = (faction: FactionState): string[] => {
  const unlocked: string[] = [];
  const branches: TechNode['branch'][] = ['capabilities', 'safety', 'ops', 'policy'];

  for (const branch of branches) {
    let progress = true;
    while (progress) {
      progress = false;
      const nodes = byBranch(branch).filter(
        (node) => !faction.unlockedTechs.has(node.id) && prereqsMet(faction, node),
      );
      const affordable = nodes.find((node) => faction.research[branch] >= node.cost);
      if (!affordable) continue;
      faction.research[branch] -= affordable.cost;
      faction.unlockedTechs.add(affordable.id);
      applyTechEffects(faction, affordable.effects);
      unlocked.push(affordable.id);
      progress = true;
    }
  }

  return unlocked;
};

export const applyTechEffects = (faction: FactionState, effects: TechEffect[]): void => {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'capability':
        applyScoreDelta(faction, 'capabilityScore', effect.delta);
        break;
      case 'safety':
        applyScoreDelta(faction, 'safetyScore', effect.delta);
        break;
      case 'resource':
        applyResourceDelta(faction, { [effect.key]: effect.delta });
        break;
      case 'stat':
        applyStatDelta(faction, effect.key, effect.delta);
        break;
      case 'unlockAgi':
        faction.canDeployAgi = true;
        break;
      default:
        break;
    }
  }
};
