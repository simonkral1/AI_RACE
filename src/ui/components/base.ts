// Lightweight component utilities

/**
 * Create an HTML element with attributes
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: Record<string, any> = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'textContent') {
      element.textContent = value;
    } else if (key === 'innerHTML') {
      element.innerHTML = value;
    } else if (key === 'style' && typeof value === 'string') {
      element.setAttribute('style', value);
    } else if (key === 'onclick' && typeof value === 'function') {
      element.addEventListener('click', value);
    } else if (key === 'title') {
      element.title = value;
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value);
    }
  }

  return element;
}

/**
 * Create an SVG element with attributes
 */
export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  options: Record<string, any> = {}
): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);

  for (const [key, value] of Object.entries(options)) {
    if (key === 'className') {
      element.setAttribute('class', value);
    } else if (key === 'textContent') {
      element.textContent = value;
    } else {
      element.setAttribute(key, String(value));
    }
  }

  return element;
}

export interface ElementOptions {
  className?: string;
  id?: string;
  dataset?: Record<string, string>;
  attrs?: Record<string, string | number | boolean>;
  children?: (Node | string)[];
  html?: string;
  text?: string;
  onClick?: (e: MouseEvent) => void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {}
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (options.className) {
    element.className = options.className;
  }

  if (options.id) {
    element.id = options.id;
  }

  if (options.dataset) {
    for (const [key, value] of Object.entries(options.dataset)) {
      element.dataset[key] = value;
    }
  }

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (typeof value === 'boolean') {
        if (value) element.setAttribute(key, '');
      } else {
        element.setAttribute(key, String(value));
      }
    }
  }

  if (options.html) {
    element.innerHTML = options.html;
  } else if (options.text) {
    element.textContent = options.text;
  } else if (options.children) {
    for (const child of options.children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }

  if (options.onClick) {
    element.addEventListener('click', options.onClick as EventListener);
  }

  return element;
}

// Quick element creators
export const div = (options: ElementOptions = {}) => el('div', options);
export const span = (options: ElementOptions = {}) => el('span', options);
export const button = (options: ElementOptions = {}) => el('button', options);

// Utility to toggle CSS class based on condition
export function toggleClass(
  element: Element,
  className: string,
  condition: boolean
): void {
  if (condition) {
    element.classList.add(className);
  } else {
    element.classList.remove(className);
  }
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Format number with limited decimal places
export function formatNum(value: number, decimals: number = 1): string {
  return value.toFixed(decimals).replace(/\.0+$/, '');
}

// Faction type icons (SVG inline)
export const ICONS = {
  lab: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--lab">
    <path d="M9 3h6v4l3 10H6L9 7V3z"/>
    <path d="M9 3h6"/>
    <circle cx="12" cy="14" r="1"/>
  </svg>`,

  government: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--gov">
    <path d="M3 21h18"/>
    <path d="M5 21V7l7-4 7 4v14"/>
    <path d="M9 21v-6h6v6"/>
    <path d="M9 9h0"/>
    <path d="M15 9h0"/>
  </svg>`,

  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--warning">
    <path d="M12 9v4"/>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <circle cx="12" cy="17" r="1"/>
  </svg>`,

  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--check">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`,

  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--lock">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>`,

  unlock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--unlock">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 019.9-1"/>
  </svg>`,

  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--eye">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,

  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon--eye-off">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>`,
};

// Branch colors for tech tree
export const BRANCH_COLORS: Record<string, { primary: string; glow: string }> = {
  capabilities: { primary: '#e26d5a', glow: 'rgba(226, 109, 90, 0.3)' },
  safety: { primary: '#6ec7a2', glow: 'rgba(110, 199, 162, 0.3)' },
  ops: { primary: '#5a9de2', glow: 'rgba(90, 157, 226, 0.3)' },
  policy: { primary: '#c79af5', glow: 'rgba(199, 154, 245, 0.3)' },
};

// Status colors
export const STATUS_COLORS = {
  unlocked: { bg: 'rgba(138, 192, 108, 0.18)', border: 'rgba(138, 192, 108, 0.6)' },
  available: { bg: 'rgba(246, 192, 106, 0.18)', border: 'rgba(246, 192, 106, 0.6)' },
  locked: { bg: 'rgba(255, 255, 255, 0.04)', border: 'rgba(255, 255, 255, 0.1)' },
};
