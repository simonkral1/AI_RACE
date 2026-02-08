import { el, div, span, button } from './base.js';
import { GameState } from '../../core/types.js';

/**
 * GamemasterModal - Modal interface for the Gamemaster AI
 *
 * Design specs (from UI_REDESIGN_PLAN.md):
 * - Width: 600px
 * - Quick Actions: horizontal button row
 * - Chat area: scrollable, bottom-anchored
 * - Input: bottom-fixed
 * - Loading state: animated dots
 */

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

export type QuickActionType =
  | 'what-should-i-do'
  | 'explain-safety'
  | 'explain-capability'
  | 'get-summary';

export type GamemasterModalOptions = {
  state: GameState;
  onSendMessage: (message: string) => void;
  onQuickAction: (action: QuickActionType) => void;
  onClose: () => void;
  chatHistory?: ChatMessage[];
  isLoading?: boolean;
  factionId?: string;
};

export type GamemasterModalUpdateOptions = {
  chatHistory?: ChatMessage[];
  isLoading?: boolean;
  state?: GameState;
};

// Quick action definitions (reduced set for modal)
const QUICK_ACTIONS: { id: QuickActionType; label: string }[] = [
  { id: 'what-should-i-do', label: 'What should I do?' },
  { id: 'explain-safety', label: 'Explain safety' },
  { id: 'explain-capability', label: 'Explain capability' },
  { id: 'get-summary', label: 'Game Summary' },
];

// Create a chat message bubble
const createMessageElement = (message: ChatMessage): HTMLElement => {
  const isUser = message.role === 'user';

  const messageDiv = div({
    className: `gm-modal-message gm-modal-message--${message.role}`,
  });

  const bubble = div({
    className: 'gm-modal-message__bubble',
    text: message.content,
  });

  messageDiv.appendChild(bubble);

  return messageDiv;
};

// Create the loading indicator with animated dots
const createLoadingIndicator = (): HTMLElement => {
  return div({
    className: 'gm-modal-loading',
    children: [
      span({ className: 'gm-modal-loading__dot' }),
      span({ className: 'gm-modal-loading__dot' }),
      span({ className: 'gm-modal-loading__dot' }),
    ],
  });
};

// Create the chat area
const createChatArea = (
  messages: ChatMessage[],
  isLoading: boolean
): HTMLElement => {
  const chatArea = div({ className: 'gm-modal-chat' });

  if (messages.length === 0 && !isLoading) {
    const emptyState = div({
      className: 'gm-modal-chat__empty',
      text: 'Ask the Gamemaster about game mechanics, strategy, or the current situation.',
    });
    chatArea.appendChild(emptyState);
  } else {
    for (const message of messages) {
      chatArea.appendChild(createMessageElement(message));
    }
  }

  if (isLoading) {
    const loadingWrapper = div({
      className: 'gm-modal-message gm-modal-message--assistant',
    });
    loadingWrapper.appendChild(createLoadingIndicator());
    chatArea.appendChild(loadingWrapper);
  }

  // Schedule scroll to bottom
  requestAnimationFrame(() => {
    chatArea.scrollTop = chatArea.scrollHeight;
  });

  return chatArea;
};

// Create quick action buttons row
const createQuickActions = (
  onQuickAction: (action: QuickActionType) => void,
  isLoading: boolean
): HTMLElement => {
  const container = div({ className: 'gm-modal-quick-actions' });

  for (const action of QUICK_ACTIONS) {
    const btn = button({
      className: 'gm-modal-quick-btn',
      text: action.label,
      attrs: { disabled: isLoading },
      dataset: { action: action.id },
    });

    btn.addEventListener('click', () => {
      if (!isLoading) {
        onQuickAction(action.id);
      }
    });

    container.appendChild(btn);
  }

  return container;
};

// Create the input section
const createInputSection = (
  onSendMessage: (message: string) => void,
  isLoading: boolean
): HTMLElement => {
  const inputSection = div({ className: 'gm-modal-input-section' });

  const input = el('input', {
    className: 'gm-modal-input',
    attrs: {
      type: 'text',
      placeholder: 'Ask the Gamemaster...',
      disabled: isLoading,
    },
  }) as HTMLInputElement;

  const sendBtn = button({
    className: 'gm-modal-send-btn',
    text: 'Send',
    attrs: { disabled: isLoading },
  });

  const handleSend = () => {
    const value = input.value.trim();
    if (value && !isLoading) {
      onSendMessage(value);
      input.value = '';
    }
  };

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  });

  inputSection.appendChild(input);
  inputSection.appendChild(sendBtn);

  // Store input reference for focus
  (inputSection as any).__gmInput = input;

  return inputSection;
};

