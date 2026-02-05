// SafetyGauge.ts - Semi-circular safety meter component
import { createGauge } from '../utils/svg.js';
import { div, span, toggleClass } from './base.js';

export interface SafetyGaugeOptions {
  width?: number;
  height?: number;
  threshold?: number;
  showLabel?: boolean;
}

/**
 * Renders a semi-circular safety gauge showing 0-100 scale
 * Green when safe (>= threshold), red/pulsing when below threshold
 */
export function renderSafetyGauge(
  value: number,
  options: SafetyGaugeOptions = {}
): HTMLElement {
  const {
    width = 180,
    height = 110,
    threshold = 60,
    showLabel = true,
  } = options;

  const isSafe = value >= threshold;

  // Create wrapper
  const wrapper = div({ className: 'safety-gauge' });
  toggleClass(wrapper, 'safety-gauge--danger', !isSafe);

  // Create the SVG gauge using the utility
  const gauge = createGauge(value, 100, threshold, width, height);
  gauge.classList.add('safety-gauge__svg');

  // Add label below gauge
  if (showLabel) {
    const label = div({
      className: 'safety-gauge__label',
      text: 'GLOBAL SAFETY',
    });
    wrapper.appendChild(label);
  }

  // Add value display (positioned over the gauge center)
  const valueDisplay = div({
    className: 'safety-gauge__value-container',
    children: [
      span({
        className: `safety-gauge__value ${isSafe ? 'safety-gauge__value--safe' : 'safety-gauge__value--danger'}`,
        text: Math.round(value).toString(),
      }),
    ],
  });

  // Add threshold indicator text
  const thresholdText = span({
    className: 'safety-gauge__threshold',
    text: `Threshold: ${threshold}`,
  });

  wrapper.appendChild(gauge);
  wrapper.appendChild(valueDisplay);
  wrapper.appendChild(thresholdText);

  return wrapper;
}

export default renderSafetyGauge;
