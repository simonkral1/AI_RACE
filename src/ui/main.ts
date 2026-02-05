import './styles.css';

import { createInitialState } from '../core/state.js';
import { resolveTurn } from '../core/engine.js';
import { decideActions } from '../ai/decideActions.js';
import { mulberry32, round1 } from '../core/utils.js';
import { ActionChoice, GameState, TechNode, BranchId } from '../core/types.js';
import { ACTIONS } from '../data/actions.js';
import { TECH_TREE } from '../data/techTree.js';

// Import new UI components
import {
  renderFactionList,
  renderTechTree,
  renderOrdersPanel,
  renderGlobalDashboard,
  renderStrategyQuestion,
  needsTarget as componentNeedsTarget,
  type TechTreeCallbacks,
  type TechTreeState,
  type ActionTarget,
  type StrategyQuestionOptions,
} from './components/index.js';

// DOM element references
const factionList = document.getElementById('factionList');
const recentActions = document.getElementById('recentActions');
const techContainer = document.querySelector('.panel--tech .tech-screen') as HTMLElement | null;
const focusCard = document.getElementById('focusCard');
const startOverlay = document.getElementById('startOverlay');
const startOptions = document.getElementById('startOptions');
const startGameButton = document.getElementById('startGame');
const headerElement = document.querySelector('header.topbar') as HTMLElement | null;
const ordersContainer = document.querySelector('.orders') as HTMLElement | null;

let seed = 21;
let rng = mulberry32(seed);
let state: GameState = createInitialState();
let playerFactionId = 'us_lab_a';
let focusFactionId = 'us_lab_a';
let activeOrderIndex = 0;
let activeBranch: 'all' | TechNode['branch'] = 'all';
let selectedTechId: string | null = null;
let techSearchTerm = '';

