// Branch Screen - Full-screen view for a single tech branch
import { el, div, button, ICONS, BRANCH_COLORS } from './base.js';
import { TechNode, FactionState, BranchId } from '../../core/types.js';
import { TECH_TREE } from '../../data/techTree.js';
import { getTabInfo, BRANCH_TABS } from './TechTreeTabs.js';

export interface BranchScreenCallbacks {
  onResearch: (techId: string) => void;
  onTechSelect: (techId: string | null) => void;
  onBack?: () => void;
}

export interface BranchScreenState {
  selectedTechId: string | null;
  hoveredTechId: string | null;
}

// Get tech status for a node
function getTechStatus(
  tech: TechNode,
  faction: FactionState
): 'unlocked' | 'available' | 'locked' {
  if (faction.unlockedTechs.has(tech.id)) {
    return 'unlocked';
  }
  const prereqsMet = tech.prereqs.every(prereq => faction.unlockedTechs.has(prereq));
  return prereqsMet ? 'available' : 'locked';
}

// Get prerequisite tech names for display
function getPrereqNames(tech: TechNode): string[] {
  return tech.prereqs.map(prereqId => {
    const prereqTech = TECH_TREE.find(t => t.id === prereqId);
    return prereqTech?.name || prereqId;
  });
}

// Calculate effective cost based on research progress
function getTechCost(tech: TechNode, faction: FactionState): number {
  const progress = faction.research[tech.branch] || 0;
  return Math.max(0, tech.cost - Math.floor(progress));
}

// Format effect for display
function formatEffect(effect: TechNode['effects'][0]): string {
  switch (effect.kind) {
    case 'capability':
      return `+${effect.delta} Capability`;
    case 'safety':
      return `+${effect.delta} Safety`;
    case 'resource':
      return `+${effect.delta} ${effect.key.charAt(0).toUpperCase() + effect.key.slice(1)}`;
    case 'stat':
      return `+${effect.delta} ${effect.key}`;
    case 'unlockAgi':
      return 'Unlocks AGI Deployment';
    default:
      return '';
  }
}

// Calculate depth of a tech node in the tree
function getTechDepth(techId: string, techMap: Map<string, TechNode>): number {
  const tech = techMap.get(techId);
  if (!tech || tech.prereqs.length === 0) return 0;
  return 1 + Math.max(...tech.prereqs.map(prereq => getTechDepth(prereq, techMap)));
}

// Render a single tech node
function renderTechNode(
  tech: TechNode,
  faction: FactionState,
  state: BranchScreenState,
  callbacks: BranchScreenCallbacks
): HTMLElement {
  const status = getTechStatus(tech, faction);
  const cost = getTechCost(tech, faction);
  const branchProgress = faction.research[tech.branch] || 0;
  const canAfford = branchProgress >= cost;
  const isSelected = state.selectedTechId === tech.id;
  const isHovered = state.hoveredTechId === tech.id;

  const node = div({
    className: `branch-node branch-node--${status} ${isSelected ? 'branch-node--selected' : ''} ${isHovered ? 'branch-node--hovered' : ''}`,
    dataset: { techId: tech.id },
  });

  // Status icon
  const statusIcon = div({ className: 'branch-node__status' });
  if (status === 'unlocked') {
    statusIcon.innerHTML = `<span class="branch-node__check">\u2713</span>`;
  } else if (status === 'available') {
    statusIcon.innerHTML = `<span class="branch-node__dot"></span>`;
  } else {
    statusIcon.innerHTML = `<span class="branch-node__lock">\uD83D\uDD12</span>`;
  }

  // Node content
  const content = div({ className: 'branch-node__content' });

  // Title row
  const titleRow = div({ className: 'branch-node__title-row' });
  const title = el('h4', {
    className: 'branch-node__title',
    text: tech.name,
  });
  titleRow.appendChild(title);

  // Effects list
  const effectsList = div({ className: 'branch-node__effects' });
  for (const effect of tech.effects) {
    const effectEl = el('span', {
      className: `branch-node__effect branch-node__effect--${effect.kind}`,
      text: formatEffect(effect),
    });
    effectsList.appendChild(effectEl);
  }

  content.appendChild(titleRow);
  content.appendChild(effectsList);

  // Action area
  const actionArea = div({ className: 'branch-node__action' });

  if (status === 'unlocked') {
    const badge = el('span', {
      className: 'branch-node__badge branch-node__badge--unlocked',
      text: 'Researched',
    });
    actionArea.appendChild(badge);
  } else if (status === 'available') {
    const costLabel = el('span', {
      className: 'branch-node__cost',
      text: `${cost} RP`,
    });

    const researchBtn = button({
      className: `branch-node__btn ${canAfford ? 'branch-node__btn--ready' : 'branch-node__btn--locked'}`,
      text: canAfford ? 'Research' : 'Need RP',
      onClick: (e) => {
        e.stopPropagation();
        if (canAfford) {
          callbacks.onResearch(tech.id);
        }
      },
    });

    actionArea.appendChild(costLabel);
    actionArea.appendChild(researchBtn);
  } else {
    const prereqNames = getPrereqNames(tech);
    const prereqLabel = el('span', {
      className: 'branch-node__prereqs',
      text: `Requires: ${prereqNames.join(', ')}`,
    });
    actionArea.appendChild(prereqLabel);
  }

  node.appendChild(statusIcon);
  node.appendChild(content);
  node.appendChild(actionArea);

  // Click handler for selection
  node.addEventListener('click', () => {
    callbacks.onTechSelect(isSelected ? null : tech.id);
  });

  return node;
}

