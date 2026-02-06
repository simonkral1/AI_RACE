import './styles.css';

import { createInitialState } from '../core/state.js';
import { resolveTurn } from '../core/engine.js';
import { applyResourceDelta, applyScoreDelta, applyStatDelta, computeGlobalSafety } from '../core/stats.js';
import { decideActions } from '../ai/decideActions.js';
import {
  applyNarrativeEffects,
  generateDirective,
  resolveNarrativeEffects,
  type NarrativeDirective,
} from '../ai/narrativeAI.js';
import { mulberry32, round1, clamp } from '../core/utils.js';
import { ActionChoice, GameState, TechNode, BranchId } from '../core/types.js';
import { ACTIONS } from '../data/actions.js';
import { TECH_TREE } from '../data/techTree.js';
import { EVENTS, selectEvent, type EventDefinition, type EventChoice, type EventEffect } from '../data/events.js';
import { pickEventChoice } from '../ai/eventAI.js';
import { generateDialogue, type DialogueLine } from '../ai/dialogueAI.js';

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
const endgameOverlay = document.getElementById('endgameOverlay');
const endgameTitle = document.getElementById('endgameTitle');
const endgameSubtitle = document.getElementById('endgameSubtitle');
const endgameMeta = document.getElementById('endgameMeta');
const endgameReset = document.getElementById('endgameReset');
const headerElement = document.querySelector('header.topbar') as HTMLElement | null;
const ordersContainer = document.querySelector('.orders') as HTMLElement | null;
const eventPanel = document.getElementById('eventPanel');
const commsLog = document.getElementById('commsLog');

let seed = 21;
let rng = mulberry32(seed);
let state: GameState = createInitialState();
let playerFactionId = 'us_lab_a';
let focusFactionId = 'us_lab_a';
let activeOrderIndex = 0;
let activeBranch: 'all' | TechNode['branch'] = 'all';
let selectedTechId: string | null = null;
let techSearchTerm = '';
let pendingEvent: EventDefinition | null = null;
let pendingEventChoices = new Map<string, string>();
let eventHistory: string[] = [];
let commsFeed: DialogueLine[] = [];
const autoStart = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';
let campaignStarted = autoStart;

