// UI Components - Barrel export

// Base utilities
export * from './base.js';

// Modal system
export {
  createModal,
  showModal,
  showConfirmModal,
  MODAL_STYLES,
  type ModalOptions,
  type ModalButton,
  type ModalInstance,
} from './Modal.js';

// Event Modal
export {
  EventModal,
  renderEventModal,
  EVENT_MODAL_STYLES,
  type EventModalCallbacks,
  type EventModalState,
} from './EventModal.js';

// Victory tracking
export {
  renderVictoryTracker,
  renderVictorySummary,
  renderMiniVictoryBars,
  VICTORY_TRACKER_STYLES,
  type VictoryTrackerOptions,
} from './VictoryTracker.js';

export {
  renderEndgameAnalysis,
  ENDGAME_ANALYSIS_STYLES,
  type EndgameAnalysisOptions,
  type EndgameStats,
  type TurningPoint,
} from './EndgameAnalysis.js';

// Risk and status indicators
export { renderRiskIndicator, getExposureLabel } from './RiskIndicator.js';
export { renderOpennessToggle } from './OpennessToggle.js';

// Action selector components
export {
  renderActionSelector,
  renderOrdersPanel,
  needsTarget,
  type ActionTarget,
} from './ActionSelector.js';

// Strategy question component
export {
  renderStrategyQuestion,
  getQuestionForTurn,
  type StrategyQuestionOptions,
} from './StrategyQuestion.js';

// Faction display
export {
  renderFactionCard,
  renderFactionList,
  type FactionCardOptions,
  type RelationshipIndicator,
  type FactionListCallbacks,
  type FactionListOptions,
} from './FactionCard.js';

// Faction detail screens
export {
  renderFactionDetailScreen,
  showFactionDetail,
  type FactionDetailCallbacks,
  type FactionDetailOptions,
} from './FactionDetailScreen.js';

export {
  renderFactionRelationships,
  showFactionRelationships,
  calculateRelationships,
  type FactionRelationship,
  type RelationshipType,
  type RelationshipsCallbacks,
  type RelationshipsOptions,
} from './FactionRelationships.js';

export {
  renderFactionComparison,
  showFactionComparison,
  type ComparisonCallbacks,
  type ComparisonOptions,
} from './FactionComparison.js';
export {
  renderMiniRadarChart,
  renderFogOfWarRadarChart,
  RADAR_COLORS,
  valueToBand,
  getResourceBands,
  createResourceAxes,
  type RadarChartOptions,
} from './RadarChart.js';

// Global dashboard
export { renderSafetyGauge, type SafetyGaugeOptions } from './SafetyGauge.js';
export { renderTurnTimeline, type TurnTimelineOptions } from './TurnTimeline.js';
export {
  renderGlobalDashboard,
  type GlobalDashboardOptions,
  type DashboardState,
} from './GlobalDashboard.js';

// Tech tree components
export {
  createTechNode,
  createTechNodeDetail,
  createTechNodeEmptyDetail,
  getTechNodeStatus,
  type TechNodeStatus,
  type TechNodeCallbacks,
} from './TechNode.js';
export {
  createTechConnectors,
  updateTechConnectorHighlights,
  resizeTechConnectors,
  type ConnectorOptions,
} from './TechConnectors.js';
export {
  renderTechTree,
  type TechTreeCallbacks,
  type TechTreeState,
} from './TechTree.js';

// Tech Tree Tabs and Branch Screen
export {
  renderTechTreeTabs,
  getTabInfo,
  BRANCH_TABS,
  type TabInfo,
  type TechTreeTabsOptions,
} from './TechTreeTabs.js';
export {
  renderBranchScreen,
  getBranchProgress,
  type BranchScreenCallbacks,
  type BranchScreenState,
} from './BranchScreen.js';
export {
  createTabbedTechTree,
  renderTabbedTechTree,
  type TabbedTechTreeCallbacks,
  type TabbedTechTreeState,
} from './TabbedTechTree.js';

// Compact Actions Panel (new simplified right panel)
export {
  renderCompactActionsPanel,
  updateCompactActionsPanel,
  COMPACT_ACTIONS_PANEL_STYLES,
  type CompactActionsPanelOptions,
  type CompactActionsPanelCallbacks,
} from './CompactActionsPanel.js';

// Gamemaster Modal
export {
  renderGamemasterModal,
  updateGamemasterModal,
  showGamemasterModal,
  hideGamemasterModal,
  injectGamemasterModalStyles,
  type ChatMessage,
  type QuickActionType,
  type GamemasterModalOptions,
  type GamemasterModalUpdateOptions,
} from './GamemasterModal.js';

// Tech Tree Modal
export {
  TechTreeModal,
  renderTechTreeModal,
  TECH_TREE_MODAL_STYLES,
  type TechTreeModalCallbacks,
  type TechTreeModalState,
} from './TechTreeModal.js';

// Expanded Command Center
export {
  renderExpandedCommandCenter,
  updateExpandedCommandCenter,
  EXPANDED_COMMAND_CENTER_STYLES,
  type ExpandedCommandCenterOptions,
  type ExpandedCommandCenterCallbacks,
  type StrategicSituation,
} from './ExpandedCommandCenter.js';