// Render connection lines between nodes
function renderConnections(
  techs: TechNode[],
  techMap: Map<string, TechNode>,
  faction: FactionState
): HTMLElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'branch-connections');

  // We'll draw connections after the nodes are positioned
  // This returns an empty SVG that will be populated later
  return svg as unknown as HTMLElement;
}

// Render the detail panel for a selected tech
function renderTechDetail(
  tech: TechNode | null,
  faction: FactionState,
  callbacks: BranchScreenCallbacks
): HTMLElement {
  const panel = div({ className: 'branch-detail' });

  if (!tech) {
    panel.innerHTML = `
      <div class="branch-detail__empty">
        <div class="branch-detail__empty-icon">\uD83D\uDD2C</div>
        <p>Select a technology to view details</p>
      </div>
    `;
    return panel;
  }

  const status = getTechStatus(tech, faction);
  const cost = getTechCost(tech, faction);
  const branchProgress = faction.research[tech.branch] || 0;
  const canAfford = branchProgress >= cost;
  const tabInfo = getTabInfo(tech.branch);

  // Header
  const header = div({ className: 'branch-detail__header' });
  header.style.setProperty('--branch-color', tabInfo?.color || '#666');

  const headerIcon = el('span', {
    className: 'branch-detail__icon',
    text: tabInfo?.icon || '',
  });

  const headerTitle = el('h3', {
    className: 'branch-detail__title',
    text: tech.name,
  });

  const statusBadge = el('span', {
    className: `branch-detail__status branch-detail__status--${status}`,
    text: status === 'unlocked' ? 'Researched' : status === 'available' ? 'Available' : 'Locked',
  });

  header.appendChild(headerIcon);
  header.appendChild(headerTitle);
  header.appendChild(statusBadge);

  // Description section
  const descSection = div({ className: 'branch-detail__section' });
  const descLabel = el('h4', { className: 'branch-detail__label', text: 'Branch' });
  const descText = el('p', {
    className: 'branch-detail__text',
    text: tabInfo?.description || '',
  });
  descSection.appendChild(descLabel);
  descSection.appendChild(descText);

  // Effects section
  const effectsSection = div({ className: 'branch-detail__section' });
  const effectsLabel = el('h4', { className: 'branch-detail__label', text: 'Effects' });
  const effectsList = el('ul', { className: 'branch-detail__effects-list' });

  for (const effect of tech.effects) {
    const effectItem = el('li', {
      className: `branch-detail__effect branch-detail__effect--${effect.kind}`,
      text: formatEffect(effect),
    });
    effectsList.appendChild(effectItem);
  }

  effectsSection.appendChild(effectsLabel);
  effectsSection.appendChild(effectsList);

  // Prerequisites section
  const prereqSection = div({ className: 'branch-detail__section' });
  const prereqLabel = el('h4', { className: 'branch-detail__label', text: 'Prerequisites' });
  const prereqContent = div({ className: 'branch-detail__prereqs' });

  if (tech.prereqs.length === 0) {
    prereqContent.innerHTML = '<span class="branch-detail__none">None (Starting tech)</span>';
  } else {
    for (const prereqId of tech.prereqs) {
      const prereqTech = TECH_TREE.find(t => t.id === prereqId);
      const prereqStatus = prereqTech ? getTechStatus(prereqTech, faction) : 'locked';
      const prereqEl = el('span', {
        className: `branch-detail__prereq branch-detail__prereq--${prereqStatus}`,
        text: `${prereqStatus === 'unlocked' ? '\u2713 ' : '\u2022 '}${prereqTech?.name || prereqId}`,
      });
      prereqContent.appendChild(prereqEl);
    }
  }

  prereqSection.appendChild(prereqLabel);
  prereqSection.appendChild(prereqContent);

  // Cost section
  const costSection = div({ className: 'branch-detail__section' });
  const costLabel = el('h4', { className: 'branch-detail__label', text: 'Research Cost' });
  const costContent = div({ className: 'branch-detail__cost-info' });

  if (status === 'unlocked') {
    costContent.innerHTML = '<span class="branch-detail__completed">Already researched</span>';
  } else {
    const requiredRP = cost;
    const currentRP = branchProgress;
    const progressPercent = Math.min(100, Math.round((currentRP / requiredRP) * 100));

    costContent.innerHTML = `
      <div class="branch-detail__cost-row">
        <span>Required:</span>
        <span class="branch-detail__cost-value">${requiredRP} RP</span>
      </div>
      <div class="branch-detail__cost-row">
        <span>Current:</span>
        <span class="branch-detail__cost-value">${currentRP} RP</span>
      </div>
      <div class="branch-detail__progress-bar">
        <div class="branch-detail__progress-fill" style="width: ${progressPercent}%"></div>
      </div>
    `;
  }

  costSection.appendChild(costLabel);
  costSection.appendChild(costContent);

  // Action button
  const actionSection = div({ className: 'branch-detail__actions' });

  if (status === 'available' && canAfford) {
    const researchBtn = button({
      className: 'branch-detail__btn branch-detail__btn--research',
      text: 'Research Now',
      onClick: () => callbacks.onResearch(tech.id),
    });
    actionSection.appendChild(researchBtn);
  } else if (status === 'available') {
    const infoText = el('p', {
      className: 'branch-detail__info',
      text: 'Accumulate more research points to unlock this technology.',
    });
    actionSection.appendChild(infoText);
  } else if (status === 'locked') {
    const infoText = el('p', {
      className: 'branch-detail__info',
      text: 'Complete the prerequisites to make this technology available.',
    });
    actionSection.appendChild(infoText);
  }

  panel.appendChild(header);
  panel.appendChild(descSection);
  panel.appendChild(effectsSection);
  panel.appendChild(prereqSection);
  panel.appendChild(costSection);
  panel.appendChild(actionSection);

  return panel;
}

