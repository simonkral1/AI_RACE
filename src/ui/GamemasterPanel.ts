import { el, div, span, button, ICONS } from './components/base.js';
import { GameState } from '../core/types.js';

/**
 * GamemasterPanel - Interactive UI for the Gamemaster AI
 *
 * Features:
 * - Chat interface for asking questions
 * - Quick action buttons for common queries
 * - Current narrative display
 * - Loading states
 */

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

export type QuickActionType =
  | 'explain-safety'
  | 'explain-capability'
  | 'explain-actions'
  | 'get-advice'
  | 'get-summary'
  | 'what-should-i-do';

export type GamemasterPanelOptions = {
  state: GameState;
  onSendMessage: (message: string) => void;
  onQuickAction: (action: QuickActionType) => void;
  chatHistory?: ChatMessage[];
  currentNarrative?: string;
  isLoading?: boolean;
  factionId?: string;
};

export type GamemasterPanelUpdateOptions = {
  chatHistory?: ChatMessage[];
  currentNarrative?: string;
  isLoading?: boolean;
  state?: GameState;
};

// Quick action definitions
const QUICK_ACTIONS: { id: QuickActionType; label: string; icon: string }[] = [
  { id: 'explain-safety', label: 'Explain Safety', icon: '🛡️' },
  { id: 'explain-capability', label: 'Explain Capability', icon: '⚡' },
  { id: 'get-advice', label: 'What Should I Do?', icon: '🎯' },
  { id: 'get-summary', label: 'Game Summary', icon: '📊' },
];

// Create a chat message element
const createMessageElement = (message: ChatMessage): HTMLElement => {
  const isUser = message.role === 'user';
  const messageDiv = div({
    className: `gm-message gm-message--${message.role}`,
  });

  const roleLabel = span({
    className: 'gm-message__role',
    text: isUser ? 'You' : 'Gamemaster',
  });

  const content = div({
    className: 'gm-message__content',
    text: message.content,
  });

  messageDiv.appendChild(roleLabel);
  messageDiv.appendChild(content);

  return messageDiv;
};

// Create the loading indicator
const createLoadingIndicator = (): HTMLElement => {
  return div({
    className: 'gm-loading',
    children: [
      span({ className: 'gm-loading__dot' }),
      span({ className: 'gm-loading__dot' }),
      span({ className: 'gm-loading__dot' }),
    ],
  });
};