// Create the modal header
const createHeader = (onClose: () => void): HTMLElement => {
  const header = div({ className: 'gm-modal-header' });

  const title = span({
    className: 'gm-modal-header__title',
    text: 'GAMEMASTER',
  });

  const closeBtn = button({
    className: 'gm-modal-close',
    html: '&times;',
  });

  closeBtn.addEventListener('click', onClose);

  header.appendChild(title);
  header.appendChild(closeBtn);

  return header;
};

/**
 * Render the Gamemaster Modal
 */
export const renderGamemasterModal = (options: GamemasterModalOptions): HTMLElement => {
  const {
    state,
    onSendMessage,
    onQuickAction,
    onClose,
    chatHistory = [],
    isLoading = false,
  } = options;

  // Create overlay
  const overlay = div({ className: 'gm-modal-overlay' });

  // Create modal card
  const modal = div({ className: 'gm-modal-card' });

  // Header with close button
  const header = createHeader(onClose);

  // Quick actions row
  const quickActions = createQuickActions(onQuickAction, isLoading);

  // Chat area (scrollable)
  const chatArea = createChatArea(chatHistory, isLoading);

  // Input section (bottom-fixed)
  const inputSection = createInputSection(onSendMessage, isLoading);

  // Assemble modal
  modal.appendChild(header);
  modal.appendChild(quickActions);
  modal.appendChild(chatArea);
  modal.appendChild(inputSection);

  overlay.appendChild(modal);

  // Close on overlay click (not modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      onClose();
    }
  });

  // Close on Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // Store references for updates
  (overlay as any).__gmChatArea = chatArea;
  (overlay as any).__gmQuickActions = quickActions;
  (overlay as any).__gmInputSection = inputSection;
  (overlay as any).__gmOptions = options;
  (overlay as any).__gmKeyHandler = handleKeyDown;

  // Focus input after render
  requestAnimationFrame(() => {
    const input = (inputSection as any).__gmInput as HTMLInputElement;
    if (input) {
      input.focus();
    }
  });

  return overlay;
};

/**
 * Update the Gamemaster Modal with new data
 */
export const updateGamemasterModal = (
  overlay: HTMLElement,
  updates: GamemasterModalUpdateOptions
): void => {
  const options = (overlay as any).__gmOptions as GamemasterModalOptions;
  if (!options) return;

  // Merge updates
  if (updates.chatHistory !== undefined) {
    options.chatHistory = updates.chatHistory;
  }
  if (updates.isLoading !== undefined) {
    options.isLoading = updates.isLoading;
  }
  if (updates.state !== undefined) {
    options.state = updates.state;
  }

  // Update chat area
  const oldChatArea = (overlay as any).__gmChatArea as HTMLElement;
  if (oldChatArea) {
    const newChatArea = createChatArea(
      options.chatHistory ?? [],
      options.isLoading ?? false
    );
    oldChatArea.replaceWith(newChatArea);
    (overlay as any).__gmChatArea = newChatArea;
  }

  // Update quick actions if loading state changed
  if (updates.isLoading !== undefined) {
    const oldQuickActions = (overlay as any).__gmQuickActions as HTMLElement;
    if (oldQuickActions) {
      const newQuickActions = createQuickActions(
        options.onQuickAction,
        options.isLoading ?? false
      );
      oldQuickActions.replaceWith(newQuickActions);
      (overlay as any).__gmQuickActions = newQuickActions;
    }

    const oldInputSection = (overlay as any).__gmInputSection as HTMLElement;
    if (oldInputSection) {
      const newInputSection = createInputSection(
        options.onSendMessage,
        options.isLoading ?? false
      );
      oldInputSection.replaceWith(newInputSection);
      (overlay as any).__gmInputSection = newInputSection;
    }
  }
};

/**
 * Show the Gamemaster Modal
 */
export const showGamemasterModal = (options: GamemasterModalOptions): HTMLElement => {
  const overlay = renderGamemasterModal(options);
  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('gm-modal-overlay--visible');
  });

  return overlay;
};

/**
 * Hide and remove the Gamemaster Modal
 */
export const hideGamemasterModal = (overlay: HTMLElement): void => {
  // Remove keyboard handler
  const keyHandler = (overlay as any).__gmKeyHandler;
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler);
  }

  // Trigger close animation
  overlay.classList.remove('gm-modal-overlay--visible');

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
  }, 250);
};

/**
 * Inject styles for the Gamemaster Modal
 */