// Main branch screen renderer
export function renderBranchScreen(
  branch: BranchId,
  faction: FactionState,
  state: BranchScreenState,
  callbacks: BranchScreenCallbacks
): HTMLElement {
  const container = div({ className: 'branch-screen' });
  const tabInfo = getTabInfo(branch);

  // Set branch color
  container.style.setProperty('--branch-color', tabInfo?.color || '#666');

  // Get techs for this branch
  const branchTechs = TECH_TREE.filter(t => t.branch === branch);
  const techMap = new Map(TECH_TREE.map(t => [t.id, t]));

  // Sort by depth (prereq chain length)
  const sortedTechs = [...branchTechs].sort((a, b) => {
    return getTechDepth(a.id, techMap) - getTechDepth(b.id, techMap);
  });

  // Calculate branch stats
  const unlockedCount = branchTechs.filter(t => faction.unlockedTechs.has(t.id)).length;
  const branchProgress = faction.research[branch] || 0;

  // Branch header
  const header = div({ className: 'branch-screen__header' });

  const headerLeft = div({ className: 'branch-screen__header-left' });
  const headerIcon = el('span', {
    className: 'branch-screen__icon',
    text: tabInfo?.icon || '',
  });
  const headerTitle = el('h2', {
    className: 'branch-screen__title',
    text: tabInfo?.name || branch,
  });
  const headerDesc = el('p', {
    className: 'branch-screen__desc',
    text: tabInfo?.description || '',
  });
  headerLeft.appendChild(headerIcon);
  headerLeft.appendChild(headerTitle);
  headerLeft.appendChild(headerDesc);

  const headerRight = div({ className: 'branch-screen__header-right' });
  const progressStat = div({ className: 'branch-screen__stat' });
  progressStat.innerHTML = `
    <span class="branch-screen__stat-label">Progress</span>
    <span class="branch-screen__stat-value">${unlockedCount}/${branchTechs.length}</span>
  `;
  const rpStat = div({ className: 'branch-screen__stat' });
  rpStat.innerHTML = `
    <span class="branch-screen__stat-label">Research Points</span>
    <span class="branch-screen__stat-value">${Math.floor(branchProgress)} RP</span>
  `;
  headerRight.appendChild(progressStat);
  headerRight.appendChild(rpStat);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Main content area
  const content = div({ className: 'branch-screen__content' });

  // Tree view (left)
  const treeView = div({ className: 'branch-screen__tree' });

  // Group techs by depth level
  const techsByDepth: Map<number, TechNode[]> = new Map();
  for (const tech of sortedTechs) {
    const depth = getTechDepth(tech.id, techMap);
    if (!techsByDepth.has(depth)) {
      techsByDepth.set(depth, []);
    }
    techsByDepth.get(depth)?.push(tech);
  }

  // Render each level
  const depths = Array.from(techsByDepth.keys()).sort((a, b) => a - b);
  for (const depth of depths) {
    const levelTechs = techsByDepth.get(depth) || [];
    const levelEl = div({
      className: 'branch-screen__level',
      dataset: { depth: String(depth) },
    });

    // Level label
    const levelLabel = div({
      className: 'branch-screen__level-label',
      text: depth === 0 ? 'Foundation' : `Tier ${depth}`,
    });
    levelEl.appendChild(levelLabel);

    // Nodes in this level
    const nodesContainer = div({ className: 'branch-screen__nodes' });
    for (const tech of levelTechs) {
      const nodeEl = renderTechNode(tech, faction, state, callbacks);
      nodesContainer.appendChild(nodeEl);
    }
    levelEl.appendChild(nodesContainer);

    // Connection line to next level (if not last)
    if (depth < Math.max(...depths)) {
      const connector = div({ className: 'branch-screen__connector' });
      levelEl.appendChild(connector);
    }

    treeView.appendChild(levelEl);
  }

  // Detail panel (right)
  const selectedTech = state.selectedTechId
    ? TECH_TREE.find(t => t.id === state.selectedTechId) || null
    : null;
  const detailPanel = renderTechDetail(selectedTech, faction, callbacks);

  content.appendChild(treeView);
  content.appendChild(detailPanel);

  container.appendChild(header);
  container.appendChild(content);

  return container;
}

// Get branch progress data
export function getBranchProgress(
  faction: FactionState
): Record<BranchId, { unlocked: number; total: number }> {
  const result: Record<BranchId, { unlocked: number; total: number }> = {
    capabilities: { unlocked: 0, total: 0 },
    safety: { unlocked: 0, total: 0 },
    ops: { unlocked: 0, total: 0 },
    policy: { unlocked: 0, total: 0 },
  };

  for (const tech of TECH_TREE) {
    result[tech.branch].total++;
    if (faction.unlockedTechs.has(tech.id)) {
      result[tech.branch].unlocked++;
    }
  }

  return result;
}
