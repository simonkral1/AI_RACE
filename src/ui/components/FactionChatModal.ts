import { button, div, el, span } from './base.js';

export type FactionChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
};

export type FactionChatTarget = {
  id: string;
  name: string;
  type: 'lab' | 'government';
};

export type FactionChatModalOptions = {
  targets: FactionChatTarget[];
  selectedTargetId: string;
  messages: FactionChatMessage[];
  isLoading?: boolean;
  onSelectTarget: (targetId: string) => void;
  onSendMessage: (message: string) => void;
  onClose: () => void;
};

export type FactionChatModalUpdateOptions = {
  targets?: FactionChatTarget[];
  selectedTargetId?: string;
  messages?: FactionChatMessage[];
  isLoading?: boolean;
};

const createMessage = (message: FactionChatMessage): HTMLElement => {
  const row = div({ className: `fchat-modal-message fchat-modal-message--${message.role}` });
  const bubble = div({ className: 'fchat-modal-message__bubble', text: message.content });
  row.appendChild(bubble);
  return row;
};

const createChatArea = (messages: FactionChatMessage[], isLoading: boolean): HTMLElement => {
  const chat = div({ className: 'fchat-modal-chat' });

  if (!messages.length && !isLoading) {
    chat.appendChild(div({
      className: 'fchat-modal-chat__empty',
      text: 'Open a diplomatic channel with another faction. Their replies come from their own AI representative, not the Analyst.',
    }));
  } else {
    for (const message of messages) {
      chat.appendChild(createMessage(message));
    }
  }

  if (isLoading) {
    const loadingRow = div({ className: 'fchat-modal-message fchat-modal-message--assistant' });
    const dots = div({ className: 'fchat-modal-loading' });
    dots.appendChild(span({ className: 'fchat-modal-loading__dot' }));
    dots.appendChild(span({ className: 'fchat-modal-loading__dot' }));
    dots.appendChild(span({ className: 'fchat-modal-loading__dot' }));
    loadingRow.appendChild(dots);
    chat.appendChild(loadingRow);
  }

  requestAnimationFrame(() => {
    chat.scrollTop = chat.scrollHeight;
  });

  return chat;
};

const createHeader = (
  targets: FactionChatTarget[],
  selectedTargetId: string,
  onSelectTarget: (targetId: string) => void,
  onClose: () => void,
  isLoading: boolean,
): HTMLElement => {
  const header = div({ className: 'fchat-modal-header' });
  const title = span({ className: 'fchat-modal-header__title', text: 'Faction Comms' });

  const selectorWrap = div({ className: 'fchat-modal-header__selector-wrap' });
  const selector = el('select', {
    className: 'fchat-modal-header__selector',
    attrs: { disabled: isLoading },
  }) as HTMLSelectElement;
  for (const target of targets) {
    const option = document.createElement('option');
    option.value = target.id;
    option.textContent = `${target.name} (${target.type})`;
    option.selected = target.id === selectedTargetId;
    selector.appendChild(option);
  }
  selector.addEventListener('change', () => onSelectTarget(selector.value));
  selectorWrap.appendChild(selector);

  const closeBtn = button({ className: 'fchat-modal-close', html: '&times;' });
  closeBtn.addEventListener('click', onClose);

  header.appendChild(title);
  header.appendChild(selectorWrap);
  header.appendChild(closeBtn);

  (header as any).__fchatSelector = selector;
  return header;
};

const createInput = (
  onSendMessage: (message: string) => void,
  isLoading: boolean,
): HTMLElement => {
  const section = div({ className: 'fchat-modal-input' });
  const input = el('input', {
    className: 'fchat-modal-input__field',
    attrs: {
      type: 'text',
      placeholder: 'Send diplomatic message...',
      disabled: isLoading,
    },
  }) as HTMLInputElement;
  const sendBtn = button({
    className: 'fchat-modal-input__send',
    text: 'Send',
    attrs: { disabled: isLoading },
  });

  const handleSend = () => {
    const text = input.value.trim();
    if (!text || isLoading) return;
    onSendMessage(text);
    input.value = '';
  };

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleSend();
  });

  section.appendChild(input);
  section.appendChild(sendBtn);
  (section as any).__fchatInput = input;
  return section;
};

export const renderFactionChatModal = (options: FactionChatModalOptions): HTMLElement => {
  const overlay = div({ className: 'fchat-modal-overlay' });
  const card = div({ className: 'fchat-modal-card' });

  const header = createHeader(
    options.targets,
    options.selectedTargetId,
    options.onSelectTarget,
    options.onClose,
    options.isLoading ?? false,
  );
  const chat = createChatArea(options.messages, options.isLoading ?? false);
  const input = createInput(options.onSendMessage, options.isLoading ?? false);

  card.appendChild(header);
  card.appendChild(chat);
  card.appendChild(input);
  overlay.appendChild(card);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) options.onClose();
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      options.onClose();
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  (overlay as any).__fchatOptions = options;
  (overlay as any).__fchatHeader = header;
  (overlay as any).__fchatChat = chat;
  (overlay as any).__fchatInput = input;
  (overlay as any).__fchatKeyHandler = handleKeyDown;

  requestAnimationFrame(() => {
    const inputField = (input as any).__fchatInput as HTMLInputElement | undefined;
    inputField?.focus();
  });

  return overlay;
};