export const injectGamemasterModalStyles = (): void => {
  const styleId = 'gamemaster-modal-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* Gamemaster Modal Overlay */
    .gm-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(26, 26, 26, 0);
      backdrop-filter: blur(0px);
      display: grid;
      place-items: center;
      z-index: 1000;
      transition: background var(--duration-normal, 250ms) var(--ease-out, ease-out),
                  backdrop-filter var(--duration-normal, 250ms) var(--ease-out, ease-out);
    }

    .gm-modal-overlay--visible {
      background: rgba(26, 26, 26, 0.5);
      backdrop-filter: blur(8px);
    }

    /* Modal Card */
    .gm-modal-card {
      background: var(--panel, #ffffff);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      border-radius: 2px;
      width: min(600px, 90vw);
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15);
      transform: translateY(20px);
      opacity: 0;
      transition: transform var(--duration-normal, 250ms) var(--ease-out, ease-out),
                  opacity var(--duration-normal, 250ms) var(--ease-out, ease-out);
    }

    .gm-modal-overlay--visible .gm-modal-card {
      transform: translateY(0);
      opacity: 1;
    }

    /* Header */
    .gm-modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--line, rgba(45, 90, 39, 0.2));
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .gm-modal-header__title {
      font-family: var(--mono, 'IBM Plex Mono', monospace);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.15em;
      color: var(--text-3, #7a7a7a);
      text-transform: uppercase;
    }

    .gm-modal-close {
      width: 32px;
      height: 32px;
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      background: transparent;
      border-radius: 2px;
      font-size: 24px;
      color: var(--text-3, #7a7a7a);
      cursor: pointer;
      transition: all 0.1s;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .gm-modal-close:hover {
      background: var(--bg, #f4f1ec);
      color: var(--ink, #1a1a1a);
    }

    /* Quick Actions Row */
    .gm-modal-quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--line, rgba(45, 90, 39, 0.2));
    }

    .gm-modal-quick-btn {
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 2px;
      background: var(--panel, #ffffff);
      color: var(--text-2, #4a4a4a);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      cursor: pointer;
      transition: all 0.1s;
      font-family: inherit;
    }

    .gm-modal-quick-btn:hover:not(:disabled) {
      background: var(--accent, #1a3a2a);
      color: white;
      border-color: var(--accent, #1a3a2a);
    }

    .gm-modal-quick-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Chat Area */
    .gm-modal-chat {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 200px;
      max-height: 400px;
    }

    .gm-modal-chat__empty {
      color: var(--muted, #7d9182);
      font-size: 14px;
      text-align: center;
      padding: 40px 20px;
      line-height: 1.6;
    }

    /* Message Bubbles */
    .gm-modal-message {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gm-modal-message--user {
      align-items: flex-end;
    }

    .gm-modal-message--assistant {
      align-items: flex-start;
    }

    .gm-modal-message__bubble {
      padding: 12px 16px;
      border-radius: 2px;
      font-size: 14px;
      line-height: 1.6;
      max-width: 85%;
    }

    .gm-modal-message--user .gm-modal-message__bubble {
      background: var(--accent, #1a3a2a);
      color: white;
    }

    .gm-modal-message--assistant .gm-modal-message__bubble {
      background: var(--bg, #f4f1ec);
      color: var(--ink, #1a1a1a);
    }

    /* Loading Indicator */
    .gm-modal-loading {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 12px 16px;
      background: var(--bg, #f4f1ec);
      border-radius: 2px;
    }

    .gm-modal-loading__dot {
      width: 8px;
      height: 8px;
      background: var(--accent, #2d5a27);
      border-radius: 50%;
      animation: gm-modal-pulse 1.4s ease-in-out infinite both;
    }

    .gm-modal-loading__dot:nth-child(1) { animation-delay: -0.32s; }
    .gm-modal-loading__dot:nth-child(2) { animation-delay: -0.16s; }
    .gm-modal-loading__dot:nth-child(3) { animation-delay: 0s; }

    @keyframes gm-modal-pulse {
      0%, 80%, 100% {
        opacity: 0.3;
        transform: scale(0.8);
      }
      40% {
        opacity: 1;
        transform: scale(1);
      }
    }

    /* Input Section */
    .gm-modal-input-section {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      background: var(--bg-warm, #eae7e1);
    }

    .gm-modal-input {
      flex: 1;
      padding: 10px 14px;
      font-size: 13px;
      border-radius: 2px;
      background: var(--panel, #ffffff);
      color: var(--ink, #1a1a1a);
      border: 1px solid var(--line, rgba(0, 0, 0, 0.08));
      outline: none;
      transition: border-color 0.1s;
      font-family: inherit;
    }

    .gm-modal-input:focus {
      border-color: var(--accent, #1a3a2a);
    }

    .gm-modal-input:disabled {
      opacity: 0.5;
    }

    .gm-modal-input::placeholder {
      color: var(--text-4, #aaaaaa);
    }

    .gm-modal-send-btn {
      padding: 10px 20px;
      font-size: 11px;
      font-weight: 600;
      font-family: var(--mono, 'IBM Plex Mono', monospace);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-radius: 2px;
      background: var(--accent, #1a3a2a);
      color: white;
      border: none;
      cursor: pointer;
      transition: background 0.1s;
    }

    .gm-modal-send-btn:hover:not(:disabled) {
      background: var(--accent-bright, #2d5a42);
    }

    .gm-modal-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* No theme overrides needed - light is default */
  `;

  document.head.appendChild(style);
};
