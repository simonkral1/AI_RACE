// UI Components - Barrel export

// Base utilities
export * from './base.js';

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
export { renderFactionCard, renderFactionList, type FactionCardOptions } from './FactionCard.js';
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