export const updateFactionChatModal = (
  overlay: HTMLElement,
  updates: FactionChatModalUpdateOptions,
): void => {
  const options = (overlay as any).__fchatOptions as FactionChatModalOptions | undefined;
  if (!options) return;

  if (updates.targets) options.targets = updates.targets;
  if (updates.selectedTargetId) options.selectedTargetId = updates.selectedTargetId;
  if (updates.messages) options.messages = updates.messages;
  if (updates.isLoading !== undefined) options.isLoading = updates.isLoading;

  const oldHeader = (overlay as any).__fchatHeader as HTMLElement | undefined;
  if (oldHeader) {
    const newHeader = createHeader(
      options.targets,
      options.selectedTargetId,
      options.onSelectTarget,
      options.onClose,
      options.isLoading ?? false,
    );
    oldHeader.replaceWith(newHeader);
    (overlay as any).__fchatHeader = newHeader;
  }

  const oldChat = (overlay as any).__fchatChat as HTMLElement | undefined;
  if (oldChat) {
    const newChat = createChatArea(options.messages, options.isLoading ?? false);
    oldChat.replaceWith(newChat);
    (overlay as any).__fchatChat = newChat;
  }

  const oldInput = (overlay as any).__fchatInput as HTMLElement | undefined;
  if (oldInput) {
    const newInput = createInput(options.onSendMessage, options.isLoading ?? false);
    oldInput.replaceWith(newInput);
    (overlay as any).__fchatInput = newInput;
  }
};

export const showFactionChatModal = (options: FactionChatModalOptions): HTMLElement => {
  const overlay = renderFactionChatModal(options);
  document.body.appendChild(overlay);
  return overlay;
};

export const hideFactionChatModal = (overlay: HTMLElement): void => {
  const handler = (overlay as any).__fchatKeyHandler as ((event: KeyboardEvent) => void) | undefined;
  if (handler) document.removeEventListener('keydown', handler);
  overlay.remove();
};

export const injectFactionChatModalStyles = (): void => {
  const styleId = 'fchat-modal-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .fchat-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(6px);
      display: grid;
      place-items: center;
      z-index: 1200;
      padding: 20px;
    }

    .fchat-modal-card {
      width: min(700px, 92vw);
      height: min(76vh, 680px);
      background: var(--panel, #fff);
      border: 1px solid var(--line);
      border-radius: 2px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
      display: grid;
      grid-template-rows: auto 1fr auto;
      overflow: hidden;
    }

    .fchat-modal-header {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--bg-warm, #eae7e1);
    }

    .fchat-modal-header__title {
      font-family: var(--mono, monospace);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-2, #4a4a4a);
    }

    .fchat-modal-header__selector {
      min-width: 240px;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--panel, #fff);
      font-size: 12px;
      color: var(--ink);
    }

    .fchat-modal-close {
      width: 30px;
      height: 30px;
      border: 1px solid var(--line);
      background: var(--panel, #fff);
      border-radius: 2px;
      cursor: pointer;
      color: var(--muted);
      font-size: 18px;
      line-height: 1;
    }

    .fchat-modal-close:hover {
      color: var(--ink);
      border-color: var(--accent);
    }

    .fchat-modal-chat {
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: var(--panel-soft, #f8f6f2);
    }

    .fchat-modal-chat__empty {
      font-size: 13px;
      color: var(--muted);
      line-height: 1.6;
      padding: 10px;
    }

    .fchat-modal-message {
      display: flex;
      max-width: 84%;
    }

    .fchat-modal-message--user {
      margin-left: auto;
      justify-content: flex-end;
    }

    .fchat-modal-message--assistant {
      margin-right: auto;
      justify-content: flex-start;
    }

    .fchat-modal-message__bubble {
      padding: 9px 12px;
      font-size: 13px;
      line-height: 1.5;
      border-radius: 2px;
      border: 1px solid var(--line);
      background: var(--panel, #fff);
      color: var(--ink);
      white-space: pre-wrap;
    }

    .fchat-modal-message--user .fchat-modal-message__bubble {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .fchat-modal-input {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0;
      border-top: 1px solid var(--line);
      background: var(--panel, #fff);
      padding: 10px 12px;
    }

    .fchat-modal-input__field {
      border: 1px solid var(--line);
      border-right: none;
      border-radius: 2px 0 0 2px;
      padding: 9px 11px;
      font-size: 13px;
      color: var(--ink);
      outline: none;
      background: var(--panel-soft, #f8f6f2);
    }

    .fchat-modal-input__send {
      border: 1px solid var(--accent);
      border-radius: 0 2px 2px 0;
      padding: 9px 14px;
      background: var(--accent);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .fchat-modal-input__send:hover:not(:disabled) {
      background: var(--accent-bright);
      border-color: var(--accent-bright);
    }

    .fchat-modal-input__send:disabled,
    .fchat-modal-input__field:disabled,
    .fchat-modal-header__selector:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .fchat-modal-loading {
      display: inline-flex;
      gap: 5px;
      align-items: center;
      padding: 4px 2px;
    }

    .fchat-modal-loading__dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--muted);
      animation: fchat-dot 1.2s infinite ease-in-out;
    }

    .fchat-modal-loading__dot:nth-child(2) { animation-delay: 0.16s; }
    .fchat-modal-loading__dot:nth-child(3) { animation-delay: 0.32s; }

    @keyframes fchat-dot {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
};
