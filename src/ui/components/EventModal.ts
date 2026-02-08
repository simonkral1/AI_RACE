/**
 * EventModal Component
 *
 * A modal overlay for displaying game events and their choices.
 * Auto-opens when an event is pending and cannot be dismissed until a choice is made.
 *
 * Design follows UI_REDESIGN_PLAN.md specifications:
 * - Header: "EVENT" label, close button (disabled until choice made)
 * - Body: Event title, description, choice buttons with effect previews
 * - Smooth entrance animation (scale + fade)
 * - Choices appear with staggered fade-in
 */

import type { EventDefinition, EventChoice, EventEffect } from '../../data/events.js';
import { el, div, button, span } from './base.js';

export interface EventModalCallbacks {
  onChoice: (choiceId: string) => void;
}

export interface EventModalState {
  event: EventDefinition | null;
  isOpen: boolean;
}

// Animation timing
const ENTRANCE_DURATION = 300;
const CHOICE_STAGGER_DELAY = 80;

/**
 * Format effect preview text with color coding
 */
function formatEffectPreview(effects: EventEffect[]): HTMLElement {
  const container = div({ className: 'event-modal__effects' });

  for (const effect of effects) {
    const delta = 'delta' in effect ? effect.delta : 0;
    const sign = delta >= 0 ? '+' : '';
    const colorClass = delta >= 0 ? 'event-modal__effect--positive' : 'event-modal__effect--negative';

    let label = '';
    switch (effect.kind) {
      case 'resource':
        label = `${sign}${delta} ${effect.key}`;
        break;
      case 'score':
        label = `${sign}${delta} ${effect.key === 'capabilityScore' ? 'capability' : 'safety'}`;
        break;
      case 'stat':
        label = `${sign}${delta} ${effect.key}`;
        break;
      case 'research':
        label = `${sign}${delta} ${effect.branch} research`;
        break;
      case 'globalSafety':
        label = `${sign}${delta} global safety`;
        break;
      case 'exposure':
        label = `${sign}${delta} exposure`;
        break;
    }

    const effectEl = span({
      className: `event-modal__effect ${colorClass}`,
      text: label,
    });
    container.appendChild(effectEl);
  }

  return container;
}

/**
 * Create a choice button element
 */
function createChoiceButton(
  choice: EventChoice,
  index: number,
  onClick: () => void
): HTMLElement {
  const choiceEl = button({
    className: 'event-modal__choice',
    onClick,
  });

  // Add stagger animation delay
  choiceEl.style.animationDelay = `${index * CHOICE_STAGGER_DELAY}ms`;

  const titleEl = div({
    className: 'event-modal__choice-title',
    text: choice.label,
  });

  const descEl = div({
    className: 'event-modal__choice-desc',
    text: choice.description,
  });

  const effectsEl = formatEffectPreview(choice.effects);

  choiceEl.appendChild(titleEl);
  choiceEl.appendChild(descEl);
  choiceEl.appendChild(effectsEl);

  return choiceEl;
}

/**
 * Create the modal overlay element
 */
function createModalOverlay(): HTMLElement {
  return div({
    className: 'event-modal-overlay',
    id: 'eventModalOverlay',
  });
}

/**
 * Create the modal card element
 */
function createModalCard(): HTMLElement {
  return div({
    className: 'event-modal',
    id: 'eventModal',
  });
}

/**
 * Create the modal header
 */
function createModalHeader(): HTMLElement {
  const header = div({ className: 'event-modal__header' });

  const label = span({
    className: 'event-modal__label',
    text: 'EVENT',
  });

  const closeBtn = button({
    className: 'event-modal__close',
    attrs: { disabled: true, 'aria-label': 'Close' },
  });
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Make a choice to continue';

  header.appendChild(label);
  header.appendChild(closeBtn);

  return header;
}

/**
 * Create the modal body with event content
 */
function createModalBody(event: EventDefinition, callbacks: EventModalCallbacks): HTMLElement {
  const body = div({ className: 'event-modal__body' });

  // Event title
  const title = div({
    className: 'event-modal__title',
    text: event.title,
  });

  // Event description
  const description = div({
    className: 'event-modal__description',
    text: event.description,
  });

  // Choices container
  const choicesContainer = div({ className: 'event-modal__choices' });

  // Add choice buttons with staggered animation
  event.choices.forEach((choice, index) => {
    const choiceBtn = createChoiceButton(choice, index, () => {
      callbacks.onChoice(choice.id);
    });
    choicesContainer.appendChild(choiceBtn);
  });

  body.appendChild(title);
  body.appendChild(description);
  body.appendChild(choicesContainer);

  return body;
}

/**
 * EventModal class for managing the modal lifecycle
 */
export class EventModal {
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private callbacks: EventModalCallbacks;
  private currentEvent: EventDefinition | null = null;

  constructor(callbacks: EventModalCallbacks) {
    this.callbacks = callbacks;
    this.injectStyles();
  }

