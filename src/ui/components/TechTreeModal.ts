/**
 * TechTreeModal Component
 *
 * A modal overlay for displaying the Tech Tree.
 * Opens with 'T' key or button click, closes on Escape or backdrop click.
 *
 * Design follows existing modal patterns (EventModal, GamemasterModal):
 * - Width: min(900px, 95vw) - larger modal for tech tree content
 * - Header: "TECH TREE" label, close button
 * - Body: Embedded TabbedTechTree component
 * - Smooth entrance animation (scale + fade)
 */

import { el, div, button, span } from './base.js';
import { createTabbedTechTree, type TabbedTechTreeState } from './TabbedTechTree.js';
import type { FactionState } from '../../core/types.js';
import type { BranchId } from '../../core/types.js';

export interface TechTreeModalCallbacks {
  onClose: () => void;
  onResearch: (techId: string) => void;
}

export interface TechTreeModalState {
  isOpen: boolean;
}

// Animation timing
const ENTRANCE_DURATION = 300;

/**
 * Create the modal overlay element
 */
function createModalOverlay(): HTMLElement {
  return div({
    className: 'tech-tree-modal-overlay',
    id: 'techTreeModalOverlay',
  });
}

/**
 * Create the modal card element
 */
function createModalCard(): HTMLElement {
  return div({
    className: 'tech-tree-modal',
    id: 'techTreeModal',
  });
}

/**
 * Create the modal header
 */
function createModalHeader(onClose: () => void): HTMLElement {
  const header = div({ className: 'tech-tree-modal__header' });

  const label = span({
    className: 'tech-tree-modal__label',
    text: 'TECH TREE',
  });

  const subtitle = span({
    className: 'tech-tree-modal__subtitle',
    text: 'Research new technologies to advance your capabilities',
  });

  const titleContainer = div({ className: 'tech-tree-modal__title-container' });
  titleContainer.appendChild(label);
  titleContainer.appendChild(subtitle);

  const closeBtn = button({
    className: 'tech-tree-modal__close',
    attrs: { 'aria-label': 'Close' },
  });
  closeBtn.textContent = '\u00D7'; // × character
  closeBtn.title = 'Close (Escape)';
  closeBtn.addEventListener('click', onClose);

  header.appendChild(titleContainer);
  header.appendChild(closeBtn);

  return header;
}

/**
 * Create the modal body with tech tree content
 */
function createModalBody(
  faction: FactionState,
  callbacks: TechTreeModalCallbacks,
  initialState: Partial<TabbedTechTreeState>
): { body: HTMLElement; controller: ReturnType<typeof createTabbedTechTree> } {
  const body = div({ className: 'tech-tree-modal__body' });

  // Create the tabbed tech tree inside the modal body
  const controller = createTabbedTechTree(
    body,
    faction,
    {
      activeBranch: initialState.activeBranch || 'capabilities',
      selectedTechId: initialState.selectedTechId || null,
      hoveredTechId: null,
    },
    {
      onResearch: callbacks.onResearch,
      onBranchChange: () => {}, // Branch changes are handled internally
    }
  );

  return { body, controller };
}

/**
 * TechTreeModal class for managing the modal lifecycle
 */
export class TechTreeModal {
  private overlay: HTMLElement | null = null;
  private modal: HTMLElement | null = null;
  private callbacks: TechTreeModalCallbacks;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private tabbedTechTreeController: ReturnType<typeof createTabbedTechTree> | null = null;
  private currentFaction: FactionState | null = null;
  private isClosing = false;

  constructor(callbacks: TechTreeModalCallbacks) {
    this.callbacks = callbacks;
    this.injectStyles();
  }