// Store player orders as ActionChoice[] for the new component system
let playerOrders: ActionChoice[] = [
  { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
  { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
];

// Store player's narrative directive (free-form action)
let narrativeDirective = '';

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
  if (state.gameOver) return state.winnerId ? 'Resolved' : 'Catastrophe';
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

const applyEventEffects = (effects: EventEffect[], factionId: string): void => {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'resource': {
        const targets =
          effect.target === 'faction'
            ? [factionId]
            : effect.target === 'all_labs'
              ? Object.values(state.factions).filter((faction) => faction.type === 'lab').map((f) => f.id)
              : Object.keys(state.factions);
        for (const id of targets) {
          const faction = state.factions[id];
          if (!faction) continue;
          applyResourceDelta(faction, { [effect.key]: effect.delta });
        }
        break;
      }
      case 'score': {
        const targets =
          effect.target === 'faction'
            ? [factionId]
            : effect.target === 'all_labs'
              ? Object.values(state.factions).filter((faction) => faction.type === 'lab').map((f) => f.id)
              : Object.keys(state.factions);
        for (const id of targets) {
          const faction = state.factions[id];
          if (!faction) continue;
          applyScoreDelta(faction, effect.key, effect.delta);
        }
        break;
      }
      case 'stat': {
        const targets =
          effect.target === 'faction'
            ? [factionId]
            : effect.target === 'all_labs'
              ? Object.values(state.factions).filter((faction) => faction.type === 'lab').map((f) => f.id)
              : Object.keys(state.factions);
        for (const id of targets) {
          const faction = state.factions[id];
          if (!faction) continue;
          applyStatDelta(faction, effect.key, effect.delta);
        }
        break;
      }
      case 'research': {
        const faction = state.factions[factionId];
        if (!faction) break;
        faction.research[effect.branch] = clamp(
          faction.research[effect.branch] + effect.delta,
          0,
          100,
        );
        break;
      }
      case 'globalSafety': {
        state.globalSafety = clamp(state.globalSafety + effect.delta, 0, 100);
        break;
      }
      default:
        break;
    }
  }
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

const renderEventPanel = (): void => {
  if (!eventPanel) return;
  if (!pendingEvent) {
    eventPanel.innerHTML = '<div class="event-panel__empty">No active events.</div>';
    return;
  }

  const choicesHtml = pendingEvent.choices
    .map(
      (choice) => `
      <button class="event-panel__choice" data-event-choice="${choice.id}">
        <div class="event-panel__choice-title">${choice.label}</div>
        <div class="event-panel__choice-desc">${choice.description}</div>
      </button>
    `,
    )
    .join('');

  eventPanel.innerHTML = `
    <div class="event-panel__title">${pendingEvent.title}</div>
    <div class="event-panel__desc">${pendingEvent.description}</div>
    <div class="event-panel__choices">${choicesHtml}</div>
  `;

  const choiceButtons = eventPanel.querySelectorAll<HTMLButtonElement>('[data-event-choice]');
  for (const button of choiceButtons) {
    button.onclick = () => {
      const choiceId = button.dataset.eventChoice;
      if (!choiceId || !pendingEvent) return;
      resolveEventChoice(choiceId);
    };
  }
};

const renderCommsPanel = (): void => {
  if (!commsLog) return;
  commsLog.innerHTML = '';
  const recent = commsFeed.slice(-8).reverse();
  for (const line of recent) {
    const li = document.createElement('li');
    li.className = 'comms-line';
    li.innerHTML = `<strong>${line.speaker}:</strong> ${line.text}`;
    commsLog.appendChild(li);
  }
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
  const agiReady = reveal ? (faction.canDeployAgi ? 'Ready' : 'Not Ready') : 'Unknown';

  focusCard.innerHTML = `
    <div class="focus-card__title">${faction.name}</div>
    <div class="focus-card__row"><span>Type</span><span class="focus-card__value">${faction.type.toUpperCase()}</span></div>
    <div class="focus-card__row"><span>Capability</span><span class="focus-card__value">${capability}</span></div>
    <div class="focus-card__row"><span>Safety</span><span class="focus-card__value">${safety}</span></div>
    <div class="focus-card__row"><span>Compute</span><span class="focus-card__value">${compute}</span></div>
    <div class="focus-card__row"><span>Trust</span><span class="focus-card__value">${trust}</span></div>
    <div class="focus-card__row"><span>AGI Readiness</span><span class="focus-card__value">${agiReady}</span></div>
  `;
};


// needsTarget is now exported from components, but we keep a local reference for compatibility
const needsTarget = componentNeedsTarget;

const getAllowedActions = (factionId: string) => {
  const faction = state.factions[factionId];
  if (!faction) return [];
  return ACTIONS.filter((action) => {
    if (!action.allowedFor.includes(faction.type)) return false;
    if (action.id === 'deploy_agi' && !faction.canDeployAgi) return false;
    return true;
  });
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
    {
      ...strategyOptions,
      promptOverride: 'Narrative Directive (one sentence)',
      placeholder: 'Example: Invest in safety research and build compute.',
    },
    narrativeDirective,
    (answer) => {
      narrativeDirective = answer;
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
    playerFactionSelect.disabled = campaignStarted;
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

  const canAdvance = campaignStarted && !state.gameOver && !pendingEvent;
  const advanceLabel = !campaignStarted
    ? 'Select Faction'
    : pendingEvent
      ? 'Resolve Event'
      : state.gameOver
        ? 'Campaign Ended'
        : 'Advance Quarter';

  const dashboardState = {
    globalSafety: state.globalSafety,
    year: state.year,
    quarter: state.quarter,
    turn: (state.year - 2026) * 4 + state.quarter,
    tension: getTension(state),
    agiClock: getAgiClock(state),
    canAdvance,
    advanceLabel,
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

const renderEndgameOverlay = (state: GameState): void => {
  if (!endgameOverlay || !endgameTitle || !endgameSubtitle || !endgameMeta || !endgameReset) return;

  if (!campaignStarted || !state.gameOver) {
    endgameOverlay.classList.add('is-hidden');
    return;
  }

  const winner = state.winnerId ? state.factions[state.winnerId] : null;
  const topCapability = Object.values(state.factions).sort((a, b) => b.capabilityScore - a.capabilityScore)[0];

  if (winner) {
    endgameTitle.textContent = `${winner.name} Wins`;
    endgameSubtitle.textContent = `Safe AGI deployed first in ${state.year} Q${state.quarter}.`;
  } else {
    endgameTitle.textContent = 'Global Catastrophe';
    endgameSubtitle.textContent = `Unsafe AGI deployment ended the campaign in ${state.year} Q${state.quarter}.`;
  }

  endgameMeta.innerHTML = `
    <div><strong>Global Safety:</strong> ${round1(state.globalSafety)}</div>
    <div><strong>Top Capability:</strong> ${topCapability?.name ?? 'N/A'} (${round1(topCapability?.capabilityScore ?? 0)})</div>
    <div><strong>Outcome Rule:</strong> First safe AGI wins; unsafe AGI ends the game for everyone.</div>
  `;

  endgameReset.onclick = reset;
  endgameOverlay.classList.remove('is-hidden');
};

const render = (state: GameState): void => {
  renderHeader(state);
  renderFactions(state);
  renderTechScreen();
  renderLog(state);
  renderFocusCard(state);
  renderEventPanel();
  renderCommsPanel();
  renderEndgameOverlay(state);
};

// Read player orders from the state (maintained by the OrdersPanel component)
const readPlayerOrders = (): ActionChoice[] => {
  return [...playerOrders];
};

const collectNarrativeDirectives = async (): Promise<NarrativeDirective[]> => {
  const directives: NarrativeDirective[] = [];
  const trimmed = narrativeDirective.trim();
  if (trimmed) {
    directives.push({ factionId: playerFactionId, text: trimmed, source: 'player' });
  }

  const aiFactions = Object.keys(state.factions).filter((id) => id !== playerFactionId);
  const aiDirectives = await Promise.all(
    aiFactions.map(async (id) => ({
      factionId: id,
      text: await generateDirective(state, id, rng),
      source: 'ai' as const,
    }))
  );

  for (const directive of aiDirectives) {
    if (directive.text) directives.push(directive);
  }

  return directives;
};

const resolveEventChoice = (choiceId: string): void => {
  if (!pendingEvent) return;
  const choice = pendingEvent.choices.find((item) => item.id === choiceId);
  if (!choice) return;

  applyEventEffects(choice.effects, playerFactionId);
  state.log.push(`${state.factions[playerFactionId]?.name ?? 'Player'} chose: ${choice.label}`);

  for (const [factionId, aiChoiceId] of pendingEventChoices.entries()) {
    const aiChoice = pendingEvent.choices.find((item) => item.id === aiChoiceId) ?? pendingEvent.choices[0];
    applyEventEffects(aiChoice.effects, factionId);
    state.log.push(`${state.factions[factionId]?.name ?? factionId} chose: ${aiChoice.label}`);
  }

  pendingEvent = null;
  pendingEventChoices.clear();
  state.globalSafety = computeGlobalSafety(state);
  renderEventPanel();
  render(state);
};

const triggerEvent = async (): Promise<void> => {
  if (pendingEvent) return;
  const event = selectEvent(state, rng, eventHistory);
  if (!event) return;
  pendingEvent = event;
  eventHistory.push(event.id);
  pendingEventChoices = new Map();

  const aiFactions = Object.keys(state.factions).filter((id) => id !== playerFactionId);
  const choices = await Promise.all(
    aiFactions.map(async (id) => ({
      factionId: id,
      choiceId: await pickEventChoice(state, id, event),
    })),
  );
  for (const choice of choices) {
    pendingEventChoices.set(choice.factionId, choice.choiceId);
  }
  renderEventPanel();
};

let isAdvancing = false;

const advance = async (): Promise<void> => {
  if (state.gameOver) return;
  if (pendingEvent) {
    renderEventPanel();
    return;
  }
  if (isAdvancing) return;
  isAdvancing = true;
  try {
    const directives = await collectNarrativeDirectives();
    const choices: Record<string, ActionChoice[]> = {};
    for (const factionId of Object.keys(state.factions)) {
      if (factionId === playerFactionId) {
        choices[factionId] = readPlayerOrders();
      } else {
        choices[factionId] = await decideActions(state, factionId, rng);
      }
    }
    resolveTurn(state, choices, rng);

    if (directives.length) {
      for (const directive of directives) {
        const faction = state.factions[directive.factionId];
        if (!faction) continue;
        state.log.push(`${faction.name} directive: ${directive.text}`);
      }
    }

    if (!state.gameOver && directives.length) {
      const gmResult = await resolveNarrativeEffects(state, directives);
      if (gmResult) {
        const gmLogs = applyNarrativeEffects(state, gmResult);
        state.log.push(...gmLogs);
      }
    }

    if (!state.gameOver) {
      await triggerEvent();
    }

    if (directives.length) {
      const lines = await generateDialogue(state, directives);
      commsFeed = [...commsFeed, ...lines].slice(-40);
    }

    if (narrativeDirective) {
      narrativeDirective = '';
      renderOrdersSection();
    }
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
  if (autoStart) {
    campaignStarted = true;
    startOverlay?.classList.add('is-hidden');
  } else {
    campaignStarted = false;
    startOverlay?.classList.remove('is-hidden');
  }
  endgameOverlay?.classList.add('is-hidden');
  techSearchTerm = '';
  selectedTechId = null;
  // Reset player orders to defaults
  playerOrders = [
    { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
    { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
  ];
  // Reset narrative directive
  narrativeDirective = '';
  pendingEvent = null;
  pendingEventChoices.clear();
  eventHistory = [];
  commsFeed = [];
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
  if (autoStart) {
    campaignStarted = true;
    startOverlay.classList.add('is-hidden');
    endgameOverlay?.classList.add('is-hidden');
    return;
  }
  campaignStarted = false;
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
    campaignStarted = true;
    startOverlay.classList.add('is-hidden');
    endgameOverlay?.classList.add('is-hidden');
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
  const outcome = state.gameOver
    ? (state.winnerId ? `winner:${state.winnerId}` : 'catastrophe')
    : 'in_progress';
  const playerFaction = state.factions[playerFactionId];
  const payload = {
    mode: campaignStarted ? (state.gameOver ? 'ended' : 'running') : 'setup',
    year: state.year,
    quarter: state.quarter,
    gameOver: state.gameOver,
    winnerId: state.winnerId ?? null,
    outcome,
    playerFactionId,
    playerCanDeployAgi: playerFaction?.canDeployAgi ?? false,
    focusFactionId,
    activeBranch,
    selectedTechId,
    globalSafety: round1(state.globalSafety),
    narrativeDirective: narrativeDirective || null,
    pendingEvent: pendingEvent ? { id: pendingEvent.id, title: pendingEvent.title } : null,
    commsCount: commsFeed.length,
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
