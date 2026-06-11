// Simple Vertical Tech Tree - Clean, functional tech selection
import { TechNode, FactionState, BranchId } from '../core/types.js';
import { getUnifiedResearchPool } from '../core/research.js';
import { isTechAvailableForFaction } from '../core/techAccess.js';
import { TECH_TREE } from '../data/techTree.js';

export interface SimpleTechCallbacks {
  onResearch: (techId: string) => void;
}

const BRANCH_INFO: Record<BranchId, { name: string; color: string; icon: string }> = {
  capabilities: { name: 'Capabilities', color: '#b84c42', icon: '⚡' },
  safety: { name: 'Safety', color: '#3d7a3a', icon: '🛡️' },
  ops: { name: 'Operations', color: '#4a6eb8', icon: '⚙️' },
  hardPower: { name: 'Hard Power', color: '#b0642d', icon: '⚔️' },
  policy: { name: 'Policy', color: '#8a5cb8', icon: '📜' },
};

function prereqsMet(tech: TechNode, faction: FactionState): boolean {
  return tech.prereqs.every(prereq => faction.unlockedTechs.has(prereq));
}

function canResearch(tech: TechNode, faction: FactionState): boolean {
  if (faction.unlockedTechs.has(tech.id)) return false;
  return prereqsMet(tech, faction) && getUnifiedResearchPool(faction) >= tech.cost;
}

function getTechCost(tech: TechNode): number {
  return tech.cost;
}

export function renderSimpleTechTree(
  container: HTMLElement,
  faction: FactionState,
  callbacks: SimpleTechCallbacks
): void {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'simple-tech';

  // Group techs by branch
  const branches = new Map<BranchId, TechNode[]>();
  for (const branch of Object.keys(BRANCH_INFO) as BranchId[]) {
    branches.set(branch, []);
  }

  for (const tech of TECH_TREE) {
    if (!isTechAvailableForFaction(tech, faction)) continue;
    branches.get(tech.branch)?.push(tech);
  }

  // Render each branch as a vertical column
  for (const [branch, techs] of branches) {
    if (techs.length === 0) continue;
    const info = BRANCH_INFO[branch];
    const researchPool = getUnifiedResearchPool(faction);

    const branchEl = document.createElement('div');
    branchEl.className = 'simple-tech__branch';
    branchEl.style.setProperty('--branch-color', info.color);

    // Branch header
    const header = document.createElement('div');
    header.className = 'simple-tech__header';
    header.innerHTML = `
      <span class="simple-tech__icon">${info.icon}</span>
      <span class="simple-tech__name">${info.name}</span>
      <span class="simple-tech__progress">${Math.floor(researchPool)} RP</span>
    `;
    branchEl.appendChild(header);

    // Tech nodes
    const nodesEl = document.createElement('div');
    nodesEl.className = 'simple-tech__nodes';

    // Sort by prereq depth
    const sorted = [...techs].sort((a, b) => a.prereqs.length - b.prereqs.length);

    for (const tech of sorted) {
      const isUnlocked = faction.unlockedTechs.has(tech.id);
      const isPrereqReady = prereqsMet(tech, faction);
      const canUnlock = canResearch(tech, faction);
      const cost = getTechCost(tech);

      const nodeEl = document.createElement('div');
      nodeEl.className = 'simple-tech__node';
      if (isUnlocked) nodeEl.classList.add('simple-tech__node--unlocked');
      else if (isPrereqReady) nodeEl.classList.add('simple-tech__node--available');
      else nodeEl.classList.add('simple-tech__node--locked');

      // Effect summary
      let effectText = '';
      for (const effect of tech.effects) {
        if (effect.kind === 'capability') effectText = `+${effect.delta} Cap`;
        else if (effect.kind === 'safety') effectText = `+${effect.delta} Safety`;
        else if (effect.kind === 'resource') effectText = `+${effect.delta} ${effect.key}`;
        else if (effect.kind === 'unlockAgi') effectText = '🎯 Unlock AGI';
      }

      nodeEl.innerHTML = `
        <div class="simple-tech__node-name">${tech.name}</div>
        <div class="simple-tech__node-effect">${effectText}</div>
        ${isUnlocked ? '<div class="simple-tech__node-status">✓</div>' :
          isPrereqReady ? `<button class="simple-tech__node-btn" data-tech="${tech.id}" ${canUnlock ? '' : 'disabled'}>${canUnlock ? `Research (${cost})` : `Need ${cost} RP`}</button>` :
          '<div class="simple-tech__node-status">🔒</div>'}
      `;

      nodesEl.appendChild(nodeEl);
    }

    branchEl.appendChild(nodesEl);
    wrapper.appendChild(branchEl);
  }

  container.appendChild(wrapper);

  // Bind click handlers
  container.querySelectorAll<HTMLButtonElement>('.simple-tech__node-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const techId = btn.dataset.tech;
      if (techId) callbacks.onResearch(techId);
    });
  });
}
