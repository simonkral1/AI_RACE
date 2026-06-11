import { div, span, button, el } from './base.js';
import type { Openness } from '../../core/types.js';

export type ActionReviewItem = {
  id: string;
  actorName: string;
  actionName: string;
  openness: Openness;
  visibility: 'public' | 'private';
  targetName?: string;
  source: 'llm' | 'error' | 'deterministic';
  evaluation: string;
  effects: string[];
  intel: string;
};

type OpenOptions = {
  items: ActionReviewItem[];
  onComplete?: () => void;
};

export class ActionReviewModal {
  private overlay: HTMLElement | null = null;
  private card: HTMLElement | null = null;
  private currentIndex = 0;
  private items: ActionReviewItem[] = [];
  private onComplete: (() => void) | null = null;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.injectStyles();
  }

  isOpen(): boolean {
    return Boolean(this.overlay && this.card);
  }

  open(options: OpenOptions): void {
    if (!options.items.length) {
      options.onComplete?.();
      return;
    }
    this.close(false);
    this.items = options.items;
    this.currentIndex = 0;
    this.onComplete = options.onComplete ?? null;

    const overlay = div({ className: 'action-review-overlay', id: 'actionReviewOverlay' });
    const card = div({ className: 'action-review-card', id: 'actionReviewCard' });
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.card = card;

    requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      card.classList.add('is-visible');
    });

    this.keyHandler = (event: KeyboardEvent) => {
      if (!this.isOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.next();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.prev();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
    this.render();
  }

  close(triggerComplete = true): void {
    const overlay = this.overlay;
    const card = this.card;
    if (!overlay || !card) return;

    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    overlay.classList.remove('is-visible');
    card.classList.remove('is-visible');

    const completeCb = triggerComplete ? this.onComplete : null;
    this.onComplete = null;

    this.overlay = null;
    this.card = null;
    this.items = [];
    this.currentIndex = 0;

    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      completeCb?.();
    }, 220);
  }

  private next(): void {
    if (!this.items.length) return;
    if (this.currentIndex >= this.items.length - 1) {
      this.close();
      return;
    }
    this.currentIndex += 1;
    this.render();
  }

  private prev(): void {
    if (!this.items.length) return;
    if (this.currentIndex <= 0) return;
    this.currentIndex -= 1;
    this.render();
  }

  private render(): void {
    if (!this.card || !this.items.length) return;
    const item = this.items[this.currentIndex];
    const isFinal = this.currentIndex === this.items.length - 1;

    this.card.innerHTML = '';

    const header = div({ className: 'action-review-header' });
    const label = span({ className: 'action-review-label', text: 'ACTION REVIEW' });
    const closeBtn = button({ className: 'action-review-close' });
    closeBtn.innerHTML = '&times;';
    closeBtn.title = 'Close review';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(label);
    header.appendChild(closeBtn);

    const body = div({ className: 'action-review-body' });
    const counter = div({
      className: 'action-review-counter',
      text: `Review ${this.currentIndex + 1} / ${this.items.length}`,
    });
    const title = div({ className: 'action-review-title', text: item.actionName });

    const meta = div({ className: 'action-review-meta' });
    const actorBadge = span({ className: 'action-review-pill action-review-pill--actor', text: item.actorName });
    const opennessBadge = span({
      className: `action-review-pill ${item.openness === 'open' ? 'action-review-pill--open' : 'action-review-pill--secret'}`,
      text: item.openness === 'open' ? 'OPEN ACTION' : 'PRIVATE ACTION',
    });
    const visibilityBadge = span({
      className: `action-review-pill ${item.visibility === 'public' ? 'action-review-pill--public' : 'action-review-pill--private'}`,
      text: item.visibility === 'public' ? 'PUBLIC INTEL' : 'LIMITED INTEL',
    });
    meta.appendChild(actorBadge);
    meta.appendChild(opennessBadge);
    meta.appendChild(visibilityBadge);
    if (item.targetName) {
      meta.appendChild(span({
        className: 'action-review-pill action-review-pill--target',
        text: `Target: ${item.targetName}`,
      }));
    }

    const beats = this.parseNarrativeBeats(item.evaluation);
    const evaluation = div({ className: 'action-review-evaluation' });
    if (beats.length > 0) {
      for (const beat of beats) {
        const beatRow = div({ className: 'action-review-beat' });
        beatRow.appendChild(span({ className: 'action-review-beat-label', text: beat.label }));
        beatRow.appendChild(div({ className: 'action-review-beat-text', text: beat.text }));
        evaluation.appendChild(beatRow);
      }
    } else {
      const formattedFallback = item.evaluation
        .replace(/\s+(Why it matters)\s*:?\s*/gi, '\n$1: ')
        .replace(/\s+(Next turn)\s*:?\s*/gi, '\n$1: ')
        .replace(/\s+(This turn)\s*:?\s*/gi, '\n$1: ')
        .trim();
      evaluation.textContent = formattedFallback;
    }
    const narrativeLabelClass =
      item.source === 'llm'
        ? 'action-review-narrative-label--llm'
        : item.source === 'deterministic'
          ? 'action-review-narrative-label--deterministic'
          : 'action-review-narrative-label--error';
    const narrativeLabel = span({
      className: `action-review-narrative-label ${narrativeLabelClass}`,
      text: item.source === 'llm'
        ? 'LLM NARRATIVE BRIEF'
        : item.source === 'deterministic'
          ? 'MECHANICS BRIEF'
          : 'AI ERROR',
    });

    const effectsWrap = div({ className: 'action-review-effects' });
    for (const effect of item.effects) {
      effectsWrap.appendChild(span({ className: 'action-review-effect', text: effect }));
    }

    const intel = div({ className: 'action-review-intel', text: item.intel });

    body.appendChild(counter);
    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(narrativeLabel);
    body.appendChild(evaluation);
    if (item.effects.length) body.appendChild(effectsWrap);
    body.appendChild(intel);

    const footer = div({ className: 'action-review-footer' });
    const prevBtn = button({
      className: 'action-review-nav action-review-nav--ghost',
      text: '← Previous',
      attrs: { disabled: this.currentIndex === 0 },
    }) as HTMLButtonElement;
    prevBtn.addEventListener('click', () => this.prev());

    const nextBtn = button({
      className: 'action-review-nav action-review-nav--primary',
      text: isFinal ? 'Close Review' : 'Next Action →',
    });
    nextBtn.addEventListener('click', () => this.next());
    footer.appendChild(prevBtn);
    footer.appendChild(nextBtn);

    this.card.appendChild(header);
    this.card.appendChild(body);
    this.card.appendChild(footer);
  }

  private parseNarrativeBeats(text: string): Array<{ label: string; text: string }> {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const markerPattern = /(This turn|Why it matters|Next turn)\s*:?\s*/gi;
    const matches = Array.from(normalized.matchAll(markerPattern));
    const beats: Array<{ label: string; text: string }> = [];
    if (matches.length === 0) return beats;

    for (let i = 0; i < matches.length; i += 1) {
      const current = matches[i];
      const next = matches[i + 1];
      const label = current[1].trim();
      const start = (current.index ?? 0) + current[0].length;
      const end = next?.index ?? normalized.length;
      const body = normalized.slice(start, end).trim();
      if (!body) continue;
      beats.push({ label, text: body });
    }
    return beats;
  }

  private injectStyles(): void {
    if (document.getElementById('action-review-modal-styles')) return;

    const style = el('style', { id: 'action-review-modal-styles' });
    style.textContent = `
      .action-review-overlay {
        position: fixed;
        inset: 0;
        background: rgba(20, 24, 22, 0.64);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2200;
        opacity: 0;
        transition: opacity 180ms ease-out;
      }
      .action-review-overlay.is-visible { opacity: 1; }

      .action-review-card {
        width: min(760px, 92vw);
        max-height: 86vh;
        overflow: auto;
        background: var(--panel, #f7f5f1);
        border: 1px solid var(--line, #d6d2cb);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
        transform: translateY(8px) scale(0.985);
        opacity: 0;
        transition: transform 180ms ease-out, opacity 180ms ease-out;
      }
      .action-review-card.is-visible {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .action-review-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--line, #d6d2cb);
      }
      .action-review-label {
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        font-size: 11px;
        letter-spacing: 0.18em;
        font-weight: 700;
        color: var(--text-3, #64615b);
      }
      .action-review-close {
        width: 34px;
        height: 34px;
        border: 1px solid var(--line, #d6d2cb);
        background: transparent;
        color: #777;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
      }
      .action-review-body {
        padding: 18px 20px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .action-review-counter {
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        font-size: 10px;
        letter-spacing: 0.1em;
        color: var(--text-3, #66625c);
      }
      .action-review-title {
        font-family: var(--serif, 'IBM Plex Serif', Georgia, serif);
        font-size: 40px;
        line-height: 1.05;
        letter-spacing: -0.015em;
        color: var(--ink, #1f1f1f);
      }
      .action-review-meta {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .action-review-pill {
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 2px;
        border: 1px solid var(--line, #d6d2cb);
        color: #4f4c47;
        background: #fff;
      }
      .action-review-pill--open { color: #1e4b35; border-color: rgba(30, 75, 53, 0.24); background: rgba(30, 75, 53, 0.06); }
      .action-review-pill--secret { color: #7a3c12; border-color: rgba(122, 60, 18, 0.3); background: rgba(122, 60, 18, 0.08); }
      .action-review-pill--public { color: #1f4f7d; border-color: rgba(31, 79, 125, 0.27); background: rgba(31, 79, 125, 0.08); }
      .action-review-pill--private { color: #6a2f5c; border-color: rgba(106, 47, 92, 0.27); background: rgba(106, 47, 92, 0.08); }
      .action-review-evaluation {
        font-size: 18px;
        line-height: 1.35;
        color: #1f1f1f;
        background: rgba(255, 255, 255, 0.7);
        border: 1px solid var(--line, #d6d2cb);
        padding: 14px;
        white-space: pre-line;
        display: grid;
        gap: 10px;
      }
      .action-review-beat {
        border-left: 3px solid rgba(26, 58, 42, 0.35);
        padding-left: 10px;
      }
      .action-review-beat-label {
        display: block;
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #335f48;
        margin-bottom: 4px;
      }
      .action-review-beat-text {
        font-size: 19px;
        line-height: 1.32;
        color: #20201d;
      }
      .action-review-narrative-label {
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        font-size: 10px;
        letter-spacing: 0.12em;
        font-weight: 700;
        width: fit-content;
        padding: 4px 8px;
        border: 1px solid var(--line, #d6d2cb);
        text-transform: uppercase;
      }
      .action-review-narrative-label--llm {
        color: #1f4f7d;
        border-color: rgba(31, 79, 125, 0.27);
        background: rgba(31, 79, 125, 0.08);
      }
      .action-review-narrative-label--deterministic {
        color: #1e4b35;
        border-color: rgba(30, 75, 53, 0.24);
        background: rgba(30, 75, 53, 0.08);
      }
      .action-review-narrative-label--error {
        color: #8b2020;
        border-color: rgba(139, 32, 32, 0.24);
        background: rgba(139, 32, 32, 0.08);
      }
      .action-review-effects {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .action-review-effect {
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        font-size: 11px;
        color: #21533c;
        background: rgba(45, 90, 66, 0.08);
        border: 1px solid rgba(45, 90, 66, 0.18);
        padding: 5px 9px;
      }
      .action-review-intel {
        font-size: 14px;
        line-height: 1.45;
        color: #4f4b45;
        border-left: 3px solid #b08f45;
        padding: 10px 12px;
        background: rgba(176, 143, 69, 0.08);
      }
      .action-review-footer {
        padding: 12px 20px 18px;
        border-top: 1px solid var(--line, #d6d2cb);
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .action-review-nav {
        border: 1px solid var(--line, #d6d2cb);
        font-family: var(--mono, 'IBM Plex Mono', monospace);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 11px;
        font-weight: 700;
        padding: 10px 14px;
        cursor: pointer;
      }
      .action-review-nav--ghost {
        background: #fff;
        color: #46433f;
      }
      .action-review-nav--ghost:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .action-review-nav--primary {
        background: var(--accent, #164734);
        color: #fff;
        border-color: transparent;
      }
      @media (max-width: 900px) {
        .action-review-title {
          font-size: 30px;
        }
        .action-review-evaluation {
          font-size: 18px;
        }
      }
    `;
    document.head.appendChild(style);
  }
}
