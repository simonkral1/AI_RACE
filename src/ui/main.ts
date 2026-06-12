import './styles.css';
import './simple.css';

import { createInitialState } from '../core/state.js';
import { resolveTurn, getAction } from '../core/engine.js';
import { applyTechEffects } from '../core/tech.js';
import { ACTION_POINTS_PER_TURN, STARTING_RESEARCH_POINTS } from '../core/constants.js';
import {
  addUnifiedResearch,
  getUnifiedResearchPool,
  normalizeUnifiedResearch,
  setUnifiedResearchPool,
  spendUnifiedResearch,
} from '../core/research.js';
import { isTechAvailableForFaction } from '../core/techAccess.js';
import { applyResourceDelta, applyScoreDelta, applyStatDelta, computeGlobalSafety } from '../core/stats.js';
import { decideActions } from '../ai/decideActions.js';
import { getFactionChatReply } from '../ai/factionComms.js';
import { generateProactiveComms } from '../ai/proactiveComms.js';
import {
  applyNarrativeEffects,
  generateDirective,
  resolveNarrativeEffects,
  type NarrativeDirective,
} from '../ai/narrativeAI.js';
import { mulberry32, round1, clamp } from '../core/utils.js';
import { ActionChoice, ActionDefinition, GameState, TechNode, BranchId } from '../core/types.js';
import { TECH_TREE } from '../data/techTree.js';
import { ACTIONS } from '../data/actions.js';
import { EVENTS, selectEvent, type EventDefinition, type EventChoice, type EventEffect } from '../data/events.js';
import { applyEventEffects as applyEventEffectsCore } from '../core/eventEffects.js';
import { formatEffectPreviewText } from '../core/effectFormatter.js';
import { pickEventChoice } from '../ai/eventAI.js';
import { generateDialogue, type DialogueLine } from '../ai/dialogueAI.js';
import { saveToLocalStorage, loadFromLocalStorage } from '../core/persistence.js';
import { startTutorial, hasTutorialCompleted } from './tutorial.js';
import { playAdvance, playEvent, playSave, playLoad, playVictory, playDefeat, toggleAudio } from './audio.js';
import { showSaveManager, autosave } from './saveManager.js';
import { recordGameStart, recordGameEnd, showStatistics } from './statistics.js';
import { cycleSpeed, getSpeedLabel } from './gameSpeed.js';
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
  type ActionReviewRequest,
  type DirectiveActionTarget,
} from '../ai/gamemaster.js';

import type { VictoryType, LossType } from '../core/victoryConditions.js';

import {
  renderFactionList,
  renderVictoryTracker,
  renderEndgameAnalysis,
} from './components/index.js';

import { EventModal } from './components/EventModal.js';
import {
  showGamemasterModal,
  hideGamemasterModal,
  updateGamemasterModal,
  injectGamemasterModalStyles,
  type ChatMessage as GMChatMessage,
  type QuickActionType as GMQuickActionType,
} from './components/GamemasterModal.js';
import {
  showFactionChatModal,
  hideFactionChatModal,
  updateFactionChatModal,
  injectFactionChatModalStyles,
  type FactionChatMessage,
  type FactionChatTarget,
} from './components/FactionChatModal.js';

// Import new Command Center and Tech Tree Modal
import {
  TechTreeModal,
  TECH_TREE_MODAL_STYLES,
} from './components/TechTreeModal.js';
import {
  IntroSequence,
  INTRO_SEQUENCE_STYLES,
} from './components/IntroSequence.js';
import {
  renderExpandedCommandCenter,
  type ActionDossierEntry,
  EXPANDED_COMMAND_CENTER_STYLES,
} from './components/ExpandedCommandCenter.js';
import {
  ActionReviewModal,
  type ActionReviewItem,
} from './components/ActionReviewModal.js';
import {
  mountWorldMap,
  resetWorldMapView,
  setWorldMapStatus,
  type MapTargetAction,
} from './components/WorldMapCanvas.js';
import {
  runNegotiationPhase,
  buildNegotiationContext,
  requestAllianceConsent,
  type NegotiationExchange,
} from '../ai/negotiation.js';
import { newAgentGame } from '../ai/agentClient.js';

// DOM element references
const factionList = document.getElementById('factionList');
const worldMapContainer = document.getElementById('worldMap');
const recentActions = document.getElementById('recentActions');
const commandCenterContainer = document.getElementById('commandCenter');
const focusCard = document.getElementById('focusCard');
const startOverlay = document.getElementById('startOverlay');
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
let pendingEvent: EventDefinition | null = null;
let pendingEventChoices = new Map<string, string>();
let selectedMapFactionId: string | null = null;
let latestNegotiations: NegotiationExchange[] = [];
let eventHistory: string[] = [];
let commsFeed: DialogueLine[] = [];
const autoStart = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';
let campaignStarted = autoStart;

const DEFAULT_PLAYER_ORDER: ActionChoice = {
  actionId: 'research_capabilities',
  openness: 'open',
  targetFactionId: undefined,
};

const normalizeOrders = (orders: ActionChoice[]): ActionChoice[] => {
  const normalized = orders.slice(0, ACTION_POINTS_PER_TURN).map((order) => ({ ...order }));
  while (normalized.length < ACTION_POINTS_PER_TURN) {
    normalized.push({ ...DEFAULT_PLAYER_ORDER });
  }
  return normalized;
};

const normalizeResearchForAllFactions = (): void => {
  for (const faction of Object.values(state.factions)) {
    normalizeUnifiedResearch(faction);
  }
};

const grantPlayerStartingResearch = (): void => {
  const faction = state.factions[playerFactionId];
  if (!faction) return;
  setUnifiedResearchPool(faction, STARTING_RESEARCH_POINTS);
};

grantPlayerStartingResearch();
normalizeResearchForAllFactions();

// Store player orders as ActionChoice[] for the new component system
let playerOrders: ActionChoice[] = normalizeOrders([
  { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
  { actionId: 'research_capabilities', openness: 'open', targetFactionId: undefined },
]);

// Store player's narrative directive (free-form action)
let narrativeDirective = '';
let directiveDraft = '';
let lockedDirectives: string[] = [];
let directiveInterpretationNote = 'Submit a directive to update your quarter plan.';
let directiveInterpretationSource: 'llm' | 'fallback' | 'error' = 'fallback';
let directiveInterpretationPending = false;
let directiveInterpretationRequestKey = 0;

// Gamemaster AI instance and state
const gamemaster: Gamemaster = createGamemaster();
let gamemasterChatHistory: ChatMessage[] = [];
let gamemasterNarrative = '';
let gamemasterLoading = false;
let gamemasterPanelElement: HTMLElement | null = null;

// Modal instances
let eventModalInstance: EventModal | null = null;
let gamemasterModalOverlay: HTMLElement | null = null;
let factionChatModalOverlay: HTMLElement | null = null;
let techTreeModalInstance: TechTreeModal | null = null;
let introSequenceInstance: IntroSequence | null = null;
let actionReviewModalInstance: ActionReviewModal | null = null;

let factionChatLoading = false;
let selectedChatFactionId = 'us_lab_b';
const factionChatHistory = new Map<string, FactionChatMessage[]>();
let factionCommsUnreadCount = 0;
const lastInboundTurnByFaction = new Map<string, number>();
let turnNarrativeFeed: string[] = [];
let latestActionReviewItems: ActionReviewItem[] = [];
let pendingActionReviewItems: ActionReviewItem[] = [];
let actionReviewGenerationKey = 0;
const ANALYST_TIMEOUT_MS = 25_000;
const ACTION_REVIEW_TIMEOUT_MS = 20_000;
const ACTION_REVIEW_AI_ERROR = '[AI Error] Analyst action review unavailable for this action.';
let turnAdvanceLoadingOverlay: HTMLElement | null = null;
let turnAdvanceLoadingDetail: HTMLElement | null = null;
let turnAdvanceLoadingShownAt = 0;
let turnAdvanceLoadingHideTimer: ReturnType<typeof setTimeout> | null = null;

const withRequestTimeout = <T>(promise: Promise<T>, timeoutMs = ANALYST_TIMEOUT_MS): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const ensureTurnAdvanceLoadingOverlay = (): void => {
  if (turnAdvanceLoadingOverlay && turnAdvanceLoadingDetail) return;
  const overlay = document.createElement('div');
  overlay.className = 'turn-loading-overlay';
  overlay.innerHTML = `
    <div class="turn-loading-card" role="status" aria-live="polite">
      <div class="turn-loading-spinner" aria-hidden="true"></div>
      <div class="turn-loading-title">Turn in progress</div>
      <div class="turn-loading-detail">Preparing simulation update.</div>
    </div>
  `;
  document.body.appendChild(overlay);
  turnAdvanceLoadingOverlay = overlay;
  turnAdvanceLoadingDetail = overlay.querySelector('.turn-loading-detail');
};

const setTurnAdvanceLoading = (visible: boolean, detail = 'Preparing simulation update.'): void => {
  ensureTurnAdvanceLoadingOverlay();
  if (turnAdvanceLoadingDetail) {
    turnAdvanceLoadingDetail.textContent = detail;
  }
  if (turnAdvanceLoadingOverlay) {
    if (visible) {
      if (turnAdvanceLoadingHideTimer) {
        clearTimeout(turnAdvanceLoadingHideTimer);
        turnAdvanceLoadingHideTimer = null;
      }
      if (!turnAdvanceLoadingOverlay.classList.contains('is-visible')) {
        turnAdvanceLoadingShownAt = Date.now();
      }
      turnAdvanceLoadingOverlay.classList.add('is-visible');
      return;
    }

    const minVisibleMs = 320;
    const elapsed = Date.now() - turnAdvanceLoadingShownAt;
    const delayMs = Math.max(0, minVisibleMs - elapsed);
    if (turnAdvanceLoadingHideTimer) {
      clearTimeout(turnAdvanceLoadingHideTimer);
    }
    turnAdvanceLoadingHideTimer = setTimeout(() => {
      turnAdvanceLoadingOverlay?.classList.remove('is-visible');
      turnAdvanceLoadingHideTimer = null;
    }, delayMs);
  }
};

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

const getFactionChatTargets = (): FactionChatTarget[] =>
  Object.values(state.factions)
    .filter((faction) => faction.id !== playerFactionId)
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      type: faction.type,
    }));

