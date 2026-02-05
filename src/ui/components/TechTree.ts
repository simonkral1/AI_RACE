// TechTree component - Main horizontal tech tree container
import type { TechNode as TechNodeType, FactionState, BranchId } from '../../core/types.js';
import { el, div, span, BRANCH_COLORS } from './base.js';
import {
  createTechNode,
  createTechNodeDetail,
  createTechNodeEmptyDetail,
  getTechNodeStatus,
  TechNodeStatus,
  TechNodeCallbacks,
} from './TechNode.js';
import {
  createTechConnectors,
  resizeTechConnectors,
} from './TechConnectors.js';

// Branch metadata for display
const BRANCH_META: Record<BranchId, { title: string; subtitle: string }> = {
  capabilities: { title: 'CAPABILITIES', subtitle: 'Research & Development' },
  safety: { title: 'SAFETY', subtitle: 'Alignment & Robustness' },
  ops: { title: 'OPERATIONS', subtitle: 'Infrastructure & Scale' },
  policy: { title: 'POLICY', subtitle: 'Governance & Diplomacy' },
};

// Branch order for display
const BRANCH_ORDER: BranchId[] = ['capabilities', 'safety', 'ops', 'policy'];

export interface TechTreeCallbacks extends TechNodeCallbacks {
  onBranchFilter?: (branch: BranchId | null) => void;
}

export interface TechTreeState {
  selectedNodeId: string | null;
  filteredBranch: BranchId | null;
  searchQuery: string;
}

// Calculate depth of a node in the tech tree (based on prereq chain)
function calculateNodeDepth(
  node: TechNodeType,
  allNodes: TechNodeType[],
  depthCache: Map<string, number> = new Map()
): number {
  if (depthCache.has(node.id)) {
    return depthCache.get(node.id)!;
  }

  if (node.prereqs.length === 0) {
    depthCache.set(node.id, 0);
    return 0;
  }

  const maxPrereqDepth = Math.max(
    ...node.prereqs.map((prereqId) => {
      const prereqNode = allNodes.find((n) => n.id === prereqId);
      if (!prereqNode) return 0;
      return calculateNodeDepth(prereqNode, allNodes, depthCache);
    })
  );

  const depth = maxPrereqDepth + 1;
  depthCache.set(node.id, depth);
  return depth;
}

// Group nodes by branch and sort by depth
function organizeNodes(
  nodes: TechNodeType[]
): Map<BranchId, TechNodeType[]> {
  const depthCache = new Map<string, number>();
  const branchMap = new Map<BranchId, TechNodeType[]>();

  // Initialize branches
  BRANCH_ORDER.forEach((branch) => {
    branchMap.set(branch, []);
  });

  // Group by branch
  nodes.forEach((node) => {
    const branchNodes = branchMap.get(node.branch);
    if (branchNodes) {
      branchNodes.push(node);
    }
  });

  // Sort each branch by depth
  branchMap.forEach((branchNodes, branch) => {
    branchNodes.sort((a, b) => {
      const depthA = calculateNodeDepth(a, nodes, depthCache);
      const depthB = calculateNodeDepth(b, nodes, depthCache);
      return depthA - depthB;
    });
  });

  return branchMap;
}

// Create a branch row with label and lane of nodes
function createBranchRow(
  branch: BranchId,
  nodes: TechNodeType[],
  faction: FactionState,
  state: TechTreeState,
  callbacks: TechTreeCallbacks
): HTMLElement {
  const meta = BRANCH_META[branch];
  const branchColor = BRANCH_COLORS[branch];

  // Determine if this branch is filtered out
  const isFiltered = state.filteredBranch !== null && state.filteredBranch !== branch;

  const rowEl = div({
    className: `tech-branch-row ${isFiltered ? 'is-dimmed' : ''}`,
    dataset: { branch },
    children: [
      // Branch meta (label on left)
      div({
        className: 'tech-branch-meta',
        children: [
          div({
            className: 'tech-branch-title',
            text: meta.title,
          }),
          div({
            className: 'tech-branch-subtitle',
            text: meta.subtitle,
          }),
        ],
      }),
      // Node lane
      createNodeLane(branch, nodes, faction, state, callbacks),
    ],
  });

  // Apply branch color accent
  rowEl.style.setProperty('--branch-color', branchColor.primary);

  return rowEl;
}

