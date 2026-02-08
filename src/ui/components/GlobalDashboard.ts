// GlobalDashboard.ts - Combines header elements for game status
import { div, span, button } from './base.js';
import { renderSafetyGauge } from './SafetyGauge.js';
import { renderTurnTimeline } from './TurnTimeline.js';

export interface DashboardState {
  globalSafety: number;
  year: number;
  quarter: number;
  turn: number;
  tension?: string;
  agiClock?: string;
  canAdvance?: boolean;
  advanceLabel?: string;
}

export interface GlobalDashboardOptions {
  safetyThreshold?: number;
  startYear?: number;
  endYear?: number;
}

/**
 * Renders the global dashboard with safety gauge, timeline, and status indicators
 * Note: Advance/Reset buttons are now in the Command Center
 */
export function renderGlobalDashboard(
  state: DashboardState,
  _onAdvance?: () => void,  // Deprecated: now in Command Center
  _onReset?: () => void,     // Deprecated: now in Command Center
  options: GlobalDashboardOptions = {}
): HTMLElement {
  const { safetyThreshold = 60, startYear = 2026, endYear = 2033 } = options;

  const wrapper = div({ className: 'global-dashboard' });

  // Left section: Safety gauge
  const leftSection = div({ className: 'global-dashboard__left' });
  const gauge = renderSafetyGauge(state.globalSafety, {
    threshold: safetyThreshold,
    width: 160,
    height: 100,
  });
  leftSection.appendChild(gauge);

  // Center section: Date and timeline
  const centerSection = div({ className: 'global-dashboard__center' });

  // Current date display
  const dateDisplay = div({
    className: 'global-dashboard__date',
    children: [
      span({ className: 'global-dashboard__year', text: state.year.toString() }),
      span({ className: 'global-dashboard__quarter', text: `Q${state.quarter}` }),
    ],
  });
  centerSection.appendChild(dateDisplay);

  // Timeline
  const timeline = renderTurnTimeline(state.year, state.quarter, {
    startYear,
    endYear,
    showTurnCounter: true,
  });
  centerSection.appendChild(timeline);

  // Status indicators (tension, AGI clock)
  if (state.tension || state.agiClock) {
    const statusRow = div({ className: 'global-dashboard__status' });

    if (state.tension) {
      const tensionPill = div({
        className: `global-dashboard__pill global-dashboard__pill--tension`,
        children: [
          span({ text: 'Tension: ' }),
          span({ className: 'global-dashboard__pill-value', text: state.tension }),
        ],
      });
      statusRow.appendChild(tensionPill);
    }

    if (state.agiClock) {
      const clockPill = div({
        className: `global-dashboard__pill global-dashboard__pill--clock`,
        children: [
          span({ text: 'AGI: ' }),
          span({ className: 'global-dashboard__pill-value', text: state.agiClock }),
        ],
      });
      statusRow.appendChild(clockPill);
    }

    centerSection.appendChild(statusRow);
  }

  // Assemble dashboard (buttons removed - now in Command Center)
  wrapper.appendChild(leftSection);
  wrapper.appendChild(centerSection);

  return wrapper;
}

export default renderGlobalDashboard;
