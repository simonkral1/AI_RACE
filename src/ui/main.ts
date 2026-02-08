import './styles.css';
import './simple.css';

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
import { saveToLocalStorage, loadFromLocalStorage, getSaveSlots } from '../core/persistence.js';
import { startTutorial, resetTutorial, hasTutorialCompleted } from './tutorial.js';
import { playAdvance, playEvent, playSave, playLoad, playVictory, playDefeat, toggleAudio, isAudioEnabled } from './audio.js';
import { showSaveManager, autosave } from './saveManager.js';
import { recordGameStart, recordGameEnd, showStatistics } from './statistics.js';
import { cycleSpeed, getSpeedLabel } from './gameSpeed.js';
import { renderSimpleTechTree } from './SimpleTechTree.js';
import { renderSimpleActions } from './SimpleActions.js';
import { renderFreeformActions } from './FreeformActions.js';
import {
  renderGamemasterPanel,
  updateGamemasterPanel,
  injectGamemasterStyles,
  type ChatMessage,
  type QuickActionType,
} from './GamemasterPanel.js';
import {
  createGamemaster,
  type Gamemaster,
  type GameEvent,
} from '../ai/gamemaster.js';

// Import new UI components
import {
  renderFactionList,
  renderTechTree,
  renderOrdersPanel,
  renderGlobalDashboard,
  renderStrategyQuestion,
  renderVictoryTracker,
  renderVictorySummary,
  renderEndgameAnalysis,
  needsTarget as componentNeedsTarget,
  createTabbedTechTree,
  type TechTreeCallbacks,
  type TechTreeState,
  type TabbedTechTreeState,
  type ActionTarget,
  type StrategyQuestionOptions,
  type VictoryTrackerOptions,
} from './components/index.js';

// Import modal components
import {
  EventModal,
  type EventModalCallbacks,
} from './components/EventModal.js';
import {
  showGamemasterModal,
  hideGamemasterModal,
  updateGamemasterModal,
  injectGamemasterModalStyles,
  type ChatMessage as GMChatMessage,
  type QuickActionType as GMQuickActionType,
} from './components/GamemasterModal.js';

// Import new Command Center and Tech Tree Modal
import {
  TechTreeModal,
  TECH_TREE_MODAL_STYLES,
} from './components/TechTreeModal.js';
import {
  renderExpandedCommandCenter,
  updateExpandedCommandCenter,
  EXPANDED_COMMAND_CENTER_STYLES,
} from './components/ExpandedCommandCenter.js';

// DOM element references
const factionList = document.getElementById('factionList');
const recentActions = document.getElementById('recentActions');
const techContainer = document.querySelector('.panel--tech .tech-screen') as HTMLElement | null;
const commandCenterContainer = document.getElementById('commandCenter');
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
const gamemasterContainer = document.getElementById('gamemasterPanel');
const victoryTrackerContainer = document.getElementById('victoryTracker');

// New action panel elements
const advanceQuarterBtn = document.getElementById('advanceQuarter');
const actionsTurnLabel = document.getElementById('actionsTurnLabel');
const actionsTurnNum = document.getElementById('actionsTurnNum');
const directiveInput = document.getElementById('directiveInput') as HTMLInputElement | null;
const askGamemasterBtn = document.getElementById('askGamemaster');
const eventBadge = document.getElementById('eventBadge');
const eventBadgeCount = document.getElementById('eventBadgeCount');
const resetGameBtn = document.getElementById('resetGame');
const showStatsBtn = document.getElementById('showStats');
const showShortcutsBtn = document.getElementById('showShortcuts');

// Victory tracker state
let victoryTrackerCollapsed = false;

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

// Tabbed tech tree controller reference
let tabbedTechTreeController: {
  update: (faction: any, state: Partial<TabbedTechTreeState>) => void;
  getState: () => TabbedTechTreeState;
  destroy: () => void;
} | null = null;

// Gamemaster AI instance and state
const gamemaster: Gamemaster = createGamemaster();
let gamemasterChatHistory: ChatMessage[] = [];
let gamemasterNarrative = '';
let gamemasterLoading = false;
let gamemasterPanelElement: HTMLElement | null = null;

// Modal instances
let eventModalInstance: EventModal | null = null;
let gamemasterModalOverlay: HTMLElement | null = null;
let techTreeModalInstance: TechTreeModal | null = null;

// Use tabbed view by default (can be toggled with URL param ?simple=1)
const useSimpleTechTree = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('simple') === '1';

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