// Create the chat input area
const createInputArea = (
  onSendMessage: (message: string) => void,
  isLoading: boolean
): HTMLElement => {
  const inputContainer = div({ className: 'gm-input-container' });

  const input = el('input', {
    className: 'gm-input',
    attrs: {
      type: 'text',
      placeholder: 'Ask the Gamemaster...',
      disabled: isLoading,
    },
  });

  const sendBtn = button({
    className: 'gm-send-btn',
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

  inputContainer.appendChild(input);
  inputContainer.appendChild(sendBtn);

  return inputContainer;
};

// Create quick action buttons
const createQuickActions = (
  onQuickAction: (action: QuickActionType) => void,
  isLoading: boolean
): HTMLElement => {
  const container = div({ className: 'gm-quick-actions' });

  for (const action of QUICK_ACTIONS) {
    const btn = button({
      className: 'gm-quick-btn',
      text: `${action.icon} ${action.label}`,
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

// Create the narrative display section
const createNarrativeSection = (narrative?: string): HTMLElement => {
  const section = div({ className: 'gm-narrative' });

  const header = div({
    className: 'gm-narrative__header',
    text: 'Current Narrative',
  });

  const content = div({
    className: 'gm-narrative__content',
    text: narrative ?? 'The race for AGI begins...',
  });

  section.appendChild(header);
  section.appendChild(content);

  return section;
};

// Create the chat history section
const createChatSection = (
  messages: ChatMessage[],
  isLoading: boolean
): HTMLElement => {
  const section = div({ className: 'gm-chat' });

  if (messages.length === 0) {
    const emptyState = div({
      className: 'gm-chat__empty',
      text: 'Ask the Gamemaster about game mechanics, strategy, or what\'s happening in the world.',
    });
    section.appendChild(emptyState);
  } else {
    for (const message of messages) {
      section.appendChild(createMessageElement(message));
    }
  }

  if (isLoading) {
    section.appendChild(createLoadingIndicator());
  }

  // Auto-scroll to bottom
  setTimeout(() => {
    section.scrollTop = section.scrollHeight;
  }, 0);

  return section;
};

// Main render function
export const renderGamemasterPanel = (options: GamemasterPanelOptions): HTMLElement => {
  const {
    state,
    onSendMessage,
    onQuickAction,
    chatHistory = [],
    currentNarrative,
    isLoading = false,
  } = options;

  const panel = div({ className: 'gamemaster-panel' });

  // Header
  const header = div({
    className: 'gm-header',
    children: [
      span({ className: 'gm-header__icon', text: '🎭' }),
      span({ className: 'gm-header__title', text: 'Gamemaster' }),
    ],
  });

  // Narrative section
  const narrativeSection = createNarrativeSection(currentNarrative);

  // Chat section
  const chatSection = createChatSection(chatHistory, isLoading);

  // Quick actions
  const quickActions = createQuickActions(onQuickAction, isLoading);

  // Input area
  const inputArea = createInputArea(onSendMessage, isLoading);

  // Assemble panel
  panel.appendChild(header);
  panel.appendChild(narrativeSection);
  panel.appendChild(chatSection);
  panel.appendChild(quickActions);
  panel.appendChild(inputArea);

  // Store references for updates
  (panel as any).__gmChatSection = chatSection;
  (panel as any).__gmNarrativeSection = narrativeSection;
  (panel as any).__gmQuickActions = quickActions;
  (panel as any).__gmInputArea = inputArea;
  (panel as any).__gmOptions = options;

  return panel;
};

// Update function to refresh parts of the panel
export const updateGamemasterPanel = (
  panel: HTMLElement,
  updates: GamemasterPanelUpdateOptions
): void => {
  const options = (panel as any).__gmOptions as GamemasterPanelOptions;
  if (!options) return;

  // Merge updates
  if (updates.chatHistory !== undefined) {
    options.chatHistory = updates.chatHistory;
  }
  if (updates.currentNarrative !== undefined) {
    options.currentNarrative = updates.currentNarrative;
  }
  if (updates.isLoading !== undefined) {
    options.isLoading = updates.isLoading;
  }
  if (updates.state !== undefined) {
    options.state = updates.state;
  }

  // Update chat section
  const oldChatSection = (panel as any).__gmChatSection as HTMLElement;
  if (oldChatSection) {
    const newChatSection = createChatSection(
      options.chatHistory ?? [],
      options.isLoading ?? false
    );
    oldChatSection.replaceWith(newChatSection);
    (panel as any).__gmChatSection = newChatSection;
  }

  // Update narrative section
  const oldNarrativeSection = (panel as any).__gmNarrativeSection as HTMLElement;
  if (oldNarrativeSection && updates.currentNarrative !== undefined) {
    const newNarrativeSection = createNarrativeSection(updates.currentNarrative);
    oldNarrativeSection.replaceWith(newNarrativeSection);
    (panel as any).__gmNarrativeSection = newNarrativeSection;
  }

  // Update quick actions if loading state changed
  if (updates.isLoading !== undefined) {
    const oldQuickActions = (panel as any).__gmQuickActions as HTMLElement;
    if (oldQuickActions) {
      const newQuickActions = createQuickActions(
        options.onQuickAction,
        options.isLoading ?? false
      );
      oldQuickActions.replaceWith(newQuickActions);
      (panel as any).__gmQuickActions = newQuickActions;
    }

    const oldInputArea = (panel as any).__gmInputArea as HTMLElement;
    if (oldInputArea) {
      const newInputArea = createInputArea(
        options.onSendMessage,
        options.isLoading ?? false
      );
      oldInputArea.replaceWith(newInputArea);
      (panel as any).__gmInputArea = newInputArea;
    }
  }
};

// Add styles for the panel (can be moved to CSS file)
export const injectGamemasterStyles = (): void => {
  const styleId = 'gamemaster-panel-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .gamemaster-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--surface-dark, #1a1a2e);
      border-radius: 8px;
      overflow: hidden;
    }

    .gm-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--surface-darker, #16213e);
      border-bottom: 1px solid var(--border-color, #2d3748);
    }

    .gm-header__icon {
      font-size: 1.25rem;
    }

    .gm-header__title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary, #e2e8f0);
    }

    .gm-narrative {
      padding: 12px 16px;
      background: var(--surface-medium, #1e2a3a);
      border-bottom: 1px solid var(--border-color, #2d3748);
    }

    .gm-narrative__header {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #a0aec0);
      margin-bottom: 4px;
    }

    .gm-narrative__content {
      font-size: 0.875rem;
      color: var(--text-primary, #e2e8f0);
      line-height: 1.5;
      font-style: italic;
    }

    .gm-chat {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 120px;
    }

    .gm-chat__empty {
      color: var(--text-muted, #718096);
      font-size: 0.875rem;
      text-align: center;
      padding: 24px 16px;
    }

    .gm-message {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .gm-message--user {
      align-items: flex-end;
    }

    .gm-message--assistant {
      align-items: flex-start;
    }

    .gm-message__role {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #a0aec0);
    }

    .gm-message__content {
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.875rem;
      line-height: 1.5;
      max-width: 85%;
    }

    .gm-message--user .gm-message__content {
      background: var(--accent-color, #3182ce);
      color: white;
      border-bottom-right-radius: 2px;
    }

    .gm-message--assistant .gm-message__content {
      background: var(--surface-medium, #1e2a3a);
      color: var(--text-primary, #e2e8f0);
      border-bottom-left-radius: 2px;
    }

    .gm-loading {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
    }

    .gm-loading__dot {
      width: 6px;
      height: 6px;
      background: var(--accent-color, #3182ce);
      border-radius: 50%;
      animation: gm-loading-pulse 1.4s ease-in-out infinite both;
    }

    .gm-loading__dot:nth-child(1) { animation-delay: -0.32s; }
    .gm-loading__dot:nth-child(2) { animation-delay: -0.16s; }
    .gm-loading__dot:nth-child(3) { animation-delay: 0s; }

    @keyframes gm-loading-pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }

    .gm-quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 16px;
      border-top: 1px solid var(--border-color, #2d3748);
      background: var(--surface-dark, #1a1a2e);
    }

    .gm-quick-btn {
      padding: 6px 10px;
      font-size: 0.75rem;
      border-radius: 4px;
      background: var(--surface-medium, #1e2a3a);
      color: var(--text-secondary, #a0aec0);
      border: 1px solid var(--border-color, #2d3748);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .gm-quick-btn:hover:not(:disabled) {
      background: var(--surface-hover, #2a3f5f);
      color: var(--text-primary, #e2e8f0);
      border-color: var(--accent-color, #3182ce);
    }

    .gm-quick-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .gm-input-container {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--border-color, #2d3748);
      background: var(--surface-darker, #16213e);
    }

    .gm-input {
      flex: 1;
      padding: 8px 12px;
      font-size: 0.875rem;
      border-radius: 4px;
      background: var(--surface-dark, #1a1a2e);
      color: var(--text-primary, #e2e8f0);
      border: 1px solid var(--border-color, #2d3748);
      outline: none;
      transition: border-color 0.15s ease;
    }

    .gm-input:focus {
      border-color: var(--accent-color, #3182ce);
    }

    .gm-input:disabled {
      opacity: 0.5;
    }

    .gm-input::placeholder {
      color: var(--text-muted, #718096);
    }

    .gm-send-btn {
      padding: 8px 16px;
      font-size: 0.875rem;
      font-weight: 500;
      border-radius: 4px;
      background: var(--accent-color, #3182ce);
      color: white;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .gm-send-btn:hover:not(:disabled) {
      background: var(--accent-hover, #2c5282);
    }

    .gm-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(style);
};