// Create the horizontal lane of nodes for a branch
function createNodeLane(
  branch: BranchId,
  nodes: TechNodeType[],
  faction: FactionState,
  state: TechTreeState,
  callbacks: TechTreeCallbacks
): HTMLElement {
  const laneEl = div({
    className: 'tech-lane',
    dataset: { branch },
    attrs: {
      style: `--cols: ${nodes.length}`,
    },
  });

  nodes.forEach((node) => {
    const status = getTechNodeStatus(node, faction);
    const isSelected = state.selectedNodeId === node.id;

    // Check if node matches search query
    const matchesSearch =
      !state.searchQuery ||
      node.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      node.id.toLowerCase().includes(state.searchQuery.toLowerCase());

    const nodeEl = createTechNode(node, status, callbacks, isSelected);

    // Apply search filtering
    if (!matchesSearch) {
      nodeEl.classList.add('is-filtered');
    }

    laneEl.appendChild(nodeEl);
  });

  return laneEl;
}

// Create the main tech tree board (all branch rows)
function createTechBoard(
  nodes: TechNodeType[],
  faction: FactionState,
  state: TechTreeState,
  callbacks: TechTreeCallbacks
): HTMLElement {
  const organizedNodes = organizeNodes(nodes);

  const boardEl = div({
    className: 'tech-screen__board',
  });

  BRANCH_ORDER.forEach((branch) => {
    const branchNodes = organizedNodes.get(branch) || [];
    const rowEl = createBranchRow(branch, branchNodes, faction, state, callbacks);
    boardEl.appendChild(rowEl);
  });

  return boardEl;
}

// Create branch filter tabs
function createBranchTabs(
  activeBranch: BranchId | null,
  onFilter: (branch: BranchId | null) => void
): HTMLElement {
  const tabsEl = div({
    className: 'tech-screen__tabs',
  });

  // "All" tab
  const allTab = el('button', {
    className: `tech-tab ${activeBranch === null ? 'is-active' : ''}`,
    text: 'All',
    onClick: () => onFilter(null),
  });
  tabsEl.appendChild(allTab);

  // Branch tabs
  BRANCH_ORDER.forEach((branch) => {
    const meta = BRANCH_META[branch];
    const isActive = activeBranch === branch;
    const branchColor = BRANCH_COLORS[branch];

    const tab = el('button', {
      className: `tech-tab ${isActive ? 'is-active' : ''}`,
      text: meta.title,
      onClick: () => onFilter(branch),
    });

    if (isActive) {
      tab.style.borderColor = branchColor.primary;
      tab.style.background = branchColor.glow;
    }

    tabsEl.appendChild(tab);
  });

  return tabsEl;
}

// Create search input
function createSearchInput(
  currentQuery: string,
  onSearch: (query: string) => void
): HTMLInputElement {
  const input = el('input', {
    className: 'tech-screen__search',
    attrs: {
      type: 'text',
      placeholder: 'Search technologies...',
      value: currentQuery,
    },
  });

  input.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    onSearch(target.value);
  });

  return input;
}

// Create legend for node statuses
function createLegend(): HTMLElement {
  return div({
    className: 'tech-screen__legend',
    children: [
      span({ className: 'legend legend--unlocked', text: 'Unlocked' }),
      span({ className: 'legend legend--available', text: 'Available' }),
      span({ className: 'legend legend--locked', text: 'Locked' }),
    ],
  });
}

// Create branch research progress cards
function createProgressCards(
  faction: FactionState,
  nodes: TechNodeType[]
): HTMLElement {
  const progressEl = div({
    className: 'tech-screen__progress',
  });

  BRANCH_ORDER.forEach((branch) => {
    const branchNodes = nodes.filter((n) => n.branch === branch);
    const unlockedCount = branchNodes.filter((n) =>
      faction.unlockedTechs.has(n.id)
    ).length;
    const totalCount = branchNodes.length;
    const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;
    const branchProgress = faction.research[branch] || 0;

    const meta = BRANCH_META[branch];
    const branchColor = BRANCH_COLORS[branch];

    const card = div({
      className: 'tech-progress-card',
      children: [
        div({
          className: 'tech-progress-card__label',
          text: meta.title,
        }),
        div({
          className: 'tech-progress-card__bar',
          children: [
            div({
              className: 'tech-progress-card__fill',
              attrs: {
                style: `width: ${progressPercent}%; background: linear-gradient(90deg, ${branchColor.primary}, ${branchColor.glow})`,
              },
            }),
          ],
        }),
        div({
          className: 'tech-progress-card__meta',
          html: `<strong>${unlockedCount}/${totalCount}</strong> techs | <strong>${branchProgress}</strong> RP`,
        }),
      ],
    });

    progressEl.appendChild(card);
  });

  return progressEl;
}