  /**
   * Open the modal with an event
   */
  open(event: EventDefinition): void {
    if (this.overlay) {
      this.close();
    }

    this.currentEvent = event;

    // Create overlay
    this.overlay = createModalOverlay();
    this.overlay.addEventListener('click', (e) => {
      // Prevent closing by clicking overlay - must make a choice
      e.stopPropagation();
    });

    // Create modal card
    this.modal = createModalCard();

    // Add header
    const header = createModalHeader();
    this.modal.appendChild(header);

    // Add body with event content
    const body = createModalBody(event, {
      onChoice: (choiceId) => {
        this.callbacks.onChoice(choiceId);
        this.close();
      },
    });
    this.modal.appendChild(body);

    // Assemble and add to DOM
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      this.overlay?.classList.add('is-visible');
      this.modal?.classList.add('is-visible');
    });
  }

  /**
   * Close the modal
   */
  close(): void {
    if (!this.overlay) return;

    this.overlay.classList.remove('is-visible');
    this.modal?.classList.remove('is-visible');

    // Wait for animation to complete before removing
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.modal = null;
      this.currentEvent = null;
    }, ENTRANCE_DURATION);
  }

  /**
   * Check if modal is currently open
   */
  isOpen(): boolean {
    return this.overlay !== null;
  }

  /**
   * Get the current event
   */
  getEvent(): EventDefinition | null {
    return this.currentEvent;
  }

  /**
   * Inject modal styles into the document
   */
  private injectStyles(): void {
    if (document.getElementById('event-modal-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'event-modal-styles';
    styleEl.textContent = EVENT_MODAL_STYLES;
    document.head.appendChild(styleEl);
  }
}

/**
 * Render an event modal (functional API)
 */
export function renderEventModal(
  event: EventDefinition,
  callbacks: EventModalCallbacks
): EventModal {
  const modal = new EventModal(callbacks);
  modal.open(event);
  return modal;
}

/**
 * CSS styles for the EventModal component
 */
export const EVENT_MODAL_STYLES = `
/* Event Modal Overlay */
.event-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.5);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  z-index: 100;
  opacity: 0;
  transition: opacity var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.event-modal-overlay.is-visible {
  opacity: 1;
}

/* Event Modal Card */
.event-modal {
  background: var(--panel, #ffffff);
  border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
  border-radius: 2px;
  width: min(560px, 90vw);
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15);
  transform: scale(0.95) translateY(10px);
  opacity: 0;
  transition:
    transform var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    opacity var(--duration-slow, 300ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}

.event-modal.is-visible {
  transform: scale(1) translateY(0);
  opacity: 1;
}

/* Modal Header */
.event-modal__header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line, rgba(45, 90, 39, 0.2));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-modal__label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--warning, #8b6914);
  background: var(--warning-bg, rgba(139, 105, 20, 0.06));
  padding: 6px 12px;
  border-radius: 2px;
}

.event-modal__close {
  width: 32px;
  height: 32px;
  border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
  border-radius: 2px;
  background: transparent;
  color: var(--muted, #7d9182);
  font-size: 20px;
  line-height: 1;
  cursor: not-allowed;
  opacity: 0.4;
  transition: all 150ms ease;
}

.event-modal__close:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* Modal Body */
.event-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.event-modal__title {
  font-family: var(--serif, 'IBM Plex Serif', Georgia, serif);
  font-size: 24px;
  font-weight: 700;
  color: var(--ink, #1a1a1a);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.event-modal__title::before {
  content: '';
  font-size: 20px;
}

.event-modal__description {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-2, #4a4a4a);
  padding: 16px;
  background: var(--warning-bg, rgba(139, 105, 20, 0.06));
  border-radius: 2px;
  border-left: 3px solid var(--warning, #8b6914);
  margin-bottom: 24px;
}

/* Choices Container */
.event-modal__choices {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Choice Button */
.event-modal__choice {
  width: 100%;
  text-align: left;
  padding: 16px 20px;
  border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
  border-radius: 2px;
  background: var(--bg, #f4f1ec);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 200ms ease;
  animation: choiceFadeIn 300ms ease-out forwards;
  opacity: 0;
  transform: translateY(10px);
}

@keyframes choiceFadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.event-modal__choice::before {
  content: '';
  position: absolute;
  inset: 0;
  background: transparent;
  opacity: 0;
  transition: opacity 200ms ease;
}

.event-modal__choice:hover {
  border-color: var(--accent, #1a3a2a);
  background: var(--green-bg, rgba(26, 58, 42, 0.06));
  transform: translateX(4px);
}

.event-modal__choice:hover::before {
  opacity: 1;
}

.event-modal__choice:active {
  transform: translateX(2px);
}

.event-modal__choice-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--ink, #1a1a1a);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.event-modal__choice-title::before {
  content: '';
  color: var(--accent-2, #c9a94e);
  opacity: 0;
  transition: opacity 150ms ease;
}

.event-modal__choice:hover .event-modal__choice-title::before {
  opacity: 1;
}

.event-modal__choice-desc {
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted, #7d9182);
  margin-bottom: 12px;
}

/* Effect Preview */
.event-modal__effects {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.event-modal__effect {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 2px;
  text-transform: lowercase;
}

.event-modal__effect--positive {
  color: var(--green-mid, #2d5a42);
  background: var(--green-bg, rgba(26, 58, 42, 0.06));
}

.event-modal__effect--negative {
  color: var(--danger, #8b2020);
  background: var(--danger-bg, rgba(139, 32, 32, 0.06));
}

/* No theme overrides needed - light is default */

/* Responsive adjustments */
@media (max-width: 640px) {
  .event-modal {
    width: 95vw;
    max-height: 90vh;
  }

  .event-modal__header {
    padding: 16px 20px;
  }

  .event-modal__body {
    padding: 20px;
  }

  .event-modal__title {
    font-size: 20px;
  }

  .event-modal__choice {
    padding: 14px 16px;
  }
}
`;
