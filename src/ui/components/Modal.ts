// Modal Component - Generic reusable modal overlay system
// Following the UI_REDESIGN_PLAN.md specification

import { el, div, button } from './base.js';

/**
 * Modal configuration options
 */
export interface ModalOptions {
  /** Modal title displayed in header */
  title: string;
  /** Optional subtitle or category tag */
  subtitle?: string;
  /** Modal size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Whether clicking backdrop closes modal */
  closeOnBackdrop?: boolean;
  /** Whether ESC key closes modal */
  closeOnEscape?: boolean;
  /** Custom CSS class for the modal card */
  className?: string;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Callback when modal is opened (after animation) */
  onOpen?: () => void;
}

/**
 * Modal footer button configuration
 */
export interface ModalButton {
  /** Button label text */
  label: string;
  /** Button style variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick: () => void;
}

/**
 * Modal instance returned by createModal
 */
export interface ModalInstance {
  /** The modal overlay element */
  element: HTMLElement;
  /** The modal card element */
  card: HTMLElement;
  /** The modal body element (for content) */
  body: HTMLElement;
  /** Show the modal with animation */
  show: () => void;
  /** Hide the modal with animation */
  hide: () => void;
  /** Update the modal title */
  setTitle: (title: string) => void;
  /** Update the modal body content */
  setContent: (content: HTMLElement | string) => void;
  /** Update the modal footer buttons */
  setFooter: (buttons: ModalButton[]) => void;
  /** Destroy the modal and remove from DOM */
  destroy: () => void;
  /** Check if modal is currently visible */
  isVisible: () => boolean;
}

// Size to CSS class mapping
const SIZE_CLASSES: Record<string, string> = {
  sm: 'modal-card--sm',
  md: 'modal-card--md',
  lg: 'modal-card--lg',
  xl: 'modal-card--xl',
};

/**
 * Create a reusable modal instance
 */
export function createModal(options: ModalOptions): ModalInstance {
  const {
    title,
    subtitle,
    size = 'md',
    closeOnBackdrop = true,
    closeOnEscape = true,
    className = '',
    onClose,
    onOpen,
  } = options;

  let isVisible = false;
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Create overlay
  const overlay = div({
    className: 'modal-overlay',
    attrs: { 'aria-modal': 'true', role: 'dialog' },
  });

  // Create card with size class
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const card = div({
    className: `modal-card ${sizeClass} ${className}`.trim(),
  });

  // Create header
  const header = div({ className: 'modal-header' });

  const titleContainer = div({ className: 'modal-title-container' });
  const titleEl = el('h2', { className: 'modal-title', text: title });
  titleContainer.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = span({ className: 'modal-subtitle', text: subtitle });
    titleContainer.appendChild(subtitleEl);
  }

  const closeBtn = button({
    className: 'modal-close',
    html: '&times;',
    attrs: { 'aria-label': 'Close modal', type: 'button' },
    onClick: () => hide(),
  });

  header.appendChild(titleContainer);
  header.appendChild(closeBtn);

  // Create body (scrollable content area)
  const body = div({ className: 'modal-body' });

  // Create footer (action buttons)
  const footer = div({ className: 'modal-footer' });

  // Assemble card
  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  overlay.appendChild(card);

