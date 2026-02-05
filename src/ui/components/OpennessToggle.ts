// Openness toggle component - binary toggle between 'open' and 'secret'
// Visual toggle button with eye/eye-off icons
// Open: eye icon, lighter style
// Secret: eye-off icon, darker/shadowy style

import { Openness } from '../../core/types.js';
import { button, ICONS } from './base.js';

/**
 * Renders a toggle button for openness (open/secret).
 *
 * CSS classes needed:
 * - .openness-toggle: Base button styling
 * - .openness-toggle--open: Open state (lighter, eye icon)
 * - .openness-toggle--secret: Secret state (darker, shadowy)
 * - .openness-toggle__icon: Icon container
 * - .openness-toggle__label: Text label
 *
 * @param value - Current openness state ('open' or 'secret')
 * @param onChange - Callback when toggle is clicked
 */
export function renderOpennessToggle(
  value: Openness,
  onChange: (newValue: Openness) => void
): HTMLElement {
  const isOpen = value === 'open';

  const toggle = button({
    className: `openness-toggle openness-toggle--${value}`,
    onClick: () => {
      const newValue: Openness = isOpen ? 'secret' : 'open';
      onChange(newValue);
    },
  });

  // Add icon
  const iconContainer = document.createElement('span');
  iconContainer.className = 'openness-toggle__icon';
  iconContainer.innerHTML = isOpen ? ICONS.eye : ICONS.eyeOff;
  toggle.appendChild(iconContainer);

  // Add label
  const label = document.createElement('span');
  label.className = 'openness-toggle__label';
  label.textContent = isOpen ? 'Open' : 'Secret';
  toggle.appendChild(label);

  // Add aria attributes for accessibility
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', isOpen ? 'true' : 'false');
  toggle.setAttribute(
    'aria-label',
    isOpen ? 'Currently open, click to make secret' : 'Currently secret, click to make open'
  );
  toggle.setAttribute('title', isOpen ? 'Click to conduct secretly' : 'Click to conduct openly');

  return toggle;
}