const getChatHistoryForFaction = (factionId: string): FactionChatMessage[] =>
  [...(factionChatHistory.get(factionId) ?? [])];

const TARGETED_ACTION_IDS = new Set(['espionage', 'subsidize', 'regulate', 'executive_order', 'strategic_initiative', 'form_alliance']);

const getPlayerAllowedActions = (): ActionDefinition[] => {
  const faction = state.factions[playerFactionId];
  if (!faction) return [];
  return ACTIONS.filter((action) => (
    action.allowedFor.includes(faction.type)
    && (!action.factionSpecific || action.factionSpecific === faction.id)
  ));
};

const getPlayerActionTargets = (): DirectiveActionTarget[] =>
  Object.values(state.factions)
    .filter((faction) => faction.id !== playerFactionId)
    .map((faction) => ({ id: faction.id, name: faction.name, type: faction.type }));

const summarizeOrdersForDirectiveNote = (
  orders: ActionChoice[],
  targets: DirectiveActionTarget[] = getPlayerActionTargets(),
): string => {
  const targetNames = new Map(targets.map((target) => [target.id, target.name]));
  return orders
    .map((order) => {
      const actionName = (() => {
        try {
          return getAction(order.actionId).name;
        } catch {
          return order.actionId;
        }
      })();
      const openness = order.openness === 'secret' ? 'private' : 'open';
      const target = order.targetFactionId
        ? ` targeting ${targetNames.get(order.targetFactionId) ?? order.targetFactionId}`
        : '';
      return `${actionName} (${openness})${target}`;
    })
    .join(' | ');
};

const setDirectiveInterpretationFromOrders = (
  source: 'llm' | 'fallback' | 'error',
  prefix: string,
): void => {
  directiveInterpretationSource = source;
  directiveInterpretationNote = `${prefix}: ${summarizeOrdersForDirectiveNote(playerOrders)}`;
};

const syncNarrativeDirective = (): void => {
  narrativeDirective = lockedDirectives.join(' | ').trim();
};

const updateLockedDirectiveNote = (): void => {
  directiveInterpretationSource = 'fallback';
  if (!lockedDirectives.length) {
    directiveInterpretationNote = 'No directives locked. Confirm directives to queue next turn actions.';
    return;
  }
  const count = lockedDirectives.length;
  directiveInterpretationNote = `${count} directive${count === 1 ? '' : 's'} locked in for next turn.`;
};

const resetPlayerOrdersForFaction = (): void => {
  const allowed = getPlayerAllowedActions();
  const defaultActionId = allowed[0]?.id ?? 'research_capabilities';
  playerOrders = normalizeOrders([
    { actionId: defaultActionId, openness: 'open', targetFactionId: undefined },
    { actionId: defaultActionId, openness: 'open', targetFactionId: undefined },
  ]);
  activeOrderIndex = 0;
  setDirectiveInterpretationFromOrders('fallback', 'Current plan');
};

const clearDirectiveQueue = (): void => {
  lockedDirectives = [];
  directiveDraft = '';
  syncNarrativeDirective();
  updateLockedDirectiveNote();
};

updateLockedDirectiveNote();

const findInvalidTargetedOrder = (orders: ActionChoice[]): ActionChoice | null =>
  orders.find((order) => TARGETED_ACTION_IDS.has(order.actionId) && !order.targetFactionId) ?? null;

const appendFactionChatMessage = (
  factionId: string,
  message: FactionChatMessage,
  maxMessages = 24,
): void => {
  const next = [...getChatHistoryForFaction(factionId), message].slice(-maxMessages);
  factionChatHistory.set(factionId, next);
};

const buildFactionDecisionContext = (factionId: string): string | undefined => {
  const history = getChatHistoryForFaction(factionId).slice(-6);
  if (!history.length) return undefined;
  return history
    .map((entry) => `${entry.role === 'user' ? 'Player' : 'Faction'}: ${entry.content}`)
    .join('\n');
};


const applyEventEffects = (effects: EventEffect[], factionId: string): void => {
  applyEventEffectsCore(effects, factionId, state);
};

const handleTechResearch = (techId: string): void => {
  const faction = state.factions[playerFactionId];
  if (!faction) return;

  const tech = TECH_TREE.find((entry) => entry.id === techId);
  if (!tech) return;
  if (!isTechAvailableForFaction(tech, faction)) {
    state.log.push(`${tech.name} is not available to ${faction.name}.`);
    render(state);
    return;
  }

  const researchPool = getUnifiedResearchPool(faction);

  if (researchPool >= tech.cost) {
    faction.unlockedTechs.add(techId);
    applyTechEffects(faction, tech.effects);

    spendUnifiedResearch(faction, tech.cost);

    state.log.push(`${faction.name} unlocked ${tech.name}`);
    render(state);
  } else {
    state.log.push(`Not enough research points (need ${tech.cost}, have ${Math.floor(researchPool)})`);
    render(state);
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

const formatEffectPreview = formatEffectPreviewText;

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

const initActionReviewModal = (): void => {
  if (actionReviewModalInstance) return;
  actionReviewModalInstance = new ActionReviewModal();
};

const openActionReviewFlow = async (
  items: ActionReviewItem[],
  consumePending: boolean,
): Promise<void> => {
  if (!items.length) return;
  initActionReviewModal();

  await new Promise<void>((resolve) => {
    actionReviewModalInstance?.open({
      items,
      onComplete: () => {
        if (consumePending) {
          pendingActionReviewItems = [];
        }
        render(state);
        resolve();
      },
    });
  });
};

const renderEventPanel = (): void => {
  initEventModal();

  if (pendingEvent && eventModalInstance && !eventModalInstance.isOpen()) {
    eventModalInstance.open(pendingEvent);
  }

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
      // Double-click guard: disable all choices immediately on first click
      for (const btn of choiceButtons) {
        btn.disabled = true;
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.5';
      }
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
    const response = await withRequestTimeout(gamemaster.askQuestion(message, state));
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      { role: 'assistant' as const, content: response, timestamp: Date.now() },
    ];
  } catch (error) {
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      {
        role: 'assistant' as const,
        content: '[AI Error] Analyst LLM request failed. Check proxy/model and retry.',
        timestamp: Date.now(),
      },
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
        response = await withRequestTimeout(gamemaster.explainMechanics('safety'));
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Explain safety mechanics', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'explain-capability':
        response = await withRequestTimeout(gamemaster.explainMechanics('capability'));
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Explain capability mechanics', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'explain-actions':
        response = await withRequestTimeout(gamemaster.explainMechanics('actions'));
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'Explain available actions', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'get-advice':
      case 'what-should-i-do':
        response = await withRequestTimeout(gamemaster.getStrategicAdvice(state, playerFactionId));
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'user' as const, content: 'What should I do?', timestamp: Date.now() },
          { role: 'assistant' as const, content: response, timestamp: Date.now() },
        ];
        break;

      case 'get-summary':
        response = await withRequestTimeout(gamemaster.getGameSummary(state));
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
      {
        role: 'assistant' as const,
        content: '[AI Error] Analyst LLM request failed. Check proxy/model and retry.',
        timestamp: Date.now(),
      },
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
    updateGamemasterModalState();
  } catch {
    // Keep existing narrative on error
  }
};

