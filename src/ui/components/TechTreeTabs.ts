// Tech Tree Tabs - Tab navigation for branch selection
import { el, div, BRANCH_COLORS } from './base.js';
import { BranchId } from '../../core/types.js';

export interface TabInfo {
  id: BranchId | 'all';
  name: string;
  icon: string;
  color: string;
  description: string;
}

export const BRANCH_TABS: TabInfo[] = [
  {
    id: 'capabilities',
    name: 'Capabilities',
    icon: '\u26A1', // Lightning bolt
    color: '#b84c42',
    description: 'Core AI advancement technologies',
  },
  {
    id: 'safety',
    name: 'Safety',
    icon: '\uD83D\uDEE1\uFE0F', // Shield
    color: '#3d7a3a',
    description: 'Alignment and oversight systems',
  },
  {
    id: 'ops',
    name: 'Operations',
    icon: '\u2699\uFE0F', // Gear
    color: '#4a6eb8',
    description: 'Infrastructure and scaling',
  },
  {
    id: 'policy',
    name: 'Policy',
    icon: '\uD83D\uDCDC', // Scroll
    color: '#8a5cb8',
    description: 'Governance and coordination',
  },
];

export interface TechTreeTabsOptions {
  activeBranch: BranchId | null;
  branchProgress: Record<BranchId, { unlocked: number; total: number }>;
  onTabChange: (branch: BranchId) => void;
}

export function renderTechTreeTabs(options: TechTreeTabsOptions): HTMLElement {
  const { activeBranch, branchProgress, onTabChange } = options;

  const container = div({ className: 'tech-tabs' });

  for (const tab of BRANCH_TABS) {
    const branchId = tab.id as BranchId;
    const progress = branchProgress[branchId] || { unlocked: 0, total: 0 };
    const progressPercent = progress.total > 0
      ? Math.round((progress.unlocked / progress.total) * 100)
      : 0;
    const isActive = activeBranch === branchId;

    const tabEl = div({
      className: `tech-tabs__tab ${isActive ? 'tech-tabs__tab--active' : ''}`,
      dataset: { branch: branchId },
      onClick: () => onTabChange(branchId),
    });

    // Set the branch color as CSS variable
    tabEl.style.setProperty('--tab-color', tab.color);

    // Tab icon
    const iconEl = div({
      className: 'tech-tabs__icon',
      text: tab.icon,
    });

    // Tab content
    const contentEl = div({ className: 'tech-tabs__content' });

    // Tab name
    const nameEl = div({
      className: 'tech-tabs__name',
      text: tab.name,
    });

    // Progress indicator
    const progressEl = div({ className: 'tech-tabs__progress' });

    const progressBar = div({ className: 'tech-tabs__progress-bar' });
    const progressFill = div({ className: 'tech-tabs__progress-fill' });
    progressFill.style.width = `${progressPercent}%`;
    progressBar.appendChild(progressFill);

    const progressText = el('span', {
      className: 'tech-tabs__progress-text',
      text: `${progress.unlocked}/${progress.total}`,
    });

    progressEl.appendChild(progressBar);
    progressEl.appendChild(progressText);

    contentEl.appendChild(nameEl);
    contentEl.appendChild(progressEl);

    tabEl.appendChild(iconEl);
    tabEl.appendChild(contentEl);

    // Active indicator
    if (isActive) {
      const indicator = div({ className: 'tech-tabs__indicator' });
      tabEl.appendChild(indicator);
    }

    container.appendChild(tabEl);
  }

  return container;
}

// Get tab info by branch ID
export function getTabInfo(branchId: BranchId): TabInfo | undefined {
  return BRANCH_TABS.find(tab => tab.id === branchId);
}