  /**
   * Open the modal with the tech tree for a faction
   */
  open(
    faction: FactionState,
    initialState: Partial<TabbedTechTreeState> = {}
  ): void {
    if (this.overlay) {
      this.close();
    }

    this.currentFaction = faction;

    // Create overlay
    this.overlay = createModalOverlay();
    this.overlay.addEventListener('click', (e) => {
      // Close on backdrop click
      if (e.target === this.overlay) {
        this.callbacks.onClose();
      }
    });

    // Create modal card
    this.modal = createModalCard();

    // Add header
    const header = createModalHeader(() => this.callbacks.onClose());
    this.modal.appendChild(header);

    // Add body with tech tree content
    const { body, controller } = createModalBody(faction, this.callbacks, initialState);
    this.tabbedTechTreeController = controller;
    this.modal.appendChild(body);

    // Assemble and add to DOM
    this.overlay.appendChild(this.modal);
    document.body.appendChild(this.overlay);

    // Add keyboard handler for Escape
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.callbacks.onClose();
      }
    };
    document.addEventListener('keydown', this.keyHandler);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      this.overlay?.classList.add('is-visible');
      this.modal?.classList.add('is-visible');
    });
  }

  /**
   * Update the tech tree with new faction data
   */
  update(faction: FactionState, state: Partial<TabbedTechTreeState>): void {
    this.currentFaction = faction;
    if (this.tabbedTechTreeController) {
      this.tabbedTechTreeController.update(faction, state);
    }
  }

  /**
   * Close the modal
   */
  close(): void {
    if (!this.overlay || this.isClosing) return;

    this.isClosing = true;

    // Remove keyboard handler
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    // Destroy tech tree controller
    if (this.tabbedTechTreeController) {
      this.tabbedTechTreeController.destroy();
      this.tabbedTechTreeController = null;
    }

    this.overlay.classList.remove('is-visible');
    this.modal?.classList.remove('is-visible');

    // Wait for animation to complete before removing
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.modal = null;
      this.currentFaction = null;
      this.isClosing = false;
    }, ENTRANCE_DURATION);
  }

  /**
   * Check if modal is currently open (and not closing)
   */
  isOpen(): boolean {
    return this.overlay !== null && !this.isClosing;
  }

  /**
   * Get the current faction
   */
  getFaction(): FactionState | null {
    return this.currentFaction;
  }

  /**
   * Inject modal styles into the document
   */
  private injectStyles(): void {
    if (document.getElementById('tech-tree-modal-styles')) return;

    const styleEl = document.createElement('style');
    styleEl.id = 'tech-tree-modal-styles';
    styleEl.textContent = TECH_TREE_MODAL_STYLES;
    document.head.appendChild(styleEl);
  }
}

/**
 * Render a tech tree modal (functional API)
 */
export function renderTechTreeModal(
  faction: FactionState,
  callbacks: TechTreeModalCallbacks,
  initialState: Partial<TabbedTechTreeState> = {}
): TechTreeModal {
  const modal = new TechTreeModal(callbacks);
  modal.open(faction, initialState);
  return modal;
}

/**
 * CSS styles for the TechTreeModal component
 */
export const TECH_TREE_MODAL_STYLES = `
/* Tech Tree Modal Overlay */
.tech-tree-modal-overlay {
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

.tech-tree-modal-overlay.is-visible {
  opacity: 1;
}

/* Tech Tree Modal Card */
.tech-tree-modal {
  background: var(--panel, #ffffff);
  border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
  border-radius: 2px;
  width: min(900px, 95vw);
  max-height: 90vh;
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

.tech-tree-modal.is-visible {
  transform: scale(1) translateY(0);
  opacity: 1;
}

/* Modal Header */
.tech-tree-modal__header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line, rgba(0, 0, 0, 0.08));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tech-tree-modal__title-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tech-tree-modal__label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent, #1a3a2a);
  background: var(--green-bg, rgba(26, 58, 42, 0.06));
  padding: 6px 12px;
  border-radius: 2px;
  display: inline-block;
  width: fit-content;
}

.tech-tree-modal__subtitle {
  font-size: 13px;
  color: var(--text-3, #7a7a7a);
  margin-top: 4px;
}

.tech-tree-modal__close {
  width: 36px;
  height: 36px;
  border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
  border-radius: 2px;
  background: transparent;
  color: var(--text-3, #7a7a7a);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tech-tree-modal__close:hover {
  background: var(--bg, #f4f1ec);
  color: var(--ink, #1a1a1a);
  border-color: var(--accent, #1a3a2a);
}

/* Modal Body */
.tech-tree-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  min-height: 400px;
  max-height: calc(90vh - 80px);
}

/* Override tech-screen styles inside modal */
.tech-tree-modal__body .tech-screen {
  height: 100%;
  border-radius: 0;
  border: none;
}

.tech-tree-modal__body .tech-screen__header {
  display: none;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .tech-tree-modal {
    width: 98vw;
    max-height: 95vh;
    border-radius: 2px;
  }

  .tech-tree-modal__header {
    padding: 16px 20px;
  }

  .tech-tree-modal__body {
    max-height: calc(95vh - 70px);
  }
}
`;