const renderFocusCard = (state: GameState): void => {
  if (!focusCard) return;
  const faction = state.factions[focusFactionId];
  if (!faction) return;
  const reveal = canSeeExact(faction.id);
  const capital = reveal ? round1(faction.resources.capital) : bandFor(faction.resources.capital).label;
  const safety = reveal ? round1(faction.safetyScore) : bandFor(faction.safetyScore).label;
  const compute = reveal ? round1(faction.resources.compute) : bandFor(faction.resources.compute).label;
  const cyber = reveal ? round1(faction.resources.cybersecurity) : bandFor(faction.resources.cybersecurity).label;
  const softPower = round1(faction.resources.trust);
  const hardPower = reveal ? round1(faction.hardPower) : bandFor(faction.hardPower).label;
  const agiReady = reveal ? (faction.canDeployAgi ? 'Ready' : 'Not Ready') : 'Unknown';

  focusCard.innerHTML = `
    <div class="focus-card__title">${faction.name}</div>
    <div class="focus-card__row"><span>Type</span><span class="focus-card__value">${faction.type.toUpperCase()}</span></div>
    <div class="focus-card__row"><span>Capital</span><span class="focus-card__value">${capital}</span></div>
    <div class="focus-card__row"><span>Safety</span><span class="focus-card__value">${safety}</span></div>
    <div class="focus-card__row"><span>Compute</span><span class="focus-card__value">${compute}</span></div>
    <div class="focus-card__row"><span>Cybersecurity</span><span class="focus-card__value">${cyber}</span></div>
    <div class="focus-card__row"><span>Soft Power</span><span class="focus-card__value">${softPower}</span></div>
    <div class="focus-card__row"><span>Hard Power</span><span class="focus-card__value">${hardPower}</span></div>
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

const submitDirective = (rawDirective: string): void => {
  const directive = rawDirective.trim();
  if (!directive) return;

  lockedDirectives = [...lockedDirectives, directive];
  syncNarrativeDirective();
  directiveDraft = '';
  gamemaster.recordDirective(state.turn, playerFactionId, directive);
  directiveInterpretationRequestKey += 1;
  directiveInterpretationPending = false;
  updateLockedDirectiveNote();
  state.log.push(`Directive locked in: "${directive.substring(0, 90)}${directive.length > 90 ? '...' : ''}"`);
  render(state);
};

const editLockedDirective = (index: number): void => {
  if (index < 0 || index >= lockedDirectives.length) return;
  directiveDraft = lockedDirectives[index];
  lockedDirectives = lockedDirectives.filter((_, i) => i !== index);
  syncNarrativeDirective();
  updateLockedDirectiveNote();
  state.log.push('Directive unlocked for editing.');
  render(state);
};

const removeLockedDirective = (index: number): void => {
  if (index < 0 || index >= lockedDirectives.length) return;
  lockedDirectives = lockedDirectives.filter((_, i) => i !== index);
  syncNarrativeDirective();
  updateLockedDirectiveNote();
  state.log.push('Locked directive removed.');
  render(state);
};

const renderOrdersSection = (): void => {
  if (!ordersContainer) return;

  const playerFaction = state.factions[playerFactionId];
  if (!playerFaction) return;

  renderFreeformActions(ordersContainer, playerFaction, state, {
    onDirectiveSubmit: submitDirective,
    onSuggestedAction: async (question) => {
      await handleGamemasterMessage(question);
    },
  });
};

const renderPlayerControls = (): void => {
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
  const victoryType = state.victoryType as VictoryType | undefined;
  const lossType = state.lossType as LossType | undefined;

  if (winner) {
    endgameTitle.textContent = `${winner.name} Wins`;
    // Use victory type for more descriptive message
    if (victoryType === 'safe_agi') {
      endgameSubtitle.textContent = `Safe AGI deployed first in ${state.year} Q${state.quarter}.`;
    } else if (victoryType === 'dominant') {
      endgameSubtitle.textContent = `Achieved technological dominance in ${state.year} Q${state.quarter}.`;
    } else if (victoryType === 'public_trust') {
      endgameSubtitle.textContent = `Won through soft power and successful products.`;
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
      endgameSubtitle.textContent = `Loss of soft power destroyed your organization.`;
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

// Targeted actions that only make sense against labs
const TARGETED_LAB_ONLY = new Set(['regulate', 'subsidize', 'executive_order', 'strategic_initiative']);

const areAllied = (a: string, b: string): boolean =>
  (state.alliances.get(a) ?? []).includes(b) || (state.alliances.get(b) ?? []).includes(a);

const formAlliance = (a: string, b: string): void => {
  if (!state.alliances.has(a)) state.alliances.set(a, []);
  if (!state.alliances.has(b)) state.alliances.set(b, []);
  const listA = state.alliances.get(a)!;
  const listB = state.alliances.get(b)!;
  if (!listA.includes(b)) listA.push(b);
  if (!listB.includes(a)) listB.push(a);
};

const getMapTargetActions = (targetFactionId: string): MapTargetAction[] => {
  const target = state.factions[targetFactionId];
  if (!target) return [];
  return getPlayerAllowedActions()
    .filter((action) => TARGETED_ACTION_IDS.has(action.id))
    .filter((action) => (TARGETED_LAB_ONLY.has(action.id) ? target.type === 'lab' : true))
    .map((action) => ({
      id: action.id,
      // Alliances need the other side's consent, so the button is a proposal
      name: action.id === 'form_alliance' ? 'Propose Alliance' : action.name,
    }));
};

const renderWorldMapPanel = (): void => {
  if (!worldMapContainer) return;
  mountWorldMap(
    worldMapContainer,
    {
      state,
      playerFactionId,
      selectedFactionId: selectedMapFactionId,
      negotiations: latestNegotiations,
      targetActions: selectedMapFactionId ? getMapTargetActions(selectedMapFactionId) : [],
      campaignStarted,
    },
    {
      onSelectFaction: (factionId) => {
        selectedMapFactionId = factionId;
        renderWorldMapPanel();
      },
      onTargetAction: (actionId, targetFactionId) => {
        const orders = normalizeOrders(playerOrders);
        orders[activeOrderIndex] = { actionId, openness: 'open', targetFactionId };
        playerOrders = orders;
        activeOrderIndex = (activeOrderIndex + 1) % ACTION_POINTS_PER_TURN;
        const actionName = getAction(actionId).name;
        const targetName = state.factions[targetFactionId]?.name ?? targetFactionId;
        turnNarrativeFeed = [
          `Order set from map: ${actionName} targeting ${targetName}.`,
          ...turnNarrativeFeed,
        ].slice(0, 24);
        selectedMapFactionId = null;
        render(state);
      },
      onOpenChat: () => {
        openFactionChatModal();
      },
    },
  );
};

const render = (state: GameState): void => {
  renderHeader(state);
  renderFactions(state);
  renderWorldMapPanel(); // World map is the central screen
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
  playerOrders = normalizeOrders(playerOrders);
  return [...playerOrders];
};

type TurnSnapshot = {
  capability: number;
  safety: number;
  trust: number;
  compute: number;
  cybersecurity: number;
  capital: number;
  influence: number;
  hardPower: number;
  safetyCulture: number;
  opsec: number;
  publicOpinion: number;
  securityLevel: number;
  globalSafety: number;
};

const captureTurnSnapshot = (current: GameState, factionId: string): TurnSnapshot | null => {
  const faction = current.factions[factionId];
  if (!faction) return null;
  return {
    capability: faction.capabilityScore,
    safety: faction.safetyScore,
    trust: faction.resources.trust,
    compute: faction.resources.compute,
    cybersecurity: faction.resources.cybersecurity,
    capital: faction.resources.capital,
    influence: faction.resources.influence,
    hardPower: faction.hardPower,
    safetyCulture: faction.safetyCulture,
    opsec: faction.opsec,
    publicOpinion: faction.publicOpinion,
    securityLevel: faction.securityLevel,
    globalSafety: current.globalSafety,
  };
};

const signed = (value: number): string => `${value >= 0 ? '+' : ''}${round1(value)}`;

const summarizeActionMechanics = (order: ActionChoice): string => {
  try {
    const action = getAction(order.actionId);
    const deltas = Object.entries(action.baseResourceDelta ?? {})
      .filter(([, value]) => typeof value === 'number' && value !== 0)
      .map(([key, value]) => `${signed(value as number)} ${key}`);
    const research = Object.entries(action.baseResearch ?? {})
      .filter(([, value]) => typeof value === 'number' && value > 0)
      .map(([branch, value]) => `${signed(value as number)} ${branch} RP`);

    const mechanicsBits = [
      research.length ? `research ${research.join(', ')}` : null,
      deltas.length ? `resources ${deltas.join(', ')}` : null,
      order.openness === 'open'
        ? 'open posture tends to improve soft power and safety'
        : 'secret posture boosts speed but raises exposure risk',
    ].filter(Boolean);

    return `${action.name} (${order.openness}): ${mechanicsBits.join('; ')}.`;
  } catch {
    return `${order.actionId} (${order.openness}) executed.`;
  }
};

const resourceDeltaFromSnapshot = (before: TurnSnapshot, after: TurnSnapshot, key: string): number | null => {
  switch (key) {
    case 'compute':
      return after.compute - before.compute;
    case 'capital':
      return after.capital - before.capital;
    case 'trust':
      return after.trust - before.trust;
    case 'cybersecurity':
      return after.cybersecurity - before.cybersecurity;
    case 'influence':
      return after.influence - before.influence;
    case 'hardPower':
      return after.hardPower - before.hardPower;
    default:
      return null;
  }
};

const summarizeActionEffectiveness = (
  order: ActionChoice,
  before: TurnSnapshot,
  after: TurnSnapshot,
): string => {
  try {
    const action = getAction(order.actionId);
    const notes: string[] = [];

    const researchEntries = Object.entries(action.baseResearch ?? {}).filter(([, value]) => typeof value === 'number' && value > 0);
    if (researchEntries.length > 0) {
      const researchDetail = researchEntries.map(([branch, value]) => `${signed(value as number)} ${branch} RP`).join(', ');
      notes.push(`research pipeline advanced (${researchDetail})`);
    }

    const resourceEntries = Object.entries(action.baseResourceDelta ?? {}).filter(([, value]) => typeof value === 'number' && value !== 0);
    if (resourceEntries.length > 0) {
      const resourceDetail = resourceEntries
        .map(([key]) => {
          const actual = resourceDeltaFromSnapshot(before, after, key);
          return actual == null ? null : `${key} ${signed(actual)}`;
        })
        .filter((value): value is string => Boolean(value));
      if (resourceDetail.length) notes.push(`observed shift ${resourceDetail.join(', ')}`);
    }

    if (action.id === 'research_capabilities' && after.capability - before.capability <= 0) {
      notes.push('capability remained flat this quarter; this action typically compounds through later tech unlocks');
    }
    if (action.id === 'research_safety' && after.safety - before.safety <= 0) {
      notes.push('safety gains were limited this quarter despite safety investment');
    }

    const postureNote = order.openness === 'open'
      ? 'open posture improved observability and soft-power pressure'
      : 'secret posture increased speed-at-risk dynamics';
    notes.push(postureNote);

    return `${action.name} (${order.openness}) -> ${notes.join('; ')}.`;
  } catch {
    return `${order.actionId} (${order.openness}) -> execution completed with limited telemetry.`;
  }
};

const summarizeDirectiveOutcome = (
  directive: string,
  before: TurnSnapshot,
  after: TurnSnapshot,
): string => {
  const trimmed = directive.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  const checks: Array<{ keys: string[]; metric: string; delta: number }> = [
    { keys: ['safety', 'alignment', 'secure', 'guardrail'], metric: 'safety', delta: after.safety - before.safety },
    { keys: ['capability', 'research', 'accelerate', 'speed'], metric: 'capability', delta: after.capability - before.capability },
    { keys: ['trust', 'soft power', 'public', 'transparency'], metric: 'soft power', delta: after.trust - before.trust },
    { keys: ['compute', 'infrastructure', 'cluster'], metric: 'compute', delta: after.compute - before.compute },
    { keys: ['capital', 'funding', 'budget'], metric: 'capital', delta: after.capital - before.capital },
  ];

  const matched = checks.find((check) => check.keys.some((key) => lower.includes(key)));
  if (!matched) {
    return `Your directive "${trimmed}" was ingested; measured effects were mixed across key metrics.`;
  }

  if (matched.delta > 0) {
    return `Your directive "${trimmed}" aligned with outcomes: ${matched.metric} moved ${signed(matched.delta)}.`;
  }
  if (matched.delta < 0) {
    return `Your directive "${trimmed}" faced resistance this quarter: ${matched.metric} moved ${signed(matched.delta)}.`;
  }
  return `Your directive "${trimmed}" produced limited immediate movement in ${matched.metric}; impact may be delayed.`;
};

const formatActionIntelLabel = (order: ActionChoice, current: GameState): string => {
  try {
    const action = getAction(order.actionId);
    const targetName = order.targetFactionId ? current.factions[order.targetFactionId]?.name : null;
    return targetName ? `${action.name} -> ${targetName}` : action.name;
  } catch {
    return order.actionId;
  }
};

const summarizePublicActionIntel = (
  current: GameState,
  allChoices: Record<string, ActionChoice[]>,
  playerFaction: string,
): string => {
  const lines: string[] = [];
  for (const [factionId, orders] of Object.entries(allChoices)) {
    if (factionId === playerFaction) continue;
    const faction = current.factions[factionId];
    if (!faction) continue;

    const publicOrders = orders.filter((order) => order.openness === 'open');
    if (!publicOrders.length) {
      lines.push(`${faction.name}: no public disclosures`);
      continue;
    }

    const actionNames = publicOrders.map((order) => formatActionIntelLabel(order, current));
    lines.push(`${faction.name}: ${actionNames.join(', ')}`);
  }
  return lines.length ? `Public intel: ${lines.join(' | ')}.` : '';
};

const ACTION_PAPER_IDS = new Set([
  'research_capabilities',
  'research_safety',
  'publish_research',
  'open_research',
  'policy',
]);

const describeActionIntel = (
  order: ActionChoice,
  actorId: string,
  targetName: string | null,
): string => {
  const targetSuffix = targetName ? ` Target: ${targetName}.` : '';
  if (actorId === playerFactionId) {
    return `Your executed order.${targetSuffix}`;
  }
  if (order.openness === 'open') {
    return `Publicly disclosed by the actor.${targetSuffix}`;
  }
  return `Private execution; intent was not publicly disclosed.${targetSuffix}`;
};

const buildActionEffectTokens = (order: ActionChoice): string[] => {
  try {
    const action = getAction(order.actionId);
    const effects: string[] = [];
    for (const [branch, value] of Object.entries(action.baseResearch ?? {})) {
      if (typeof value === 'number' && value > 0) {
        effects.push(`${signed(value)} ${branch} RP`);
      }
    }
    for (const [resource, value] of Object.entries(action.baseResourceDelta ?? {})) {
      if (typeof value === 'number' && value !== 0) {
        effects.push(`${signed(value)} ${resource}`);
      }
    }
    if (action.scoreEffects?.capabilityDelta) {
      effects.push(`${signed(action.scoreEffects.capabilityDelta)} capability`);
    }
    if (action.scoreEffects?.safetyDelta) {
      effects.push(`${signed(action.scoreEffects.safetyDelta)} safety`);
    }
    if (action.securityLevelDelta) {
      effects.push(`${signed(action.securityLevelDelta)} security level`);
    }
    if (order.openness === 'open' && ACTION_PAPER_IDS.has(action.id)) {
      effects.push('paper publication: partial diffusion to rivals');
    }
    if (order.openness === 'secret') {
      effects.push('private channel: hidden intent');
    } else {
      effects.push('public channel: visible intent');
    }
    return effects;
  } catch {
    return ['execution complete'];
  }
};

type ActionReviewDraft = Omit<ActionReviewItem, 'evaluation' | 'source'> & {
  actorId: string;
  isPlayer: boolean;
};

const buildTurnActionReviewDrafts = (
  allChoices: Record<string, ActionChoice[]>,
  current: GameState,
  currentTurn: number,
): ActionReviewDraft[] => {
  const orderedFactionIds = [
    playerFactionId,
    ...Object.keys(current.factions).filter((id) => id !== playerFactionId),
  ];
  const items: ActionReviewDraft[] = [];
  let seq = 0;

  for (const factionId of orderedFactionIds) {
    const faction = current.factions[factionId];
    if (!faction) continue;
    const orders = allChoices[factionId] ?? [];
    for (const order of orders.slice(0, ACTION_POINTS_PER_TURN)) {
      const action = getAction(order.actionId);
      const targetName = order.targetFactionId ? current.factions[order.targetFactionId]?.name ?? order.targetFactionId : undefined;
      const visibility = order.openness === 'open' ? 'public' : 'private';
      items.push({
        id: `t${currentTurn}-${factionId}-${seq}`,
        actorName: faction.name,
        actionName: targetName ? `${action.name} → ${targetName}` : action.name,
        openness: order.openness,
        visibility,
        targetName,
        actorId: factionId,
        isPlayer: factionId === playerFactionId,
        effects: buildActionEffectTokens(order),
        intel: describeActionIntel(order, factionId, targetName ?? null),
      });
      seq += 1;
    }
  }

  return items;
};

const buildDeterministicActionReviewItems = (
  drafts: ActionReviewDraft[],
  playerDirective: string,
  playerNetDeltas?: ActionReviewRequest['netDeltas'],
): ActionReviewItem[] => {
  const directiveText = playerDirective.trim();
  return drafts.map((draft) => {
    const thisTurn = draft.visibility === 'public'
      ? `${draft.actorName} publicly executed ${draft.actionName}.`
      : `${draft.actorName} executed ${draft.actionName} through a private channel.`;

    const effectsLine = draft.effects.length
      ? draft.effects.slice(0, 3).join(', ')
      : 'No large direct deltas identified.';

    let nextTurn = draft.isPlayer
      ? 'Maintain a coherent action sequence and verify target selection before advancing.'
      : 'Monitor whether this move cascades into alliance, regulatory, or espionage pressure.';

    if (draft.isPlayer && directiveText && playerNetDeltas) {
      const momentum =
        playerNetDeltas.capability
        + playerNetDeltas.safety
        + playerNetDeltas.trust * 0.5
        + playerNetDeltas.globalSafety * 0.8;
      if (momentum >= 3) {
        nextTurn = 'Directive appears aligned with observed momentum; continue this line with targeted follow-through.';
      } else if (momentum <= -3) {
        nextTurn = 'Directive faced friction this turn; adjust action mix before recommitting to the same directive.';
      } else {
        nextTurn = 'Directive alignment is mixed; tighten next-turn actions around one explicit objective.';
      }
    }

    const evaluation = `This turn: ${thisTurn}\nWhy it matters: ${effectsLine}\nNext turn: ${nextTurn}`;

    return {
      ...draft,
      source: 'deterministic',
      evaluation,
    };
  });
};

const buildTurnNetDeltas = (before: TurnSnapshot, after: TurnSnapshot): ActionReviewRequest['netDeltas'] => ({
  capability: after.capability - before.capability,
  safety: after.safety - before.safety,
  trust: after.trust - before.trust,
  compute: after.compute - before.compute,
  capital: round1(after.capital - before.capital),
  globalSafety: round1(after.globalSafety - before.globalSafety),
});

const buildActionAttributeChecks = (
  before: TurnSnapshot | null,
  after: TurnSnapshot,
): ActionReviewRequest['attributeChecks'] => {
  const withDelta = (value: number, prior: number | null): number | undefined =>
    prior == null ? undefined : round1(value - prior);

  return [
    { label: 'Capability', value: round1(after.capability), delta: withDelta(after.capability, before?.capability ?? null) },
    { label: 'Safety', value: round1(after.safety), delta: withDelta(after.safety, before?.safety ?? null) },
    { label: 'Soft Power', value: round1(after.trust), delta: withDelta(after.trust, before?.trust ?? null) },
    { label: 'Compute', value: round1(after.compute), delta: withDelta(after.compute, before?.compute ?? null) },
    { label: 'Capital', value: round1(after.capital), delta: withDelta(after.capital, before?.capital ?? null) },
    { label: 'Influence', value: round1(after.influence), delta: withDelta(after.influence, before?.influence ?? null) },
    { label: 'Hard Power', value: round1(after.hardPower), delta: withDelta(after.hardPower, before?.hardPower ?? null) },
    { label: 'OPSEC', value: round1(after.opsec), delta: withDelta(after.opsec, before?.opsec ?? null) },
    { label: 'Safety Culture', value: round1(after.safetyCulture), delta: withDelta(after.safetyCulture, before?.safetyCulture ?? null) },
  ];
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const output: R[] = new Array(items.length);
  let cursor = 0;

  const runWorker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  };

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => runWorker());
  await Promise.all(runners);
  return output;
};

const narrateActionReviewItems = async (
  drafts: ActionReviewDraft[],
  current: GameState,
  beforeSnapshotsByFaction: Map<string, TurnSnapshot>,
  turnLog: string[],
  playerDirective: string,
  playerNetDeltas?: ActionReviewRequest['netDeltas'],
): Promise<ActionReviewItem[]> => {
  const trimmedDirective = playerDirective.trim();

  return mapWithConcurrency(drafts, 2, async (draft) => {
    let evaluation = ACTION_REVIEW_AI_ERROR;
    const afterSnapshot = captureTurnSnapshot(current, draft.actorId);
    const beforeSnapshot = beforeSnapshotsByFaction.get(draft.actorId) ?? null;
    const attributeChecks = afterSnapshot
      ? buildActionAttributeChecks(beforeSnapshot, afterSnapshot)
      : undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await withRequestTimeout(
          gamemaster.narrateActionReview({
            turn: current.turn,
            year: current.year,
            quarter: current.quarter,
            actorName: draft.actorName,
            actorId: draft.actorId,
            isPlayer: draft.isPlayer,
            actionName: draft.actionName,
            openness: draft.openness,
            visibility: draft.visibility,
            targetName: draft.targetName,
            playerDirective: draft.isPlayer && trimmedDirective ? trimmedDirective : undefined,
            netDeltas: draft.isPlayer ? playerNetDeltas : undefined,
            attributeChecks,
            turnLog: turnLog.slice(-8),
          }),
          ACTION_REVIEW_TIMEOUT_MS,
        );
        const normalized = response?.trim() ?? '';
        if (normalized && !normalized.startsWith('[AI Error]')) {
          evaluation = normalized;
          break;
        }
      } catch {
        // Retry once on transport/model failure before surfacing explicit AI error.
      }
    }

    return {
      ...draft,
      source: evaluation.startsWith('[AI Error]') ? 'error' : 'llm',
      evaluation,
    };
  });
};

const toActionDossier = (items: ActionReviewItem[]): ActionDossierEntry[] =>
  items.map((item) => ({
    actorName: item.actorName,
    title: item.actionName,
    openness: item.openness,
    source: item.source,
    summary: item.evaluation
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0)?.replace(/^This turn:\s*/i, '') ?? item.evaluation,
    intel: item.intel,
  }));

const describePlayerOutcome = (before: TurnSnapshot, after: TurnSnapshot): string => {
  const capabilityDelta = after.capability - before.capability;
  const safetyDelta = after.safety - before.safety;
  const trustDelta = after.trust - before.trust;
  const computeDelta = after.compute - before.compute;
  const capitalDelta = after.capital - before.capital;
  const globalDelta = after.globalSafety - before.globalSafety;

  const momentumScore =
    capabilityDelta +
    safetyDelta +
    trustDelta * 0.5 +
    computeDelta * 0.2 +
    capitalDelta * 0.15 +
    globalDelta * 0.8;
  const verdict = momentumScore >= 2.5 ? 'favorable' : momentumScore <= -2.5 ? 'rough' : 'mixed';

  return `Your action outcome this turn is ${verdict}: capability ${signed(capabilityDelta)}, safety ${signed(
    safetyDelta,
  )}, soft power ${signed(trustDelta)}, compute ${signed(computeDelta)}, capital ${signed(
    capitalDelta,
  )}, global safety ${signed(globalDelta)}.`;
};

const buildTurnNarrativeEntries = (
  turn: number,
  before: TurnSnapshot,
  after: TurnSnapshot,
  orders: ActionChoice[],
  playerDirective: string,
  allChoices: Record<string, ActionChoice[]>,
  afterState: GameState,
  factionId: string,
  turnLog: string[],
): string[] => {
  const entries: string[] = [];
  const actionSummary = orders.length ? orders.map((order) => summarizeActionEffectiveness(order, before, after)).join(' ') : 'No explicit orders were set, so default strategy was executed.';
  const playerOutcome = describePlayerOutcome(before, after);
  const directiveOutcome = summarizeDirectiveOutcome(playerDirective, before, after);
  const publicIntel = summarizePublicActionIntel(afterState, allChoices, factionId);

  entries.push(`Turn ${turn}: ${actionSummary}`);
  if (directiveOutcome) entries.push(directiveOutcome);
  entries.push(playerOutcome);
  if (publicIntel) entries.push(publicIntel);
  for (const item of turnLog.slice(-4)) {
    entries.push(`Notable: ${item}`);
  }
  return entries;
};

const buildTurnMechanicsExplanation = (
  before: TurnSnapshot | null,
  afterState: GameState,
  factionId: string,
  orders: ActionChoice[],
  playerDirective: string,
  allChoices: Record<string, ActionChoice[]>,
  turnLog: string[] = [],
): string => {
  const after = captureTurnSnapshot(afterState, factionId);
  const actionSummary = before && after && orders.length
    ? orders.map((order) => summarizeActionEffectiveness(order, before, after)).join(' ')
    : orders.length
      ? orders.map((order) => summarizeActionMechanics(order)).join(' ')
      : 'No explicit orders were set, so default strategy was executed.';

  if (!before || !after) {
    return `Turn ${afterState.turn}: ${actionSummary}`;
  }

  const playerOutcome = describePlayerOutcome(before, after);
  const directiveOutcome = summarizeDirectiveOutcome(playerDirective, before, after);
  const publicIntel = summarizePublicActionIntel(afterState, allChoices, factionId);

  const net = [
    `Capability ${signed(after.capability - before.capability)}`,
    `Safety ${signed(after.safety - before.safety)}`,
    `Soft Power ${signed(after.trust - before.trust)}`,
    `Compute ${signed(after.compute - before.compute)}`,
    `Capital ${signed(after.capital - before.capital)}`,
    `Global Safety ${signed(after.globalSafety - before.globalSafety)}`,
  ].join(' · ');

  const notableOutcomes = turnLog.length
    ? ` Notable outcomes: ${turnLog.slice(-4).join(' | ')}.`
    : '';

  const directiveSection = directiveOutcome ? ` ${directiveOutcome}` : '';
  return `Turn ${afterState.turn} results: ${actionSummary}${directiveSection} ${playerOutcome} ${publicIntel} Net effects: ${net}.${notableOutcomes}`;
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
  turnNarrativeFeed = [
    `Event resolved: ${resolvedEvent.title} -> ${resolvedChoice.label}.`,
    ...turnNarrativeFeed,
  ].slice(0, 24);

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
  turnNarrativeFeed = [
    `New event: ${event.title}. ${event.description}`,
    ...turnNarrativeFeed,
  ].slice(0, 24);

  // Analyst introduces the event
  gamemaster.introduceEvent(event, state, playerFactionId).then((intro) => {
    gamemasterNarrative = intro;
    gamemasterChatHistory = [
      ...gamemasterChatHistory,
      { role: 'assistant' as const, content: intro, timestamp: Date.now() },
    ];
    renderGamemasterPanelUI();
    updateGamemasterModalState();
  }).catch(() => {
    // Fallback: use event description directly
    gamemasterNarrative = `${event.title} — ${event.description}`;
    renderGamemasterPanelUI();
    updateGamemasterModalState();
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
  setTurnAdvanceLoading(true, 'Collecting faction decisions...');
  try {
    const beforeSnapshot = captureTurnSnapshot(state, playerFactionId);
    const beforeSnapshotsByFaction = new Map<string, TurnSnapshot>();
    for (const factionId of Object.keys(state.factions)) {
      const snapshot = captureTurnSnapshot(state, factionId);
      if (snapshot) beforeSnapshotsByFaction.set(factionId, snapshot);
    }
    const turnLogStart = state.log.length;
    const playerDirectiveThisTurn = lockedDirectives
      .map((directive) => directive.trim())
      .filter(Boolean)
      .join(' | ');
    const choices: Record<string, ActionChoice[]> = {};
    let playerOrdersThisTurn = readPlayerOrders();

    if (playerDirectiveThisTurn) {
      setTurnAdvanceLoading(true, 'Interpreting your directive...');
      const allowedActions = getPlayerAllowedActions();
      const targets = getPlayerActionTargets();
      const requestKey = ++directiveInterpretationRequestKey;
      directiveInterpretationPending = true;
      directiveInterpretationSource = 'fallback';
      directiveInterpretationNote = 'Interpreting directive for this turn...';
      render(state);

      let interpretation: Awaited<ReturnType<Gamemaster['interpretDirectiveActions']>> | null = null;
      try {
        interpretation = await withRequestTimeout(
          gamemaster.interpretDirectiveActions(
            playerDirectiveThisTurn,
            state,
            playerFactionId,
            allowedActions,
            targets,
            ACTION_POINTS_PER_TURN,
          ),
        );
      } catch {
        interpretation = null;
      }

      if (requestKey !== directiveInterpretationRequestKey) return;
      directiveInterpretationPending = false;

      if (!interpretation || !interpretation.orders.length || interpretation.source === 'error') {
        directiveInterpretationSource = 'error';
        const errorMessage = interpretation?.note?.trim() || '[AI Error] Unable to interpret directive. Check LLM and retry.';
        directiveInterpretationNote = errorMessage;
        state.log.push(errorMessage);
        render(state);
        return;
      }

      playerOrders = normalizeOrders(interpretation.orders);
      playerOrdersThisTurn = [...playerOrders];
      activeOrderIndex = 0;
      directiveInterpretationSource = interpretation.source;
      directiveInterpretationNote = interpretation.note;
      state.log.push(`Action plan interpreted: ${summarizeOrdersForDirectiveNote(playerOrders, targets)}`);
    }

    const invalidTargetOrder = findInvalidTargetedOrder(playerOrdersThisTurn);
    if (invalidTargetOrder) {
      const actionName = getAction(invalidTargetOrder.actionId).name;
      const warning = `Select a target for "${actionName}" before advancing.`;
      state.log.push(warning);
      turnNarrativeFeed = [warning, ...turnNarrativeFeed].slice(0, 24);
      render(state);
      return;
    }
    choices[playerFactionId] = playerOrdersThisTurn;
    const directivePlanSummary = `Plan: ${summarizeOrdersForDirectiveNote(playerOrdersThisTurn)}`;

    const directivesPromise = collectNarrativeDirectives();

    // Diplomatic phase: AI factions exchange messages before deciding actions.
    setTurnAdvanceLoading(true, 'Factions negotiating...');
    setWorldMapStatus('Diplomatic phase — agents negotiating');
    let negotiationRound: NegotiationExchange[] = [];
    latestNegotiations = [];
    try {
      // Stream each agent's message onto the map as it arrives
      negotiationRound = await runNegotiationPhase(state, playerFactionId, (exchange) => {
        latestNegotiations = [...latestNegotiations, exchange];
        renderWorldMapPanel();
      });
    } catch {
      negotiationRound = [];
    }
    latestNegotiations = negotiationRound;
    for (const exchange of negotiationRound) {
      const fromName = state.factions[exchange.fromFactionId]?.name ?? exchange.fromFactionId;
      const toName = state.factions[exchange.toFactionId]?.name ?? exchange.toFactionId;
      state.log.push(`[Diplomacy] ${fromName} → ${toName}: ${exchange.message}`);
      if (exchange.toFactionId === playerFactionId) {
        appendFactionChatMessage(exchange.fromFactionId, {
          role: 'assistant',
          content: exchange.message,
          timestamp: Date.now(),
        });
      }
    }
    if (negotiationRound.length) {
      renderWorldMapPanel(); // show comms arcs while decisions are collected
    }

    // Alliance consent: alliances only form when the other side agrees.
    setTurnAdvanceLoading(true, 'Resolving alliance proposals...');
    setWorldMapStatus('Alliance proposals under review');

    const recordConsentOutcome = (
      proposerId: string,
      targetId: string,
      consent: { accept: boolean; reply: string },
    ): void => {
      const proposerName = state.factions[proposerId]?.name ?? proposerId;
      const targetName = state.factions[targetId]?.name ?? targetId;
      if (consent.accept) {
        formAlliance(proposerId, targetId);
        state.log.push(`[Diplomacy] 🤝 Alliance formed: ${proposerName} + ${targetName}.`);
        turnNarrativeFeed = [`🤝 Alliance formed: ${proposerName} + ${targetName}.`, ...turnNarrativeFeed].slice(0, 24);
      } else {
        state.log.push(`[Diplomacy] ${targetName} declined an alliance with ${proposerName}.`);
        turnNarrativeFeed = [`Alliance declined: ${targetName} turned down ${proposerName}.`, ...turnNarrativeFeed].slice(0, 24);
      }
      latestNegotiations = [
        ...latestNegotiations,
        {
          turn: state.turn,
          fromFactionId: targetId,
          toFactionId: proposerId,
          intent: consent.accept ? 'alliance_formed' : 'alliance_declined',
          message: consent.reply,
        },
      ];
      renderWorldMapPanel();
    };

    // AI -> AI proposals from the diplomatic phase
    const aiProposals = negotiationRound.filter(
      (exchange) =>
        exchange.intent === 'propose_alliance'
        && exchange.toFactionId !== playerFactionId
        && !areAllied(exchange.fromFactionId, exchange.toFactionId),
    );
    for (const proposal of aiProposals) {
      const consent = await requestAllianceConsent(
        state,
        proposal.fromFactionId,
        proposal.toFactionId,
        proposal.message,
      );
      recordConsentOutcome(proposal.fromFactionId, proposal.toFactionId, consent);
    }

    // Player form_alliance orders need the target's consent before they resolve
    for (let index = 0; index < playerOrdersThisTurn.length; index += 1) {
      const order = playerOrdersThisTurn[index];
      if (order.actionId !== 'form_alliance' || !order.targetFactionId) continue;
      if (areAllied(playerFactionId, order.targetFactionId)) continue;
      const consent = await requestAllianceConsent(
        state,
        playerFactionId,
        order.targetFactionId,
        playerDirectiveThisTurn || 'We propose a formal alliance between our organizations.',
      );
      appendFactionChatMessage(order.targetFactionId, {
        role: 'assistant',
        content: consent.reply,
        timestamp: Date.now(),
      });
      recordConsentOutcome(playerFactionId, order.targetFactionId, consent);
      // The alliance (when accepted) is formed by the consent flow; either way
      // the action slot is repurposed so the engine doesn't form it unilaterally.
      playerOrdersThisTurn[index] = { actionId: 'research_capabilities', openness: 'open' };
    }
    choices[playerFactionId] = playerOrdersThisTurn;

    setTurnAdvanceLoading(true, 'Collecting faction decisions...');
    setWorldMapStatus('Action phase — agents deciding');
    const aiFactionIds = Object.keys(state.factions).filter((factionId) => factionId !== playerFactionId);
    const aiChoices = await Promise.all(
      aiFactionIds.map(async (factionId) => ({
        factionId,
        actions: await decideActions(state, factionId, rng, {
          playerCommsContext: [
            buildFactionDecisionContext(factionId),
            buildNegotiationContext(negotiationRound, state, factionId),
          ].filter(Boolean).join('\n') || undefined,
        }),
      })),
    );
    for (const aiChoice of aiChoices) {
      choices[aiChoice.factionId] = aiChoice.actions;
    }

    setTurnAdvanceLoading(true, 'Resolving outcomes...');
    setWorldMapStatus('Resolving quarter');
    resolveTurn(state, choices, rng, playerFactionId);
    setWorldMapStatus(null);
    const turnLog = state.log.slice(turnLogStart);

    // Record turn advance to gamemaster history
    gamemaster.recordEvent({
      turn: state.turn,
      type: 'turn_advanced',
    });

    const mechanicsExplanation = buildTurnMechanicsExplanation(
      beforeSnapshot,
      state,
      playerFactionId,
      playerOrdersThisTurn,
      playerDirectiveThisTurn,
      choices,
      turnLog,
    );
    const afterSnapshot = captureTurnSnapshot(state, playerFactionId);
    let playerNetDeltas: ActionReviewRequest['netDeltas'] | undefined;
    if (beforeSnapshot && afterSnapshot) {
      const entries = buildTurnNarrativeEntries(
        state.turn,
        beforeSnapshot,
        afterSnapshot,
        playerOrdersThisTurn,
        playerDirectiveThisTurn,
        choices,
        state,
        playerFactionId,
        turnLog,
      );
      playerNetDeltas = buildTurnNetDeltas(beforeSnapshot, afterSnapshot);
      turnNarrativeFeed = [directivePlanSummary, ...entries, ...turnNarrativeFeed].slice(0, 24);
    } else {
      turnNarrativeFeed = [directivePlanSummary, `Turn ${state.turn}: ${mechanicsExplanation}`, ...turnNarrativeFeed].slice(0, 24);
    }

    const actionReviewDrafts = buildTurnActionReviewDrafts(choices, state, state.turn);
    const deterministicReviewItems = buildDeterministicActionReviewItems(
      actionReviewDrafts,
      playerDirectiveThisTurn,
      playerNetDeltas,
    );
    latestActionReviewItems = deterministicReviewItems;
    pendingActionReviewItems = [...deterministicReviewItems];
    if (deterministicReviewItems.length > 0) {
      const publicCount = deterministicReviewItems.filter((item) => item.visibility === 'public').length;
      const privateCount = deterministicReviewItems.length - publicCount;
      turnNarrativeFeed = [
        `Action review ready: ${deterministicReviewItems.length} entries (${publicCount} public, ${privateCount} private).`,
        ...turnNarrativeFeed,
      ].slice(0, 24);
      render(state);
    }
    const reviewGenerationKey = ++actionReviewGenerationKey;
    void (async () => {
      const actionReviewItems = await narrateActionReviewItems(
        actionReviewDrafts,
        state,
        beforeSnapshotsByFaction,
        turnLog,
        playerDirectiveThisTurn,
        playerNetDeltas,
      );
      if (reviewGenerationKey !== actionReviewGenerationKey) return;
      const merged = actionReviewItems.map((item, index) => {
        if (item.source === 'error') {
          const deterministic = deterministicReviewItems[index];
          if (deterministic) {
            return {
              ...deterministic,
              source: 'error' as const,
              evaluation: item.evaluation,
            };
          }
        }
        return item;
      });
      latestActionReviewItems = merged;
      const keepPendingQueue = pendingActionReviewItems.length > 0;
      pendingActionReviewItems = keepPendingQueue ? [...merged] : [];
      turnNarrativeFeed = ['Analyst finished action-by-action review.', ...turnNarrativeFeed].slice(0, 24);
      render(state);
    })();

    // Analyst response is LLM-first; deterministic mechanics is fallback only.
    const playerActions = playerOrdersThisTurn.map((order) => {
      const action = getAction(order.actionId);
      return `${action.name} (${order.openness})`;
    });
    if (playerDirectiveThisTurn) {
      playerActions.push(`Directive: ${playerDirectiveThisTurn}`);
    }
    const diceRoll = Math.floor(rng() * 20) + 1;
    gamemasterLoading = true;
    renderGamemasterPanelUI();
    updateGamemasterModalState();
    void (async () => {
      try {
        const summary = await withRequestTimeout(
          gamemaster.narrateTurnSummary(state, playerFactionId, turnLog, playerActions, diceRoll),
        );
        const analystText = summary?.trim()
          ? summary
          : '[AI Error] Analyst turn summary unavailable for this turn.';
        gamemasterNarrative = analystText;
        turnNarrativeFeed = [`Analyst: ${analystText}`, ...turnNarrativeFeed].slice(0, 24);
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'assistant' as const, content: analystText, timestamp: Date.now() },
        ];
      } catch {
        gamemasterNarrative = '[AI Error] Analyst turn summary request failed. Check proxy/model and retry.';
        turnNarrativeFeed = [`Analyst: ${gamemasterNarrative}`, ...turnNarrativeFeed].slice(0, 24);
        gamemasterChatHistory = [
          ...gamemasterChatHistory,
          { role: 'assistant' as const, content: gamemasterNarrative, timestamp: Date.now() },
        ];
      } finally {
        gamemasterLoading = false;
        renderGamemasterPanelUI();
        updateGamemasterModalState();
      }
    })();

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

    const directives = await directivesPromise;

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

    if (!state.gameOver) {
      const inbound = generateProactiveComms(state, playerFactionId, rng, lastInboundTurnByFaction);
      for (const message of inbound) {
        const targetName = state.factions[message.fromFactionId]?.name ?? message.fromFactionId;
        appendFactionChatMessage(message.fromFactionId, {
          role: 'assistant',
          content: message.content,
          timestamp: Date.now(),
        });

        const isChatOpen = Boolean(factionChatModalOverlay);
        const isViewingThread = isChatOpen && selectedChatFactionId === message.fromFactionId;
        if (!isViewingThread) factionCommsUnreadCount += 1;

        turnNarrativeFeed = [`Inbound comms (${targetName}): ${message.content}`, ...turnNarrativeFeed].slice(0, 24);
      }
      if (inbound.length) {
        updateFactionChatModalState();
      }
    }

    if (lockedDirectives.length > 0 || narrativeDirective) {
      clearDirectiveQueue();
      renderOrdersSection();
    }

    // Autosave after each turn
    autosave(state);

    render(state);
  } finally {
    setTurnAdvanceLoading(false);
    setWorldMapStatus(null);
    isAdvancing = false;
  }
};

const reset = (): void => {
  seed += 7;
  rng = mulberry32(seed);
  state = createInitialState();
  playerFactionId = 'us_lab_a';
  focusFactionId = playerFactionId;
  grantPlayerStartingResearch();
  normalizeResearchForAllFactions();
  if (autoStart) {
    campaignStarted = true;
    startOverlay?.classList.add('is-hidden');
  } else {
    campaignStarted = false;
    startOverlay?.classList.remove('is-hidden');
  }
  endgameOverlay?.classList.add('is-hidden');
  selectedTechId = null;
  directiveInterpretationRequestKey += 1;
  directiveInterpretationPending = false;
  resetPlayerOrdersForFaction();
  clearDirectiveQueue();
  pendingEvent = null;
  pendingEventChoices.clear();
  selectedMapFactionId = null;
  latestNegotiations = [];
  resetWorldMapView();
  newAgentGame(); // fresh persistent-agent sessions for all factions
  eventHistory = [];
  commsFeed = [];
  factionChatHistory.clear();
  factionChatLoading = false;
  factionCommsUnreadCount = 0;
  lastInboundTurnByFaction.clear();
  closeFactionChatModal();
  turnNarrativeFeed = [];
  latestActionReviewItems = [];
  pendingActionReviewItems = [];
  actionReviewGenerationKey += 1;
  actionReviewModalInstance?.close(false);
  setTurnAdvanceLoading(false);
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
  ordersContainer?.addEventListener('change', (event) => {
    const target = event.target as HTMLElement;
    if (target.id === 'playerFaction') {
      const value = (target as HTMLSelectElement).value;
      playerFactionId = value || playerFactionId;
      focusFactionId = playerFactionId;
      directiveInterpretationRequestKey += 1;
      directiveInterpretationPending = false;
      resetPlayerOrdersForFaction();
      clearDirectiveQueue();
      ensureSelectedChatFaction();
      updateFactionChatModalState();
      renderPlayerControls();
      render(state);
    }
  });
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
        const response = await withRequestTimeout(gamemaster.askQuestion(message, state));
        gamemasterChatHistory.push({ role: 'assistant', content: response, timestamp: Date.now() });
      } catch (error) {
        gamemasterChatHistory.push({
          role: 'assistant',
          content: '[AI Error] Analyst LLM request failed. Check proxy/model and retry.',
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
            response = await withRequestTimeout(gamemaster.getStrategicAdvice(state, playerFactionId));
            break;
          case 'explain-safety':
            gamemasterChatHistory.push({ role: 'user', content: 'Explain how safety works in this game.', timestamp: Date.now() });
            response = await withRequestTimeout(gamemaster.explainMechanics('safety'));
            break;
          case 'explain-capability':
            gamemasterChatHistory.push({ role: 'user', content: 'Explain how capability progression works.', timestamp: Date.now() });
            response = await withRequestTimeout(gamemaster.explainMechanics('capability'));
            break;
          case 'get-summary':
            gamemasterChatHistory.push({ role: 'user', content: 'Give me a summary of the current game state.', timestamp: Date.now() });
            response = await withRequestTimeout(gamemaster.getGameSummary(state));
            break;
          default:
            response = 'I do not understand that request.';
        }
        gamemasterChatHistory.push({ role: 'assistant', content: response, timestamp: Date.now() });
      } catch (error) {
        gamemasterChatHistory.push({
          role: 'assistant',
          content: '[AI Error] Analyst LLM request failed. Check proxy/model and retry.',
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

const ensureSelectedChatFaction = (): void => {
  const targets = getFactionChatTargets();
  if (!targets.length) {
    selectedChatFactionId = '';
    return;
  }
  if (!targets.some((target) => target.id === selectedChatFactionId)) {
    selectedChatFactionId = targets[0].id;
  }
};

const updateFactionChatModalState = (): void => {
  if (!factionChatModalOverlay) return;
  ensureSelectedChatFaction();
  updateFactionChatModal(factionChatModalOverlay, {
    targets: getFactionChatTargets(),
    selectedTargetId: selectedChatFactionId,
    messages: selectedChatFactionId ? getChatHistoryForFaction(selectedChatFactionId) : [],
    isLoading: factionChatLoading,
  });
};

const closeFactionChatModal = (): void => {
  if (!factionChatModalOverlay) return;
  hideFactionChatModal(factionChatModalOverlay);
  factionChatModalOverlay = null;
};

const openFactionChatModal = (): void => {
  if (factionChatModalOverlay) return;
  ensureSelectedChatFaction();
  const targets = getFactionChatTargets();
  if (!targets.length) return;

  factionCommsUnreadCount = 0;
  render(state);

  factionChatModalOverlay = showFactionChatModal({
    targets,
    selectedTargetId: selectedChatFactionId,
    messages: getChatHistoryForFaction(selectedChatFactionId),
    isLoading: factionChatLoading,
    onSelectTarget: (targetId: string) => {
      selectedChatFactionId = targetId;
      updateFactionChatModalState();
    },
    onSendMessage: async (message: string) => {
      if (!selectedChatFactionId) return;

      appendFactionChatMessage(selectedChatFactionId, {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });
      factionChatLoading = true;
      updateFactionChatModalState();

      try {
        const reply = await getFactionChatReply(
          state,
          playerFactionId,
          selectedChatFactionId,
          message,
          getChatHistoryForFaction(selectedChatFactionId),
        );
        appendFactionChatMessage(selectedChatFactionId, {
          role: 'assistant',
          content: reply,
          timestamp: Date.now(),
        });
        const targetName = state.factions[selectedChatFactionId]?.name ?? selectedChatFactionId;
        commsFeed = [
          ...commsFeed,
          {
            factionId: selectedChatFactionId,
            speaker: targetName,
            text: reply,
          },
        ].slice(-40);
      } catch {
        appendFactionChatMessage(selectedChatFactionId, {
          role: 'assistant',
          content: 'Comms link dropped. Repeat your request next quarter.',
          timestamp: Date.now(),
        });
      } finally {
        factionChatLoading = false;
        updateFactionChatModalState();
        renderCommsPanel();
      }
    },
    onClose: closeFactionChatModal,
  });
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
  const normalizedOrders = normalizeOrders(playerOrders);
  playerOrders = normalizedOrders;
  const allowedActions = getPlayerAllowedActions();

  const commandCenter = renderExpandedCommandCenter(
    {
      gameState: state,
      playerFactionId,
      campaignStarted,
      hasPendingEvent: !!pendingEvent,
      pendingEventCount: pendingEvent ? 1 : 0,
      directiveText: directiveDraft,
      fullLogEntries: state.log,
      narrativeFeed: turnNarrativeFeed.slice(0, 10),
      actionDossier: toActionDossier(latestActionReviewItems),
      pendingActionReviewCount: pendingActionReviewItems.length,
      lockedDirectives: [...lockedDirectives],
      allowedActions,
      commsUnreadCount: factionCommsUnreadCount,
    },
    {
      onAdvanceTurn: () => {
        if (campaignStarted && !state.gameOver && !pendingEvent) {
          advance();
        }
      },
      onDirectiveSubmit: submitDirective,
      onEditLockedDirective: (index) => {
        editLockedDirective(index);
      },
      onRemoveLockedDirective: (index) => {
        removeLockedDirective(index);
      },
      onOpenTechTree: openTechTreeModal,
      onOpenGamemaster: openGamemasterModal,
      onOpenFactionChat: openFactionChatModal,
      onOpenActionReview: () => {
        const source = pendingActionReviewItems.length ? pendingActionReviewItems : latestActionReviewItems;
        if (!source.length) return;
        void openActionReviewFlow(source, pendingActionReviewItems.length > 0);
      },
      onEventClick: () => {
        if (pendingEvent && eventModalInstance && !eventModalInstance.isOpen()) {
          eventModalInstance.open(pendingEvent);
        }
      },
      onReset: () => {},
      onStats: () => {},
      onHelp: () => {},
      onSuggestedAction: (responseText: string) => {
        submitDirective(responseText);
      },
    }
  );

  commandCenterContainer.replaceChildren(commandCenter);
};

// Event delegation for advance button (primary click handler - survives replaceChildren re-renders)
if (commandCenterContainer) {
  commandCenterContainer.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.command-center__advance-btn') as HTMLElement;
    if (target && !target.hasAttribute('disabled')) {
      if (pendingEvent) {
        if (eventModalInstance && !eventModalInstance.isOpen()) {
          eventModalInstance.open(pendingEvent);
        }
      } else if (campaignStarted && !state.gameOver) {
        advance();
      }
    }
  });
}

const startCampaign = async (): Promise<void> => {
  campaignStarted = true;
  ensureSelectedChatFaction();
  directiveInterpretationRequestKey += 1;
  directiveInterpretationPending = false;
  resetPlayerOrdersForFaction();
  grantPlayerStartingResearch();
  normalizeResearchForAllFactions();
  introSequenceInstance?.close();
  startOverlay?.classList.add('is-hidden');
  endgameOverlay?.classList.add('is-hidden');
  setActiveOrderRow(0);
  renderPlayerControls();
  render(state);

  // Record game start for statistics
  recordGameStart(playerFactionId);

  // Generate opening briefing from the analyst
  gamemasterLoading = true;
  renderGamemasterPanelUI();
  updateGamemasterModalState();
  try {
    const openingNarration = await withRequestTimeout(
      gamemaster.generateOpeningNarration(state, playerFactionId),
    );
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
  updateGamemasterModalState();

  // Start tutorial for new players
  if (!hasTutorialCompleted()) {
    setTimeout(() => startTutorial(), 500);
  }
};

const renderStartOverlay = () => {
  if (!startOverlay) return;
  if (autoStart) {
    campaignStarted = true;
    startOverlay.classList.add('is-hidden');
    endgameOverlay?.classList.add('is-hidden');
    return;
  }

  if (!introSequenceInstance) {
    introSequenceInstance = new IntroSequence(startOverlay, {
      onComplete: (selectedFactionId: string) => {
        playerFactionId = selectedFactionId;
        focusFactionId = selectedFactionId;
        void startCampaign();
      },
      onSkip: () => {},
    });
  }

  campaignStarted = false;
  endgameOverlay?.classList.add('is-hidden');
  startOverlay.classList.remove('is-hidden');
  introSequenceInstance.open({
    showBriefing: IntroSequence.shouldShow(),
  });
};

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
        <div class="shortcut-row"><kbd>C</kbd><span>Open faction comms</span></div>
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
    if (factionChatModalOverlay) {
      closeFactionChatModal();
      return;
    }
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
        normalizeResearchForAllFactions();
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

    case 'c':
      event.preventDefault();
      openFactionChatModal();
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
        normalizeResearchForAllFactions();
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
  // Inject Intro Sequence styles
  if (!document.getElementById('intro-sequence-styles')) {
    const introStyle = document.createElement('style');
    introStyle.id = 'intro-sequence-styles';
    introStyle.textContent = INTRO_SEQUENCE_STYLES;
    document.head.appendChild(introStyle);
  }

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
injectFactionChatModalStyles(); // Inject faction chat modal styles
injectCommandCenterStyles(); // Inject command center and tech tree modal styles
initEventModal(); // Initialize event modal
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
    lockedDirectives: [...lockedDirectives],
    directiveDraft: directiveDraft || null,
    directiveInterpretation: {
      note: directiveInterpretationNote,
      source: directiveInterpretationSource,
      pending: directiveInterpretationPending,
    },
    playerOrders: normalizeOrders(playerOrders).map((order) => ({
      actionId: order.actionId,
      openness: order.openness,
      targetFactionId: order.targetFactionId ?? null,
    })),
    pendingEvent: pendingEvent ? { id: pendingEvent.id, title: pendingEvent.title } : null,
    actionReview: {
      pendingCount: pendingActionReviewItems.length,
      lastCount: latestActionReviewItems.length,
      open: actionReviewModalInstance?.isOpen() ?? false,
    },
    commsCount: commsFeed.length,
    factionChat: {
      open: Boolean(factionChatModalOverlay),
      selectedTargetId: selectedChatFactionId || null,
      threadCount: selectedChatFactionId ? getChatHistoryForFaction(selectedChatFactionId).length : 0,
    },
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
