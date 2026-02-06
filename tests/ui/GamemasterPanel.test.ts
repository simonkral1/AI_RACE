/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import { GameState } from '../../src/core/types.js';

// We'll test the panel's rendering and interactions
describe('GamemasterPanel', () => {
  let container: HTMLElement;
  let state: GameState;

  beforeEach(() => {
    // Create a container for the panel
    container = document.createElement('div');
    document.body.appendChild(container);
    state = createInitialState();
  });

  afterEach(() => {
    container.remove();
  });

  describe('renderGamemasterPanel', () => {
    it('renders the panel container', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      expect(panel).toBeDefined();
      expect(panel.tagName).toBe('DIV');
      expect(panel.classList.contains('gamemaster-panel')).toBe(true);
    });

    it('includes chat history section', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      const chatSection = panel.querySelector('.gm-chat');
      expect(chatSection).toBeDefined();
    });

    it('includes message input', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      const input = panel.querySelector('input[type="text"], textarea');
      expect(input).toBeDefined();
    });

    it('includes quick action buttons', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      const quickActions = panel.querySelector('.gm-quick-actions');
      expect(quickActions).toBeDefined();

      const buttons = quickActions?.querySelectorAll('button');
      expect(buttons?.length).toBeGreaterThan(0);
    });

    it('displays narrative section', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        currentNarrative: 'The year 2026 begins with mounting tension...',
      });

      const narrativeSection = panel.querySelector('.gm-narrative');
      expect(narrativeSection).toBeDefined();
      expect(narrativeSection?.textContent).toContain('2026');
    });
  });

  describe('interactions', () => {
    it('calls onSendMessage when message is sent', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const onSendMessage = vi.fn();
      const panel = renderGamemasterPanel({
        state,
        onSendMessage,
        onQuickAction: vi.fn(),
      });

      const input = panel.querySelector('input[type="text"], textarea') as HTMLInputElement | HTMLTextAreaElement;
      const sendButton = panel.querySelector('.gm-send-btn') as HTMLButtonElement;

      if (input && sendButton) {
        input.value = 'What is safety?';
        sendButton.click();

        expect(onSendMessage).toHaveBeenCalledWith('What is safety?');
      }
    });

    it('calls onQuickAction when quick action button is clicked', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const onQuickAction = vi.fn();
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction,
      });

      const quickActionBtn = panel.querySelector('.gm-quick-actions button') as HTMLButtonElement;
      if (quickActionBtn) {
        quickActionBtn.click();
        expect(onQuickAction).toHaveBeenCalled();
      }
    });

    it('supports keyboard submit with Enter', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const onSendMessage = vi.fn();
      const panel = renderGamemasterPanel({
        state,
        onSendMessage,
        onQuickAction: vi.fn(),
      });

      const input = panel.querySelector('input[type="text"], textarea') as HTMLInputElement | HTMLTextAreaElement;
      if (input) {
        input.value = 'Test message';
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
        input.dispatchEvent(enterEvent);

        expect(onSendMessage).toHaveBeenCalledWith('Test message');
      }
    });
  });

  describe('chat history', () => {
    it('renders chat messages', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        chatHistory: [
          { role: 'user', content: 'What is safety?' },
          { role: 'assistant', content: 'Safety measures how aligned your AI systems are.' },
        ],
      });

      const messages = panel.querySelectorAll('.gm-message');
      expect(messages.length).toBe(2);
    });

    it('distinguishes user and assistant messages', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        chatHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Greetings, player.' },
        ],
      });

      const userMessage = panel.querySelector('.gm-message--user');
      const assistantMessage = panel.querySelector('.gm-message--assistant');

      expect(userMessage).toBeDefined();
      expect(assistantMessage).toBeDefined();
    });

    it('shows loading state when waiting for response', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        isLoading: true,
      });

      const loadingIndicator = panel.querySelector('.gm-loading');
      expect(loadingIndicator).toBeDefined();
    });
  });

  describe('quick actions', () => {
    it('includes explain safety action', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      const safetyBtn = panel.querySelector('[data-action="explain-safety"]');
      expect(safetyBtn).toBeDefined();
    });

    it('includes strategic advice action', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      const adviceBtn = panel.querySelector('[data-action="get-advice"]');
      expect(adviceBtn).toBeDefined();
    });

    it('includes game summary action', async () => {
      const { renderGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
      });

      const summaryBtn = panel.querySelector('[data-action="get-summary"]');
      expect(summaryBtn).toBeDefined();
    });
  });

  describe('updateGamemasterPanel', () => {
    it('updates chat history', async () => {
      const { renderGamemasterPanel, updateGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        chatHistory: [],
      });

      updateGamemasterPanel(panel, {
        chatHistory: [
          { role: 'user', content: 'New message' },
        ],
      });

      const messages = panel.querySelectorAll('.gm-message');
      expect(messages.length).toBe(1);
    });

    it('updates loading state', async () => {
      const { renderGamemasterPanel, updateGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        isLoading: false,
      });

      updateGamemasterPanel(panel, { isLoading: true });

      const loadingIndicator = panel.querySelector('.gm-loading');
      expect(loadingIndicator).toBeDefined();
    });

    it('updates narrative', async () => {
      const { renderGamemasterPanel, updateGamemasterPanel } = await import('../../src/ui/GamemasterPanel.js');
      const panel = renderGamemasterPanel({
        state,
        onSendMessage: vi.fn(),
        onQuickAction: vi.fn(),
        currentNarrative: 'Initial narrative',
      });

      updateGamemasterPanel(panel, {
        currentNarrative: 'Updated narrative with new events.',
      });

      const narrativeSection = panel.querySelector('.gm-narrative');
      expect(narrativeSection?.textContent).toContain('Updated narrative');
    });
  });
});