  // Handle backdrop click
  if (closeOnBackdrop) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        hide();
      }
    });
  }

  // Show modal with animation
  function show(): void {
    if (isVisible) return;

    document.body.appendChild(overlay);
    // Force reflow for animation
    void overlay.offsetHeight;

    overlay.classList.add('modal-overlay--visible');
    card.classList.add('modal-card--visible');
    isVisible = true;

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Setup ESC key handler
    if (closeOnEscape) {
      keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          hide();
        }
      };
      document.addEventListener('keydown', keydownHandler);
    }

    // Focus the modal for accessibility
    card.setAttribute('tabindex', '-1');
    card.focus();

    // Trigger onOpen callback after animation
    if (onOpen) {
      setTimeout(onOpen, 300);
    }
  }

  // Hide modal with animation
  function hide(): void {
    if (!isVisible) return;

    overlay.classList.remove('modal-overlay--visible');
    card.classList.remove('modal-card--visible');

    // Remove keydown handler
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Remove from DOM after animation
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      isVisible = false;

      if (onClose) {
        onClose();
      }
    }, 300);
  }

  // Update title
  function setTitle(newTitle: string): void {
    titleEl.textContent = newTitle;
  }

  // Update body content
  function setContent(content: HTMLElement | string): void {
    body.innerHTML = '';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
  }

  // Update footer buttons
  function setFooter(buttons: ModalButton[]): void {
    footer.innerHTML = '';

    if (buttons.length === 0) {
      footer.style.display = 'none';
      return;
    }

    footer.style.display = '';

    for (const btn of buttons) {
      const variantClass =
        btn.variant === 'primary'
          ? 'btn--primary'
          : btn.variant === 'danger'
            ? 'btn--danger'
            : btn.variant === 'ghost'
              ? 'btn--ghost'
              : 'btn--secondary';

      const buttonEl = button({
        className: `btn ${variantClass}`,
        text: btn.label,
        attrs: { type: 'button' },
        onClick: btn.onClick,
      });

      if (btn.disabled) {
        buttonEl.disabled = true;
      }

      footer.appendChild(buttonEl);
    }
  }

  // Destroy modal
  function destroy(): void {
    hide();
    // Ensure cleanup after animation
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 350);
  }

  return {
    element: overlay,
    card,
    body,
    show,
    hide,
    setTitle,
    setContent,
    setFooter,
    destroy,
    isVisible: () => isVisible,
  };
}

/**
 * Quick helper to show a simple modal with content
 */
export function showModal(
  title: string,
  content: HTMLElement | string,
  options: Partial<ModalOptions> = {}
): ModalInstance {
  const modal = createModal({ title, ...options });
  modal.setContent(content);
  modal.show();
  return modal;
}

/**
 * Show a confirmation modal with Yes/No buttons
 */
export function showConfirmModal(
  title: string,
  message: string,
  onConfirm: () => void,
  options: Partial<ModalOptions> = {}
): ModalInstance {
  const modal = createModal({
    title,
    size: 'sm',
    ...options,
  });

  const messageEl = div({
    className: 'modal-message',
    text: message,
  });

  modal.setContent(messageEl);
  modal.setFooter([
    {
      label: 'Cancel',
      variant: 'ghost',
      onClick: () => modal.hide(),
    },
    {
      label: 'Confirm',
      variant: 'primary',
      onClick: () => {
        onConfirm();
        modal.hide();
      },
    },
  ]);

  modal.show();
  return modal;
}

// Helper span function not in base.ts
function span(options: { className?: string; text?: string } = {}): HTMLSpanElement {
  const element = document.createElement('span');
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  return element;
}

/**
 * CSS styles for the modal system
 * These should be added to the main stylesheet
 */
export const MODAL_STYLES = `
/* ================================================
   MODAL SYSTEM
   ================================================ */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.5);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--duration-slow) var(--ease-out),
              visibility var(--duration-slow) var(--ease-out);
}

.modal-overlay--visible {
  opacity: 1;
  visibility: visible;
}

/* Modal Card */
.modal-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 2px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-modal);
  transform: translateY(20px) scale(0.95);
  opacity: 0;
  transition: transform var(--duration-slow) var(--ease-out),
              opacity var(--duration-slow) var(--ease-out);
}

.modal-card--visible {
  transform: translateY(0) scale(1);
  opacity: 1;
}

/* Size variants */
.modal-card--sm {
  width: min(400px, 90vw);
}

.modal-card--md {
  width: min(500px, 90vw);
}

.modal-card--lg {
  width: min(600px, 90vw);
}

.modal-card--xl {
  width: min(800px, 95vw);
  max-height: 90vh;
}

/* Modal Header */
.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.modal-title-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}

.modal-subtitle {
  font-size: 12px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.modal-close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  color: var(--muted);
  cursor: pointer;
  padding: 0 4px;
  transition: color var(--duration-fast) ease;
}

.modal-close:hover {
  color: var(--ink);
}

.modal-close:focus {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Modal Body */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 2px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}

/* Modal Footer */
.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.modal-footer:empty {
  display: none;
}

/* Modal Message (for confirm dialogs) */
.modal-message {
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
}

`;
