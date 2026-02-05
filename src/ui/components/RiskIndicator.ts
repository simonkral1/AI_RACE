// Risk indicator component showing exposure level as colored dots
// 3 dots showing exposure level: filled dots indicate risk
// Color coded: 0=green, 1=yellow, 2=orange, 3=red

import { div, span } from './base.js';

/**
 * Renders a risk indicator showing exposure level as colored dots.
 * Example: exposure 2 shows as filled-filled-empty (2/3 dots filled)
 *
 * CSS classes needed:
 * - .risk-indicator: Container for the dots
 * - .risk-dot: Individual dot styling
 * - .risk-dot--filled: Filled dot
 * - .risk-dot--empty: Empty/unfilled dot
 * - .risk-dot--level-0 through .risk-dot--level-3: Color variants
 *
 * @param exposure - Risk level from 0 (safe) to 3 (highest risk)
 * @param maxExposure - Maximum exposure level (default: 3)
 */
export function renderRiskIndicator(
  exposure: number,
  maxExposure: number = 3
): HTMLElement {
  const container = div({ className: 'risk-indicator' });

  // Determine color level class based on exposure
  const levelClass = `risk-indicator--level-${Math.min(exposure, maxExposure)}`;
  container.classList.add(levelClass);

  // Create dots
  for (let i = 0; i < maxExposure; i++) {
    const isFilled = i < exposure;
    const dot = span({
      className: `risk-dot ${isFilled ? 'risk-dot--filled' : 'risk-dot--empty'}`,
    });

    // Add level-specific class for coloring filled dots
    if (isFilled) {
      dot.classList.add(`risk-dot--level-${Math.min(exposure, maxExposure)}`);
    }

    container.appendChild(dot);
  }

  return container;
}

/**
 * Returns a text label for the exposure level
 */
export function getExposureLabel(exposure: number): string {
  switch (exposure) {
    case 0:
      return 'Safe';
    case 1:
      return 'Low Risk';
    case 2:
      return 'Medium Risk';
    case 3:
      return 'High Risk';
    default:
      return 'Unknown';
  }
}