// Store player orders as ActionChoice[] for the new component system
let playerOrders: ActionChoice[] = [
  { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
  { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
];

// Store player's natural language strategy answer
let strategyAnswer = '';

// Tech tree controller reference
let techTreeController: {
  update: (faction: any, state: Partial<TechTreeState>) => void;
  getState: () => TechTreeState;
  destroy: () => void;
} | null = null;

// TECH_BY_ID is now internal to the TechTree component

// Unused but kept for potential future use
// const formatQuarter = (year: number, quarter: number): string => `${year} Q${quarter}`;

const getTension = (state: GameState): string => {
  const capability = Object.values(state.factions).reduce((sum, f) => sum + f.capabilityScore, 0);
  if (capability > 140) return 'Severe';
  if (capability > 90) return 'Elevated';
  if (capability > 50) return 'Rising';
  return 'Low';
};

const getAgiClock = (state: GameState): string => {
  const best = Math.max(...Object.values(state.factions).map((f) => f.capabilityScore));
  if (best > 70) return 'Late phase';
  if (best > 45) return 'Mid phase';
  if (best > 25) return 'Early phase';
  return 'Nascent';
};

const renderFactions = (state: GameState): void => {
  if (!factionList) return;

  // Use the new FactionCard component system
  const factions = Object.values(state.factions);
  const factionListElement = renderFactionList(
    factions,
    playerFactionId,
    focusFactionId,
    (id: string) => {
      focusFactionId = id;
      render(state);
    }
  );

  factionList.replaceChildren(factionListElement);
};

const bandFor = (value: number) => {
  if (value < 40) return { label: 'Low', pct: 25 };
  if (value < 70) return { label: 'Med', pct: 55 };
  return { label: 'High', pct: 85 };
};

const canSeeExact = (factionId: string): boolean => factionId === playerFactionId;

// Helper functions - some are now handled by components but kept for focus card and other uses

// renderStat is now handled by FactionCard component

// branchLabel is now handled by TechTree component

// getNodeStatus is now handled by TechTree component

// updateTargetStateForRow is now handled by OrdersPanel component

// effectLabel is now handled by TechTree component

// getTechDepth is now handled by TechTree component

// collectPrereqs is now handled by TechTree component

// getNextUnlockable is now handled by TechTree component

// matchesSearch is now handled by TechTree component

const getActionForBranch = (branch: TechNode['branch'], factionId: string): string => {
  const faction = state.factions[factionId];
  if (!faction) return 'policy';
  if (branch === 'capabilities') return faction.type === 'lab' ? 'research_capabilities' : 'policy';
  if (branch === 'safety') return 'research_safety';
  if (branch === 'ops') return faction.type === 'lab' ? 'build_compute' : 'policy';
  return 'policy';
};

const renderTechScreen = (): void => {
  if (!techContainer) return;
  const faction = state.factions[playerFactionId];
  if (!faction) return;

  // Define callbacks for the tech tree component
  const callbacks: TechTreeCallbacks = {
    onSelect: (node) => {
      selectedTechId = node.id;
    },
    onResearch: (node) => {
      // Set research focus - update the active order to target this branch
      const actionId = getActionForBranch(node.branch, playerFactionId);
      if (playerOrders[activeOrderIndex]) {
        playerOrders[activeOrderIndex] = {
          ...playerOrders[activeOrderIndex],
          actionId,
        };
        renderOrdersSection();
      }
    },
    onBranchFilter: (branch) => {
      activeBranch = branch === null ? 'all' : branch;
    },
  };

  const techTreeState: Partial<TechTreeState> = {
    selectedNodeId: selectedTechId,
    filteredBranch: activeBranch === 'all' ? null : activeBranch as BranchId,
    searchQuery: techSearchTerm,
  };

  // If we have an existing controller, update it; otherwise create new
  if (techTreeController) {
    techTreeController.update(faction, techTreeState);
  } else {
    techTreeController = renderTechTree(
      techContainer,
      TECH_TREE,
      faction,
      callbacks,
      techTreeState
    );
  }
};

const renderLog = (state: GameState): void => {
  if (!recentActions) return;
  recentActions.innerHTML = '';
  const entries = state.log.slice(-6).reverse();
  for (const entry of entries) {
    const li = document.createElement('li');
    li.textContent = entry;
    recentActions.appendChild(li);
  }
  state.log.length = 0;
};

const renderFocusCard = (state: GameState): void => {
  if (!focusCard) return;
  const faction = state.factions[focusFactionId];
  if (!faction) return;
  const reveal = canSeeExact(faction.id);
  const capability = reveal ? round1(faction.capabilityScore) : bandFor(faction.capabilityScore).label;
  const safety = reveal ? round1(faction.safetyScore) : bandFor(faction.safetyScore).label;
  const compute = reveal ? round1(faction.resources.compute) : bandFor(faction.resources.compute).label;
  const trust = round1(faction.resources.trust);

  focusCard.innerHTML = `
    <div class="focus-card__title">${faction.name}</div>
    <div class="focus-card__row"><span>Type</span><span class="focus-card__value">${faction.type.toUpperCase()}</span></div>
    <div class="focus-card__row"><span>Capability</span><span class="focus-card__value">${capability}</span></div>
    <div class="focus-card__row"><span>Safety</span><span class="focus-card__value">${safety}</span></div>
    <div class="focus-card__row"><span>Compute</span><span class="focus-card__value">${compute}</span></div>
    <div class="focus-card__row"><span>Trust</span><span class="focus-card__value">${trust}</span></div>
  `;
};


// needsTarget is now exported from components, but we keep a local reference for compatibility
const needsTarget = componentNeedsTarget;

const getAllowedActions = (factionId: string) => {
  const faction = state.factions[factionId];
  if (!faction) return [];
  return ACTIONS.filter((action) => action.allowedFor.includes(faction.type));
};

// Render the orders section using the new OrdersPanel component
const renderOrdersSection = (): void => {
  if (!ordersContainer) return;

  const allowedActions = getAllowedActions(playerFactionId);
  const targets: ActionTarget[] = Object.values(state.factions)
    .filter((f) => f.id !== playerFactionId)
    .map((f) => ({ id: f.id, name: f.name }));

  // Ensure player orders use valid actions for the current faction type
  const validActionIds = new Set(allowedActions.map((a) => a.id));
  playerOrders = playerOrders.map((order) => {
    if (!validActionIds.has(order.actionId)) {
      return { ...order, actionId: allowedActions[0]?.id || 'policy' };
    }
    return order;
  });

  const ordersPanel = renderOrdersPanel(
    allowedActions,
    targets,
    playerOrders,
    (index, choice) => {
      playerOrders[index] = choice;
      renderOrdersSection();
    },
    activeOrderIndex,
    (index) => {
      activeOrderIndex = index;
      renderOrdersSection();
    }
  );

  // Render strategy question component
  const playerFaction = state.factions[playerFactionId];
  const strategyOptions: StrategyQuestionOptions = {
    turn: (state.year - 2026) * 4 + state.quarter,
    globalSafety: state.globalSafety,
    tension: getTension(state),
    factionType: playerFaction?.type || 'lab',
  };

  const strategyQuestion = renderStrategyQuestion(
    strategyOptions,
    strategyAnswer,
    (answer) => {
      strategyAnswer = answer;
    }
  );

  // Clear and replace the orders section content
  // Keep the "Play As" selector but replace the rows
  const playAsLabel = ordersContainer.querySelector('.orders__label');
  ordersContainer.innerHTML = '';

  if (playAsLabel) {
    ordersContainer.appendChild(playAsLabel);
  }
  ordersContainer.appendChild(ordersPanel);
  ordersContainer.appendChild(strategyQuestion);
};

const renderPlayerControls = (): void => {
  // Update the player faction selector
  const playerFactionSelect = ordersContainer?.querySelector('#playerFaction') as HTMLSelectElement | null;
  if (playerFactionSelect) {
    playerFactionSelect.innerHTML = '';
    for (const faction of Object.values(state.factions)) {
      const option = document.createElement('option');
      option.value = faction.id;
      option.textContent = faction.name;
      if (faction.id === playerFactionId) option.selected = true;
      playerFactionSelect.appendChild(option);
    }
  }

  renderOrdersSection();
};

const setActiveOrderRow = (index: number) => {
  activeOrderIndex = Math.max(0, Math.min(playerOrders.length - 1, index));
  renderOrdersSection();
};

// Render the global dashboard header using the new component
const renderHeader = (state: GameState): void => {
  if (!headerElement) return;

  const dashboardState = {
    globalSafety: state.globalSafety,
    year: state.year,
    quarter: state.quarter,
    turn: (state.year - 2026) * 4 + state.quarter,
    tension: getTension(state),
    agiClock: getAgiClock(state),
  };

  const dashboard = renderGlobalDashboard(
    dashboardState,
    advance,
    reset,
    {
      safetyThreshold: 60,
      startYear: 2026,
      endYear: 2033,
    }
  );

  headerElement.replaceChildren(dashboard);
};

const render = (state: GameState): void => {
  renderHeader(state);
  renderFactions(state);
  renderTechScreen();
  renderLog(state);
  renderFocusCard(state);
};

// Read player orders from the state (maintained by the OrdersPanel component)
const readPlayerOrders = (): ActionChoice[] => {
  return [...playerOrders];
};

let isAdvancing = false;

const advance = async (): Promise<void> => {
  if (state.gameOver) return;
  if (isAdvancing) return;
  isAdvancing = true;
  try {
    const choices: Record<string, ActionChoice[]> = {};
    for (const factionId of Object.keys(state.factions)) {
      if (factionId === playerFactionId) {
        choices[factionId] = readPlayerOrders();
      } else {
        choices[factionId] = await decideActions(state, factionId, rng);
      }
    }
    resolveTurn(state, choices, rng);
    render(state);
  } finally {
    isAdvancing = false;
  }
};

const reset = (): void => {
  seed += 7;
  rng = mulberry32(seed);
  state = createInitialState();
  playerFactionId = 'us_lab_a';
  focusFactionId = playerFactionId;
  startOverlay?.classList.remove('is-hidden');
  techSearchTerm = '';
  selectedTechId = null;
  // Reset player orders to defaults
  playerOrders = [
    { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
    { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
  ];
  // Reset strategy answer
  strategyAnswer = '';
  // Destroy and recreate tech tree controller on reset
  if (techTreeController) {
    techTreeController.destroy();
    techTreeController = null;
  }
  activeOrderIndex = 0;
  renderPlayerControls();
  renderStartOverlay();
  render(state);
};

// Bind player faction selector change handler
const bindPlayerFactionHandler = () => {
  // Use event delegation on the orders container since the select may be recreated
  ordersContainer?.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'playerFaction') {
      const value = (target as HTMLSelectElement).value;
      playerFactionId = value || playerFactionId;
      focusFactionId = playerFactionId;
      // Destroy tech tree controller so it recreates for new faction
      if (techTreeController) {
        techTreeController.destroy();
        techTreeController = null;
      }
      renderPlayerControls();
      render(state);
    }
  });
};

const bindFocusHandlers = () => {
  // Faction list click handlers are now handled by the FactionCard component callbacks
  // The onFocusChange callback is passed to renderFactionList
};

const renderStartOverlay = () => {
  if (!startOverlay || !startOptions || !startGameButton) return;
  startOptions.innerHTML = '';
  const factions = Object.values(state.factions);
  for (const faction of factions) {
    const option = document.createElement('div');
    option.className = 'overlay__option';
    if (faction.id === playerFactionId) option.classList.add('is-selected');
    option.textContent = `${faction.name} · ${faction.type.toUpperCase()}`;
    option.dataset.faction = faction.id;
    option.addEventListener('click', () => {
      playerFactionId = faction.id;
      focusFactionId = faction.id;
      renderStartOverlay();
    });
    startOptions.appendChild(option);
  }

  startGameButton.onclick = () => {
    startOverlay.classList.add('is-hidden');
    // Disable the player faction selector after game starts
    const playerFactionSelect = ordersContainer?.querySelector('#playerFaction') as HTMLSelectElement | null;
    if (playerFactionSelect) playerFactionSelect.disabled = true;
    setActiveOrderRow(0);
    renderPlayerControls();
    render(state);
  };
};

// Event bindings are now handled by the GlobalDashboard component callbacks
// and the OrdersPanel component callbacks

bindFocusHandlers();
bindPlayerFactionHandler();
renderStartOverlay();
renderPlayerControls();
render(state);

const renderGameToText = (): string => {
  const payload = {
    mode: state.gameOver ? 'ended' : 'running',
    year: state.year,
    quarter: state.quarter,
    playerFactionId,
    focusFactionId,
    activeBranch,
    selectedTechId,
    globalSafety: round1(state.globalSafety),
    strategyAnswer: strategyAnswer || null,
    coordSystem: 'origin top-left, +x right, +y down',
    factions: Object.values(state.factions).map((faction) => ({
      id: faction.id,
      name: faction.name,
      type: faction.type,
      capability: canSeeExact(faction.id) ? round1(faction.capabilityScore) : bandFor(faction.capabilityScore).label,
      safety: canSeeExact(faction.id) ? round1(faction.safetyScore) : bandFor(faction.safetyScore).label,
      trust: round1(faction.resources.trust),
      compute: canSeeExact(faction.id) ? round1(faction.resources.compute) : bandFor(faction.resources.compute).label,
    })),
  };
  return JSON.stringify(payload);
};

const advanceTime = (ms: number): void => {
  if (!Number.isFinite(ms)) return;
  render(state);
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;
