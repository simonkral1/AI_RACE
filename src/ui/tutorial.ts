// Tutorial Mode - Guided introduction for new players

export interface TutorialStep {
  id: string;
  target: string; // CSS selector
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'wait';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    target: '.global-dashboard',
    title: 'Welcome to AGI Race',
    content: 'Lead your faction in the race to develop safe AGI. Balance capability advancement with safety research to win.',
    position: 'bottom',
  },
  {
    id: 'factions',
    target: '#factionList',
    title: 'Competing Factions',
    content: 'Five factions compete: three AI labs and two governments. Click any faction to view their details.',
    position: 'right',
  },
  {
    id: 'focus',
    target: '#focusCard',
    title: 'Faction Details',
    content: 'This panel shows detailed information about the selected faction, including their capability and safety scores.',
    position: 'left',
  },
  {
    id: 'orders',
    target: '.orders',
    title: 'Your Orders',
    content: 'Set your faction\'s actions each turn. Choose wisely - research, build, or engage in diplomacy.',
    position: 'left',
  },
  {
    id: 'tech',
    target: '.panel--tech',
    title: 'Tech Tree',
    content: 'Research technologies to gain advantages. Different branches affect capability, safety, and operations.',
    position: 'top',
  },
  {
    id: 'events',
    target: '#eventPanel',
    title: 'Events',
    content: 'Random events will occur that require your response. Choose carefully - your decisions affect all factions.',
    position: 'left',
  },
  {
    id: 'advance',
    target: '.global-dashboard__btn--advance',
    title: 'Advance Time',
    content: 'Click this button to advance to the next quarter. Actions resolve and the game progresses.',
    position: 'bottom',
    action: 'click',
  },
  {
    id: 'safety',
    target: '.global-dashboard__safety',
    title: 'Global Safety',
    content: 'Keep global safety high! If it drops too low when AGI is deployed, everyone loses. Win by deploying safe AGI first.',
    position: 'bottom',
  },
];

const STORAGE_KEY = 'agi_race_tutorial_completed';

export class TutorialManager {
  private currentStep = 0;
  private isActive = false;
  private tooltipElement: HTMLElement | null = null;
  private highlightElement: HTMLElement | null = null;
  private onComplete?: () => void;

  constructor() {
    this.createTooltipElement();
    this.createHighlightElement();
  }

  private createTooltipElement(): void {
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'tutorial-tooltip';
    this.tooltipElement.innerHTML = `
      <div class="tutorial-tooltip__header">
        <span class="tutorial-tooltip__step"></span>
        <button class="tutorial-tooltip__skip" aria-label="Skip tutorial">×</button>
      </div>
      <h3 class="tutorial-tooltip__title"></h3>
      <p class="tutorial-tooltip__content"></p>
      <div class="tutorial-tooltip__actions">
        <button class="tutorial-tooltip__btn tutorial-tooltip__btn--prev">Previous</button>
        <button class="tutorial-tooltip__btn tutorial-tooltip__btn--next">Next</button>
      </div>
    `;
    this.tooltipElement.classList.add('is-hidden');
    document.body.appendChild(this.tooltipElement);

    // Bind event handlers
    this.tooltipElement.querySelector('.tutorial-tooltip__skip')?.addEventListener('click', () => this.skip());
    this.tooltipElement.querySelector('.tutorial-tooltip__btn--prev')?.addEventListener('click', () => this.prev());
    this.tooltipElement.querySelector('.tutorial-tooltip__btn--next')?.addEventListener('click', () => this.next());
  }

  private createHighlightElement(): void {
    this.highlightElement = document.createElement('div');
    this.highlightElement.className = 'tutorial-highlight';
    this.highlightElement.classList.add('is-hidden');
    document.body.appendChild(this.highlightElement);
  }

  public hasTutorialCompleted(): boolean {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  public start(onComplete?: () => void): void {
    if (this.hasTutorialCompleted()) {
      onComplete?.();
      return;
    }

    this.onComplete = onComplete;
    this.currentStep = 0;
    this.isActive = true;
    this.showStep(this.currentStep);
  }

  public reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentStep = 0;
  }