// Research tech handler - shared between simple and tabbed views
const handleTechResearch = (techId: string): void => {
  const faction = state.factions[playerFactionId];
  if (!faction) return;

  // Find the tech and try to unlock it
  const tech = TECH_TREE.find(t => t.id === techId);
  if (!tech) return;

  // Check if we can afford it
  const branchProgress = faction.research[tech.branch] || 0;

  if (branchProgress >= tech.cost) {
    // Unlock the tech
    faction.unlockedTechs.add(techId);

    // Apply effects
    for (const effect of tech.effects) {
      if (effect.kind === 'capability') {
        faction.capabilityScore += effect.delta;
      } else if (effect.kind === 'safety') {
        faction.safetyScore += effect.delta;
      } else if (effect.kind === 'resource' && 'key' in effect) {
        (faction.resources as any)[effect.key] += effect.delta;
      } else if (effect.kind === 'unlockAgi') {
        faction.canDeployAgi = true;
      }
    }

    // Deduct cost from branch progress
    faction.research[tech.branch] = Math.max(0, branchProgress - tech.cost);

    state.log.push(`${faction.name} unlocked ${tech.name}`);
    render(state);
  } else {
    state.log.push(`Not enough ${tech.branch} research points (need ${tech.cost}, have ${Math.floor(branchProgress)})`);
    render(state);
  }
};

