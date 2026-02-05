// TurnTimeline.ts - Horizontal timeline showing game progress
import { div, span } from './base.js';

export interface TurnTimelineOptions {
  startYear?: number;
  endYear?: number;
  showTurnCounter?: boolean;
}

/**
 * Renders a horizontal timeline: 2026 **** 2027 **** 2028...
 * Filled dots = completed quarters, empty dots = future quarters
 */
export function renderTurnTimeline(
  year: number,
  quarter: number,
  options: TurnTimelineOptions = {}
): HTMLElement {
  const { startYear = 2026, endYear = 2033, showTurnCounter = true } = options;

  const totalYears = endYear - startYear + 1;
  const totalTurns = totalYears * 4; // 4 quarters per year
  const currentTurn = (year - startYear) * 4 + quarter;

  const wrapper = div({ className: 'turn-timeline' });

  // Turn counter
  if (showTurnCounter) {
    const counter = div({
      className: 'turn-timeline__counter',
      children: [
        span({ className: 'turn-timeline__turn-label', text: 'Turn' }),
        span({
          className: 'turn-timeline__turn-value',
          text: `${currentTurn}/${totalTurns}`,
        }),
      ],
    });
    wrapper.appendChild(counter);
  }

  // Timeline track
  const track = div({ className: 'turn-timeline__track' });

  for (let y = startYear; y <= endYear; y++) {
    // Year label
    const yearLabel = span({
      className: `turn-timeline__year ${y === year ? 'turn-timeline__year--current' : ''}`,
      text: y.toString(),
    });
    track.appendChild(yearLabel);

    // Quarter dots for this year
    const dotsContainer = div({ className: 'turn-timeline__dots' });
    for (let q = 1; q <= 4; q++) {
      const turnNumber = (y - startYear) * 4 + q;
      const isCompleted = turnNumber < currentTurn;
      const isCurrent = y === year && q === quarter;

      const dot = span({
        className: [
          'turn-timeline__dot',
          isCompleted ? 'turn-timeline__dot--completed' : '',
          isCurrent ? 'turn-timeline__dot--current' : '',
          !isCompleted && !isCurrent ? 'turn-timeline__dot--future' : '',
        ]
          .filter(Boolean)
          .join(' '),
      });
      dotsContainer.appendChild(dot);
    }
    track.appendChild(dotsContainer);
  }

  wrapper.appendChild(track);

  return wrapper;
}

export default renderTurnTimeline;