  private showStep(index: number): void {
    if (!this.tooltipElement || !this.highlightElement) return;
    if (index < 0 || index >= TUTORIAL_STEPS.length) return;

    const step = TUTORIAL_STEPS[index];
    const target = document.querySelector(step.target);

    if (!target) {
      // Skip to next step if target not found
      if (index < TUTORIAL_STEPS.length - 1) {
        this.showStep(index + 1);
      }
      return;
    }

    // Update tooltip content
    const titleEl = this.tooltipElement.querySelector('.tutorial-tooltip__title');
    const contentEl = this.tooltipElement.querySelector('.tutorial-tooltip__content');
    const stepEl = this.tooltipElement.querySelector('.tutorial-tooltip__step');
    const prevBtn = this.tooltipElement.querySelector('.tutorial-tooltip__btn--prev') as HTMLButtonElement;
    const nextBtn = this.tooltipElement.querySelector('.tutorial-tooltip__btn--next') as HTMLButtonElement;

    if (titleEl) titleEl.textContent = step.title;
    if (contentEl) contentEl.textContent = step.content;
    if (stepEl) stepEl.textContent = `Step ${index + 1} of ${TUTORIAL_STEPS.length}`;

    // Update button states
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.textContent = index === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next';

    // Position tooltip
    const targetRect = target.getBoundingClientRect();
    this.positionTooltip(targetRect, step.position);

    // Position highlight
    this.positionHighlight(targetRect);

    // Show elements
    this.tooltipElement.classList.remove('is-hidden');
    this.highlightElement.classList.remove('is-hidden');
  }

  private positionTooltip(targetRect: DOMRect, position: TutorialStep['position']): void {
    if (!this.tooltipElement) return;

    const tooltip = this.tooltipElement;
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 12;

    let left = 0;
    let top = 0;

    switch (position) {
      case 'top':
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        top = targetRect.top - tooltipRect.height - padding;
        break;
      case 'bottom':
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        top = targetRect.bottom + padding;
        break;
      case 'left':
        left = targetRect.left - tooltipRect.width - padding;
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        break;
      case 'right':
        left = targetRect.right + padding;
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        break;
    }

    // Clamp to viewport
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.dataset.position = position;
  }

  private positionHighlight(targetRect: DOMRect): void {
    if (!this.highlightElement) return;

    const padding = 4;
    this.highlightElement.style.left = `${targetRect.left - padding}px`;
    this.highlightElement.style.top = `${targetRect.top - padding}px`;
    this.highlightElement.style.width = `${targetRect.width + padding * 2}px`;
    this.highlightElement.style.height = `${targetRect.height + padding * 2}px`;
  }

  private next(): void {
    if (this.currentStep < TUTORIAL_STEPS.length - 1) {
      this.currentStep++;
      this.showStep(this.currentStep);
    } else {
      this.complete();
    }
  }

  private prev(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.showStep(this.currentStep);
    }
  }

  private skip(): void {
    this.complete();
  }

  private complete(): void {
    this.isActive = false;
    localStorage.setItem(STORAGE_KEY, 'true');

    if (this.tooltipElement) {
      this.tooltipElement.classList.add('is-hidden');
    }
    if (this.highlightElement) {
      this.highlightElement.classList.add('is-hidden');
    }

    this.onComplete?.();
  }

  public destroy(): void {
    this.tooltipElement?.remove();
    this.highlightElement?.remove();
    this.tooltipElement = null;
    this.highlightElement = null;
  }
}

// Singleton instance
let tutorialManager: TutorialManager | null = null;

export const getTutorialManager = (): TutorialManager => {
  if (!tutorialManager) {
    tutorialManager = new TutorialManager();
  }
  return tutorialManager;
};

export const startTutorial = (onComplete?: () => void): void => {
  getTutorialManager().start(onComplete);
};

export const resetTutorial = (): void => {
  getTutorialManager().reset();
};

export const hasTutorialCompleted = (): boolean => {
  return getTutorialManager().hasTutorialCompleted();
};