const renderTechScreen = (): void => {
  if (!techContainer) return;
  const faction = state.factions[playerFactionId];
  if (!faction) return;

  // Use simple tech tree if URL param is set, otherwise use tabbed view
  if (useSimpleTechTree) {
    renderSimpleTechTree(techContainer, faction, {
      onResearch: handleTechResearch,
    });
  } else {
    // Use the new tabbed tech tree
    if (!tabbedTechTreeController) {
      tabbedTechTreeController = createTabbedTechTree(
        techContainer,
        faction,
        {
          activeBranch: (activeBranch === 'all' ? 'capabilities' : activeBranch) as BranchId,
          selectedTechId: selectedTechId,
          hoveredTechId: null,
        },
        {
          onResearch: handleTechResearch,
          onBranchChange: (branch) => {
            activeBranch = branch;
          },
        }
      );
    } else {
      tabbedTechTreeController.update(faction, {
        activeBranch: (activeBranch === 'all' ? 'capabilities' : activeBranch) as BranchId,
        selectedTechId: selectedTechId,
      });
    }
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

const formatEffectPreview = (effects: EventEffect[]): string => {
  const parts: string[] = [];
  for (const effect of effects) {
    const sign = effect.delta > 0 ? '+' : '';
    switch (effect.kind) {
      case 'resource':
        parts.push(`${sign}${effect.delta} ${effect.key}`);
        break;
      case 'score':
        parts.push(`${sign}${effect.delta} ${effect.key === 'capabilityScore' ? 'capability' : 'safety'}`);
        break;
      case 'stat':
        parts.push(`${sign}${effect.delta} ${effect.key}`);
        break;
      case 'globalSafety':
        parts.push(`${sign}${effect.delta} global safety`);
        break;
    }
  }
  return parts.join(' · ');
};

// Initialize event modal
const initEventModal = (): void => {
  if (eventModalInstance) return;

  eventModalInstance = new EventModal({
    onChoice: (choiceId: string) => {
      if (!pendingEvent) return;
      resolveEventChoice(choiceId);
    },
  });
};

const renderEventPanel = (): void => {
  // Update event badge in action panel
  updateActionsPanelUI();

  // Ensure modal is initialized
  initEventModal();

  // If there's a pending event, show the modal
  if (pendingEvent && eventModalInstance && !eventModalInstance.isOpen()) {
    eventModalInstance.open(pendingEvent);
  }

  // Also update the inline panel if it exists (for legacy support)
  if (!eventPanel) return;
  if (!pendingEvent) {
    eventPanel.innerHTML = '<div class="event-panel__empty">No active events.</div>';
    return;
  }

  const choicesHtml = pendingEvent.choices
    .map(
      (choice) => {
        const effectPreview = formatEffectPreview(choice.effects);
        return `
        <button class="event-panel__choice" data-event-choice="${choice.id}">
          <div class="event-panel__choice-title">${choice.label}</div>
          <div class="event-panel__choice-desc">${choice.description}</div>
          ${effectPreview ? `<div class="event-panel__choice-effects">${effectPreview}</div>` : ''}
        </button>
      `;
      },
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

// Gamemaster message handler
const handleGamemasterMessage = async (message: string): Promise<void> => {
  // Add user message to history
  gamemasterChatHistory = [
    ...gamemasterChatHistory,
    { role: 'user' as const, content: message, timestamp: Date.now() },
  ];
  gamemasterLoading = true;
  renderGamemasterPanelUI();

  try {
    // Ask the gamemaster
    const response = await gamemaster.askQuestion(message, state);
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      { role: 'assistant' as const, content: response, timestamp: Date.now() },
    ];
  } catch (error) {
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      { role: 'assistant' as const, content: 'I encountered an error processing your question. Please try again.', timestamp: Date.now() },
    ];
  }

  gamemasterLoading = false;
  renderGamemasterPanelUI();
};

// Gamemaster quick action handler
const handleGamemasterQuickAction = async (action: QuickActionType): Promise<void> => {
  gamemasterLoading = true;
  renderGamemasterPanelUI();

  let response: string;

  try {
    switch (action) {
      case 'explain-safety':
        response = await gamemaster.explainMechanics('safety');
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Explain safety mechanics', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'explain-capability':
        response = await gamemaster.explainMechanics('capability');
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Explain capability mechanics', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'explain-actions':
        response = await gamemaster.explainMechanics('actions');
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Explain available actions', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'get-advice':
      case 'what-should-i-do':
        response = await gamemaster.getStrategicAdvice(state, playerFactionId);
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'What should I do?', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'get-summary':
        response = await gamemaster.getGameSummary(state);
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Give me a game summary', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      default:
        response = 'Unknown action.';
    }
  } catch (error) {
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      { role: 'assistant' as const, content: 'I encountered an error. Please try again.', timestamp: Date.now() },
    ];
  }

  gamemasterLoading = false;
  renderGamemasterPanelUI();
};

// Render the gamemaster panel
const renderGamemasterPanelUI = (): void => {
  if (!gamemasterContainer) return;

  // Inject styles if not already done
  injectGamemasterStyles();

  if (!gamemasterPanelElement) {
    // First render - create the panel
    gamemasterPanelElement = renderGamemasterPanel({
      state,
      onSendMessage: handleGamemasterMessage,
      onQuickAction: handleGamemasterQuickAction,
      chatHistory: gamemasterChatHistory,
      currentNarrative: gamemasterNarrative || `Year ${state.year} Q${state.quarter}: The race for AGI intensifies...`,
      isLoading: gamemasterLoading,
      factionId: playerFactionId,
    });
    gamemasterContainer.replaceChildren(gamemasterPanelElement);
  } else {
    // Update existing panel
    updateGamemasterPanel(gamemasterPanelElement, {
      chatHistory: gamemasterChatHistory,
      currentNarrative: gamemasterNarrative || `Year ${state.year} Q${state.quarter}: The race for AGI intensifies...`,
      isLoading: gamemasterLoading,
      state,
    });
  }
};

// Update gamemaster narrative after events
const updateGamemasterNarrative = async (event: EventDefinition, choice: EventChoice): Promise<void> => {
  try {
    gamemasterNarrative = await gamemaster.narrateEvent(event, choice);
    renderGamemasterPanelUI();
  } catch {
    // Keep existing narrative on error
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

// Render the victory tracker panel
const renderVictoryTrackerUI = (state: GameState): void => {
  if (!victoryTrackerContainer) return;
  if (!campaignStarted) {
    victoryTrackerContainer.innerHTML = '';
    return;
  }

  const trackerElement = renderVictoryTracker(state, playerFactionId, {
    collapsed: victoryTrackerCollapsed,
    showDistances: true,
    onToggle: (collapsed) => {
      victoryTrackerCollapsed = collapsed;
      renderVictoryTrackerUI(state);
    },
  });

  victoryTrackerContainer.replaceChildren(trackerElement);
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

// Render the orders section using Pax Historia-inspired freeform actions
const renderOrdersSection = (): void => {
  if (!ordersContainer) return;

  const playerFaction = state.factions[playerFactionId];
  if (!playerFaction) return;

  // Use Pax Historia-inspired freeform actions UI
  renderFreeformActions(ordersContainer, playerFaction, state, {
    onDirectiveSubmit: (directive) => {
      // Store the narrative directive for processing
      narrativeDirective = directive;
      state.log.push(`Directive submitted: "${directive.substring(0, 50)}${directive.length > 50 ? '...' : ''}"`);
      render(state);
    },
    onSuggestedAction: async (question) => {
      // Route to gamemaster for AI help
      await handleGamemasterMessage(question);
    },
  });
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

// Update topbar status indicators without replacing the structure
const renderHeader = (state: GameState): void => {
  if (!headerElement) return;

  // Update turn label
  const turnLabel = document.getElementById('turnLabel');
  if (turnLabel) turnLabel.textContent = `${state.year} Q${state.quarter}`;

  // Update global safety
  const safetyEl = document.getElementById('globalSafety');
  if (safetyEl) safetyEl.textContent = String(Math.round(state.globalSafety));

  // Update tension
  const tensionEl = document.getElementById('tension');
  if (tensionEl) tensionEl.textContent = getTension(state);
};

const renderEndgameOverlay = (state: GameState): void => {
  if (!endgameOverlay || !endgameTitle || !endgameSubtitle || !endgameMeta || !endgameReset) return;

  if (!campaignStarted || !state.gameOver) {
    endgameOverlay.classList.add('is-hidden');
    return;
  }

  const winner = state.winnerId ? state.factions[state.winnerId] : null;
  const topCapability = Object.values(state.factions).sort((a, b) => b.capabilityScore - a.capabilityScore)[0];

  // Determine victory/loss type from state
  const victoryType = state.victoryType as any;
  const lossType = state.lossType as any;

  if (winner) {
    endgameTitle.textContent = `${winner.name} Wins`;
    // Use victory type for more descriptive message
    if (victoryType === 'safe_agi') {
      endgameSubtitle.textContent = `Safe AGI deployed first in ${state.year} Q${state.quarter}.`;
    } else if (victoryType === 'dominant') {
      endgameSubtitle.textContent = `Achieved technological dominance in ${state.year} Q${state.quarter}.`;
    } else if (victoryType === 'public_trust') {
      endgameSubtitle.textContent = `Won through public trust and successful products.`;
    } else if (victoryType === 'regulatory') {
      endgameSubtitle.textContent = `Regulatory victory - all labs maintained safety through ${state.year}.`;
    } else if (victoryType === 'alliance') {
      endgameSubtitle.textContent = `Formed a global AI safety alliance.`;
    } else if (victoryType === 'control') {
      endgameSubtitle.textContent = `Achieved total control over AI development.`;
    } else {
      endgameSubtitle.textContent = `Campaign complete in ${state.year} Q${state.quarter}.`;
    }
  } else {
    // Loss or stalemate
    if (lossType === 'catastrophe') {
      endgameTitle.textContent = 'Global Catastrophe';
      endgameSubtitle.textContent = `Unsafe AGI deployment ended the campaign in ${state.year} Q${state.quarter}.`;
    } else if (lossType === 'collapse') {
      endgameTitle.textContent = 'Organization Collapsed';
      endgameSubtitle.textContent = `Loss of public trust destroyed your organization.`;
    } else if (lossType === 'obsolescence') {
      endgameTitle.textContent = 'Made Obsolete';
      endgameSubtitle.textContent = `Your faction fell too far behind in capability.`;
    } else if (lossType === 'coup') {
      endgameTitle.textContent = 'Government Overthrown';
      endgameSubtitle.textContent = `AI labs grew too powerful and seized control.`;
    } else {
      endgameTitle.textContent = 'Stalemate';
      endgameSubtitle.textContent = `The AGI race ended without a decisive victor.`;
    }
  }

  // Render endgame analysis in the meta section
  const analysisElement = renderEndgameAnalysis(state, playerFactionId, {
    victoryType,
    lossType,
    winnerId: state.winnerId,
    onRestart: reset,
  });

  // Replace the meta content with full analysis
  endgameMeta.replaceChildren(analysisElement);

  endgameReset.onclick = reset;
  endgameOverlay.classList.remove('is-hidden');
};

const render = (state: GameState): void => {
  renderHeader(state);
  renderFactions(state);
  renderCommandCenter(); // Command Center is now the main panel
  renderLog(state);
  renderFocusCard(state);
  renderVictoryTrackerUI(state);
  renderEventPanel();
  renderCommsPanel();
  renderGamemasterPanelUI();
  renderEndgameOverlay(state);

  // Update tech tree modal if open
  if (techTreeModalInstance?.isOpen()) {
    const faction = state.factions[playerFactionId];
    if (faction) {
      techTreeModalInstance.update(faction, {
        activeBranch: (activeBranch === 'all' ? 'capabilities' : activeBranch) as BranchId,
        selectedTechId: selectedTechId,
      });
    }
  }
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

  // Record event to gamemaster history
  gamemaster.recordEvent({
    turn: state.turn,
    type: 'event_resolved',
    eventId: pendingEvent.id,
    choiceId: choice.id,
    factionId: playerFactionId,
  });

  applyEventEffects(choice.effects, playerFactionId);
  state.log.push(`${state.factions[playerFactionId]?.name ?? 'Player'} chose: ${choice.label}`);

  for (const [factionId, aiChoiceId] of pendingEventChoices.entries()) {
    const aiChoice = pendingEvent.choices.find((item) => item.id === aiChoiceId) ?? pendingEvent.choices[0];
    applyEventEffects(aiChoice.effects, factionId);
    state.log.push(`${state.factions[factionId]?.name ?? factionId} chose: ${aiChoice.label}`);
  }

  // Update gamemaster narrative with the event outcome
  const resolvedEvent = pendingEvent;
  const resolvedChoice = choice;
  updateGamemasterNarrative(resolvedEvent, resolvedChoice);

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
  playEvent(); // Sound for new event
  pendingEventChoices = new Map();

  // Gamemaster introduces the event (D&D DM style)
  gamemaster.introduceEvent(event, state, playerFactionId).then((intro) => {
    gamemasterNarrative = intro;
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      { role: 'assistant' as const, content: intro, timestamp: Date.now() },
    ];
    renderGamemasterPanelUI();
  }).catch(() => {
    // Fallback: use event description directly
    gamemasterNarrative = `${event.title} — ${event.description}`;
    renderGamemasterPanelUI();
  });

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
  playAdvance();
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

    // Record turn advance to gamemaster history
    gamemaster.recordEvent({
      turn: state.turn,
      type: 'turn_advanced',
    });

    // Gamemaster narrates the turn (D&D DM style turn summary)
    const turnLog = [...state.log];
    gamemaster.narrateTurnSummary(state, playerFactionId, turnLog).then((summary) => {
      gamemasterNarrative = summary;
      gamemasterChatHistory = [
        ...gamemasterChatHistory,
        { role: 'assistant' as const, content: summary, timestamp: Date.now() },
      ];
      renderGamemasterPanelUI();
    }).catch(() => {
      // Keep existing narrative on error
    });

    // Play victory/defeat sounds and record statistics
    if (state.gameOver) {
      const turnsPlayed = (state.year - 2026) * 4 + state.quarter;
      const safeDeployment = !!state.winnerId;
      recordGameEnd(safeDeployment, turnsPlayed, safeDeployment);

      // Record game end in gamemaster history
      gamemaster.recordEvent({
        turn: state.turn,
        type: state.winnerId ? 'agi_deployed' : 'catastrophe',
        factionId: state.winnerId,
      });

      if (state.winnerId) {
        playVictory();
      } else {
        playDefeat();
      }
    }

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

    // Autosave after each turn
    autosave(state);

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
  if (tabbedTechTreeController) {
    tabbedTechTreeController.destroy();
    tabbedTechTreeController = null;
  }
  // Reset gamemaster state
  gamemasterChatHistory = [];
  gamemasterNarrative = '';
  gamemasterLoading = false;
  gamemasterPanelElement = null;
  gamemaster.clearHistory();
  activeBranch = 'capabilities';
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
      // Destroy tech tree controllers so they recreate for new faction
      if (techTreeController) {
        techTreeController.destroy();
        techTreeController = null;
      }
      if (tabbedTechTreeController) {
        tabbedTechTreeController.destroy();
        tabbedTechTreeController = null;
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

// Tab switching for main screens (DEPRECATED - tabs removed in new layout)
let activeMainTab = 'actions';

const bindTabHandlers = () => {
  // Tabs have been removed in the new fixed layout
  // This function is kept for backward compatibility but does nothing
};

// Bind action panel handlers for the new fixed layout
// NOTE: Most action panel handlers are now in the ExpandedCommandCenter component callbacks
const bindActionsPanelHandlers = () => {
  // Legacy handlers - these elements no longer exist in the new 2-column layout
  // All actions are now handled by the ExpandedCommandCenter component callbacks
  // Keeping this function for initialization order compatibility
};

// Open the Gamemaster modal
const openGamemasterModal = (): void => {
  if (gamemasterModalOverlay) return; // Already open

  gamemasterModalOverlay = showGamemasterModal({
    state,
    chatHistory: gamemasterChatHistory as GMChatMessage[],
    isLoading: gamemasterLoading,
    factionId: playerFactionId,
    onSendMessage: async (message: string) => {
      // Add user message to history
      gamemasterChatHistory.push({ role: 'user', content: message, timestamp: Date.now() });
      gamemasterLoading = true;
      updateGamemasterModalState();

      try {
        // Get response from gamemaster using askQuestion
        const response = await gamemaster.askQuestion(message, state);
        gamemasterChatHistory.push({ role: 'assistant', content: response, timestamp: Date.now() });
      } catch (error) {
        gamemasterChatHistory.push({
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
          timestamp: Date.now(),
        });
      }

      gamemasterLoading = false;
      updateGamemasterModalState();
    },
    onQuickAction: async (action: GMQuickActionType) => {
      gamemasterLoading = true;
      updateGamemasterModalState();

      try {
        let response: string;
        switch (action) {
          case 'what-should-i-do':
            gamemasterChatHistory.push({ role: 'user', content: 'What should I focus on this turn?', timestamp: Date.now() });
            response = await gamemaster.getStrategicAdvice(state, playerFactionId);
            break;
          case 'explain-safety':
            gamemasterChatHistory.push({ role: 'user', content: 'Explain how safety works in this game.', timestamp: Date.now() });
            response = await gamemaster.explainMechanics('safety');
            break;
          case 'explain-capability':
            gamemasterChatHistory.push({ role: 'user', content: 'Explain how capability progression works.', timestamp: Date.now() });
            response = await gamemaster.explainMechanics('capability');
            break;
          case 'get-summary':
            gamemasterChatHistory.push({ role: 'user', content: 'Give me a summary of the current game state.', timestamp: Date.now() });
            response = await gamemaster.getGameSummary(state);
            break;
          default:
            response = 'I do not understand that request.';
        }
        gamemasterChatHistory.push({ role: 'assistant', content: response, timestamp: Date.now() });
      } catch (error) {
        gamemasterChatHistory.push({
          role: 'assistant',
          content: 'I apologize, but I encountered an error. Please try again.',
          timestamp: Date.now(),
        });
      }

      gamemasterLoading = false;
      updateGamemasterModalState();
    },
    onClose: () => {
      closeGamemasterModal();
    },
  });
};

// Close the Gamemaster modal
const closeGamemasterModal = (): void => {
  if (gamemasterModalOverlay) {
    hideGamemasterModal(gamemasterModalOverlay);
    gamemasterModalOverlay = null;
  }
};

// Update the Gamemaster modal with current state
const updateGamemasterModalState = (): void => {
  if (gamemasterModalOverlay) {
    updateGamemasterModal(gamemasterModalOverlay, {
      chatHistory: gamemasterChatHistory as GMChatMessage[],
      isLoading: gamemasterLoading,
      state,
    });
  }
};

// Open the Tech Tree modal
const openTechTreeModal = (): void => {
  if (techTreeModalInstance?.isOpen()) return; // Already open

  const faction = state.factions[playerFactionId];
  if (!faction) return;

  if (!techTreeModalInstance) {
    techTreeModalInstance = new TechTreeModal({
      onClose: closeTechTreeModal,
      onResearch: handleTechResearch,
    });
  }

  techTreeModalInstance.open(faction, {
    activeBranch: (activeBranch === 'all' ? 'capabilities' : activeBranch) as BranchId,
    selectedTechId: selectedTechId,
  });
};

// Close the Tech Tree modal
const closeTechTreeModal = (): void => {
  if (techTreeModalInstance?.isOpen()) {
    techTreeModalInstance.close();
  }
};

// Toggle the Tech Tree modal
const toggleTechTreeModal = (): void => {
  if (techTreeModalInstance?.isOpen()) {
    closeTechTreeModal();
  } else {
    openTechTreeModal();
  }
};

// Render the Command Center
const renderCommandCenter = (): void => {
  if (!commandCenterContainer) return;

  const commandCenter = renderExpandedCommandCenter(
    {
      gameState: state,
      playerFactionId,
      campaignStarted,
      hasPendingEvent: !!pendingEvent,
      pendingEventCount: pendingEvent ? 1 : 0,
      directiveText: narrativeDirective,
      recentLog: state.log.slice(-5),
    },
    {
      onAdvanceTurn: () => {
        if (campaignStarted && !state.gameOver && !pendingEvent) {
          advance();
        }
      },
      onDirectiveSubmit: (text: string) => {
        narrativeDirective = text;
        state.log.push(`Directive: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        render(state);
      },
      onOpenTechTree: openTechTreeModal,
      onOpenGamemaster: openGamemasterModal,
      onEventClick: () => {
        if (pendingEvent && eventModalInstance && !eventModalInstance.isOpen()) {
          eventModalInstance.open(pendingEvent);
        }
      },
      onReset: () => {},
      onStats: () => {},
      onHelp: () => {},
      onSuggestedAction: (responseText: string) => {
        narrativeDirective = responseText;
        render(state);
      },
    }
  );

  commandCenterContainer.replaceChildren(commandCenter);
};

// Event delegation for advance button (backup for when addEventListener gets lost on re-render)
if (commandCenterContainer) {
  commandCenterContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('command-center__advance-btn') && !target.hasAttribute('disabled')) {
      if (campaignStarted && !state.gameOver && !pendingEvent) {
        advance();
      } else if (pendingEvent && eventModalInstance && !eventModalInstance.isOpen()) {
        eventModalInstance.open(pendingEvent);
      }
    }
  });
}

// Update action panel UI state
const updateActionsPanelUI = () => {
  // Update turn label
  if (actionsTurnLabel) {
    actionsTurnLabel.textContent = `${state.year} Q${state.quarter}`;
  }

  // Update turn number
  if (actionsTurnNum) {
    const turn = (state.year - 2026) * 4 + state.quarter;
    actionsTurnNum.textContent = `Turn ${turn}`;
  }

  // Update advance button state
  if (advanceQuarterBtn) {
    const canAdvance = campaignStarted && !state.gameOver && !pendingEvent;
    (advanceQuarterBtn as HTMLButtonElement).disabled = !canAdvance;
    advanceQuarterBtn.textContent = !campaignStarted
      ? 'Select Faction'
      : pendingEvent
        ? 'Resolve Event'
        : state.gameOver
          ? 'Campaign Ended'
          : 'Advance Quarter';
  }

  // Update event badge
  if (eventBadge && eventBadgeCount) {
    if (pendingEvent) {
      eventBadge.classList.remove('is-hidden');
      eventBadgeCount.textContent = '1';
    } else {
      eventBadge.classList.add('is-hidden');
    }
  }
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

  startGameButton.onclick = async () => {
    campaignStarted = true;
    startOverlay.classList.add('is-hidden');
    endgameOverlay?.classList.add('is-hidden');
    setActiveOrderRow(0);
    renderPlayerControls();
    render(state);

    // Record game start for statistics
    recordGameStart(playerFactionId);

    // Generate opening narration from the Gamemaster (D&D-style intro)
    gamemasterLoading = true;
    renderGamemasterPanelUI();
    try {
      const openingNarration = await gamemaster.generateOpeningNarration(state, playerFactionId);
      gamemasterNarrative = openingNarration;
      gamemasterChatHistory = [
        ...gamemasterChatHistory,
        { role: 'assistant' as const, content: openingNarration, timestamp: Date.now() },
      ];
    } catch {
      gamemasterNarrative = `The year is ${state.year}. The race for AGI has begun. Choose your path wisely.`;
      gamemasterChatHistory = [
        ...gamemasterChatHistory,
        { role: 'assistant' as const, content: gamemasterNarrative, timestamp: Date.now() },
      ];
    }
    gamemasterLoading = false;
    renderGamemasterPanelUI();

    // Start tutorial for new players
    if (!hasTutorialCompleted()) {
      setTimeout(() => startTutorial(), 500);
    }
  };
};

// Event bindings are now handled by the GlobalDashboard component callbacks
// and the OrdersPanel component callbacks

// Keyboard shortcuts
let shortcutsOverlayVisible = false;

const createShortcutsOverlay = (): HTMLElement => {
  const overlay = document.createElement('div');
  overlay.id = 'shortcutsOverlay';
  overlay.className = 'overlay shortcuts-overlay';
  overlay.innerHTML = `
    <div class="overlay__content">
      <h2 class="overlay__title">Keyboard Shortcuts</h2>
      <div class="shortcuts-grid">
        <div class="shortcut-row"><kbd>Space</kbd> / <kbd>Enter</kbd><span>Advance turn</span></div>
        <div class="shortcut-row"><kbd>1</kbd> - <kbd>5</kbd><span>Select faction</span></div>
        <div class="shortcut-row"><kbd>Esc</kbd><span>Close overlay / Deselect</span></div>
        <div class="shortcut-row"><kbd>S</kbd><span>Quick save</span></div>
        <div class="shortcut-row"><kbd>L</kbd><span>Quick load</span></div>
        <div class="shortcut-row"><kbd>F5</kbd><span>Save manager</span></div>
        <div class="shortcut-row"><kbd>Tab</kbd><span>Statistics</span></div>
        <div class="shortcut-row"><kbd>R</kbd><span>Reset game</span></div>
        <div class="shortcut-row"><kbd>T</kbd><span>Open Tech Tree</span></div>
        <div class="shortcut-row"><kbd>M</kbd><span>Toggle sound</span></div>
        <div class="shortcut-row"><kbd>G</kbd><span>Cycle game speed</span></div>
        <div class="shortcut-row"><kbd>B</kbd><span>Toggle light/dark theme</span></div>
        <div class="shortcut-row"><kbd>?</kbd><span>Toggle this help</span></div>
      </div>
      <button class="overlay__start" id="closeShortcuts">Close</button>
    </div>
  `;
  return overlay;
};

const toggleShortcutsOverlay = (): void => {
  let overlay = document.getElementById('shortcutsOverlay');
  if (shortcutsOverlayVisible && overlay) {
    overlay.classList.add('is-hidden');
    shortcutsOverlayVisible = false;
  } else {
    if (!overlay) {
      overlay = createShortcutsOverlay();
      document.body.appendChild(overlay);
      const closeBtn = overlay.querySelector('#closeShortcuts');
      closeBtn?.addEventListener('click', toggleShortcutsOverlay);
    }
    overlay.classList.remove('is-hidden');
    shortcutsOverlayVisible = true;
  }
};

const handleKeyboardShortcuts = (event: KeyboardEvent): void => {
  // Ignore if user is typing in an input
  const target = event.target as HTMLElement;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return;
  }

  const key = event.key.toLowerCase();

  // ? or / for help
  if (key === '?' || (event.shiftKey && key === '/')) {
    event.preventDefault();
    toggleShortcutsOverlay();
    return;
  }

  // Escape to close overlays
  if (key === 'escape') {
    event.preventDefault();
    // Close tech tree modal first if open
    if (techTreeModalInstance?.isOpen()) {
      closeTechTreeModal();
      return;
    }
    if (shortcutsOverlayVisible) {
      toggleShortcutsOverlay();
      return;
    }
    // Deselect tech
    if (selectedTechId) {
      selectedTechId = null;
    }
    return;
  }

  // Don't process other shortcuts if overlays are open
  if (!campaignStarted || state.gameOver || shortcutsOverlayVisible) {
    // Allow enter to start game
    if ((key === 'enter' || key === ' ') && !campaignStarted && !shortcutsOverlayVisible) {
      event.preventDefault();
      campaignStarted = true;
      startOverlay?.classList.add('is-hidden');
      endgameOverlay?.classList.add('is-hidden');
      setActiveOrderRow(0);
      renderPlayerControls();
      render(state);
    }
    return;
  }

  switch (key) {
    case ' ':
    case 'enter':
      event.preventDefault();
      if (!pendingEvent) {
        advance();
      }
      break;

    case '1':
    case '2':
    case '3':
    case '4':
    case '5': {
      event.preventDefault();
      const factionIds = Object.keys(state.factions);
      const index = parseInt(key) - 1;
      if (index < factionIds.length) {
        focusFactionId = factionIds[index];
        render(state);
      }
      break;
    }

    case 's':
      event.preventDefault();
      if (saveToLocalStorage(state, 'quicksave')) {
        playSave();
        state.log.push('Game saved to quicksave slot.');
        render(state);
      }
      break;

    case 'l':
      event.preventDefault();
      const loadedState = loadFromLocalStorage('quicksave');
      if (loadedState) {
        playLoad();
        state = loadedState;
        state.log.push('Game loaded from quicksave slot.');
        render(state);
      } else {
        state.log.push('No quicksave found.');
        render(state);
      }
      break;

    case 'm':
      event.preventDefault();
      const enabled = toggleAudio();
      state.log.push(`Sound ${enabled ? 'enabled' : 'disabled'}.`);
      render(state);
      break;

    case 'g':
      event.preventDefault();
      const newSpeed = cycleSpeed();
      state.log.push(`Game speed: ${getSpeedLabel()}`);
      render(state);
      break;

    case 'r':
      event.preventDefault();
      if (confirm('Reset the game? All progress will be lost.')) {
        reset();
      }
      break;

    case 't':
      event.preventDefault();
      toggleTechTreeModal();
      break;

    case 'b':
      event.preventDefault();
      toggleTheme();
      const isLight = document.body.classList.contains('theme-light');
      state.log.push(`Theme: ${isLight ? 'Light' : 'Dark'} mode`);
      render(state);
      break;
  }

  // Function keys (use event.key directly as they're like 'F5')
  if (event.key === 'F5') {
    event.preventDefault();
    showSaveManager(state, {
      onLoad: (loadedState) => {
        state = loadedState;
        render(state);
      },
      onClose: () => {},
    });
  }

  // Tab for statistics
  if (event.key === 'Tab') {
    event.preventDefault();
    showStatistics();
  }
};

document.addEventListener('keydown', handleKeyboardShortcuts);

// Theme initialization - default to light (AI 2027 style)
const initTheme = (): void => {
  const savedTheme = localStorage.getItem('agi-race-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Default to light theme (AI 2027 off-white style) unless user explicitly chose dark
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  document.body.classList.toggle('theme-light', theme === 'light');
};

const toggleTheme = (): void => {
  const isLight = document.body.classList.toggle('theme-light');
  localStorage.setItem('agi-race-theme', isLight ? 'light' : 'dark');
};

// Inject Command Center and Tech Tree Modal styles
const injectCommandCenterStyles = (): void => {
  // Inject Tech Tree Modal styles
  if (!document.getElementById('tech-tree-modal-styles')) {
    const techTreeStyle = document.createElement('style');
    techTreeStyle.id = 'tech-tree-modal-styles';
    techTreeStyle.textContent = TECH_TREE_MODAL_STYLES;
    document.head.appendChild(techTreeStyle);
  }

  // Inject Expanded Command Center styles
  if (!document.getElementById('expanded-command-center-styles')) {
    const commandCenterStyle = document.createElement('style');
    commandCenterStyle.id = 'expanded-command-center-styles';
    commandCenterStyle.textContent = EXPANDED_COMMAND_CENTER_STYLES;
    document.head.appendChild(commandCenterStyle);
  }
};

// Expose theme toggle to window for keyboard shortcut
declare global {
  interface Window {
    toggleTheme?: () => void;
  }
}
window.toggleTheme = toggleTheme;

initTheme();

// Wire up gear menu
const gearMenuBtn = document.getElementById('gearMenuBtn');
const gearMenu = document.getElementById('gearMenu');
if (gearMenuBtn && gearMenu) {
  gearMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    gearMenu.classList.toggle('is-open');
  });
  document.addEventListener('click', () => gearMenu.classList.remove('is-open'));
  document.getElementById('gearReset')?.addEventListener('click', () => {
    gearMenu.classList.remove('is-open');
    if (confirm('Reset the game? All progress will be lost.')) {
      reset();
    }
  });
  document.getElementById('gearStats')?.addEventListener('click', () => {
    gearMenu.classList.remove('is-open');
    showStatistics();
  });
  document.getElementById('gearKeys')?.addEventListener('click', () => {
    gearMenu.classList.remove('is-open');
    toggleShortcutsOverlay();
  });
}

injectGamemasterModalStyles(); // Inject modal styles
injectCommandCenterStyles(); // Inject command center and tech tree modal styles
initEventModal(); // Initialize event modal
bindFocusHandlers();
bindTabHandlers();
bindActionsPanelHandlers();
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