// Main render function for the tech tree
export function renderTechTree(
  container: HTMLElement,
  nodes: TechNodeType[],
  faction: FactionState,
  callbacks: TechTreeCallbacks = {},
  initialState: Partial<TechTreeState> = {}
): {
  update: (faction: FactionState, state: Partial<TechTreeState>) => void;
  getState: () => TechTreeState;
  destroy: () => void;
} {
  // Initialize state
  let state: TechTreeState = {
    selectedNodeId: null,
    filteredBranch: null,
    searchQuery: '',
    ...initialState,
  };

  let connectorsOverlay: SVGSVGElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  // Internal callbacks with state management
  const internalCallbacks: TechTreeCallbacks = {
    onSelect: (node) => {
      state.selectedNodeId = node.id;
      callbacks.onSelect?.(node);
      render();
    },
    onResearch: callbacks.onResearch,
    onBranchFilter: (branch) => {
      state.filteredBranch = branch;
      callbacks.onBranchFilter?.(branch);
      render();
    },
  };

  function handleSearch(query: string): void {
    state.searchQuery = query;
    render();
  }

  function render(): void {
    // Clear container
    container.innerHTML = '';

    // Create tech screen structure
    const techScreen = div({
      className: 'tech-screen',
    });

    // Header with title and meta
    const header = div({
      className: 'tech-screen__header',
      children: [
        div({
          className: 'tech-screen__title',
          text: 'Technology Tree',
        }),
        div({
          className: 'tech-screen__meta',
          text: `${faction.unlockedTechs.size}/${nodes.length} Unlocked`,
        }),
      ],
    });
    techScreen.appendChild(header);

    // Controls row
    const controls = div({
      className: 'tech-screen__controls',
      children: [
        createBranchTabs(state.filteredBranch, internalCallbacks.onBranchFilter!),
        div({
          className: 'tech-screen__filters',
          children: [
            createSearchInput(state.searchQuery, handleSearch),
            createLegend(),
          ],
        }),
      ],
    });
    techScreen.appendChild(controls);

    // Progress cards
    const progress = createProgressCards(faction, nodes);
    techScreen.appendChild(progress);

    // Main content area (board + detail panel)
    const content = div({
      className: 'tech-screen__content',
    });

    // Tech board with connectors
    const boardWrapper = div({
      className: 'tech-board-wrapper',
      attrs: {
        style: 'position: relative;',
      },
    });

    const board = createTechBoard(nodes, faction, state, internalCallbacks);
    boardWrapper.appendChild(board);

    // Add connectors overlay after board is mounted
    requestAnimationFrame(() => {
      if (boardWrapper.isConnected) {
        connectorsOverlay = createTechConnectors(
          boardWrapper,
          nodes,
          state.selectedNodeId
        );
        boardWrapper.insertBefore(connectorsOverlay, boardWrapper.firstChild);
      }
    });

    content.appendChild(boardWrapper);

    // Detail panel
    const selectedNode = state.selectedNodeId
      ? nodes.find((n) => n.id === state.selectedNodeId)
      : null;

    const detailPanel = selectedNode
      ? createTechNodeDetail(
          selectedNode,
          getTechNodeStatus(selectedNode, faction),
          faction,
          internalCallbacks
        )
      : createTechNodeEmptyDetail();

    content.appendChild(detailPanel);
    techScreen.appendChild(content);

    container.appendChild(techScreen);

    // Set up resize observer for connectors
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(() => {
      if (connectorsOverlay && boardWrapper.isConnected) {
        resizeTechConnectors(connectorsOverlay, boardWrapper);
      }
    });
    resizeObserver.observe(boardWrapper);
  }

  // Initial render
  render();

  // Return control interface
  return {
    update: (newFaction: FactionState, newState: Partial<TechTreeState> = {}) => {
      Object.assign(state, newState);
      faction = newFaction;
      render();
    },
    getState: () => ({ ...state }),
    destroy: () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      container.innerHTML = '';
    },
  };
}

// Types are already exported via interfaces above
