// Save Manager UI - Visual save/load interface

import { GameState } from '../core/types.js';
import { saveToLocalStorage, loadFromLocalStorage, getSaveSlots, deleteSaveSlot, getSaveMetadata } from '../core/persistence.js';
import { playSave, playLoad } from './audio.js';

export interface SaveManagerCallbacks {
  onLoad: (state: GameState) => void;
  onClose: () => void;
}

const AUTOSAVE_SLOT = 'autosave';
const QUICKSAVE_SLOT = 'quicksave';
const MAX_MANUAL_SLOTS = 5;

export class SaveManager {
  private overlay: HTMLElement | null = null;
  private currentState: GameState | null = null;
  private callbacks: SaveManagerCallbacks | null = null;

  constructor() {
    this.createOverlay();
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.id = 'saveManagerOverlay';
    this.overlay.className = 'overlay save-manager-overlay is-hidden';
    document.body.appendChild(this.overlay);
  }

  public show(state: GameState, callbacks: SaveManagerCallbacks): void {
    this.currentState = state;
    this.callbacks = callbacks;
    this.renderOverlay();
    this.overlay?.classList.remove('is-hidden');
  }

  public hide(): void {
    this.overlay?.classList.add('is-hidden');
    this.callbacks?.onClose();
  }

  private renderOverlay(): void {
    if (!this.overlay || !this.currentState) return;

    const slots = getSaveSlots();
    const slotsHtml = this.renderSlots(slots);

    this.overlay.innerHTML = `
      <div class="save-manager">
        <div class="save-manager__header">
          <h2 class="save-manager__title">Save / Load Game</h2>
          <button class="save-manager__close" aria-label="Close">&times;</button>
        </div>
        <div class="save-manager__content">
          <div class="save-manager__section">
            <h3 class="save-manager__subtitle">Special Slots</h3>
            <div class="save-manager__slots">
              ${this.renderSpecialSlot(AUTOSAVE_SLOT, 'Autosave', slots)}
              ${this.renderSpecialSlot(QUICKSAVE_SLOT, 'Quicksave', slots)}
            </div>
          </div>
          <div class="save-manager__section">
            <h3 class="save-manager__subtitle">Save Slots</h3>
            <div class="save-manager__slots">
              ${slotsHtml}
            </div>
          </div>
        </div>
        <div class="save-manager__footer">
          <button class="save-manager__btn save-manager__btn--new">New Save</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderSpecialSlot(slotId: string, label: string, slots: string[]): string {
    const exists = slots.includes(slotId);
    const metadata = exists ? getSaveMetadata(slotId) : null;
    const dateStr = metadata ? new Date(metadata.savedAt).toLocaleString() : '';

    return `
      <div class="save-slot ${exists ? 'save-slot--filled' : 'save-slot--empty'}" data-slot="${slotId}">
        <div class="save-slot__info">
          <div class="save-slot__name">${label}</div>
          ${exists ? `
            <div class="save-slot__meta">
              ${metadata?.year ?? ''} Q${metadata?.quarter ?? ''}
              <span class="save-slot__date">${dateStr}</span>
            </div>
          ` : '<div class="save-slot__meta">Empty</div>'}
        </div>
        <div class="save-slot__actions">
          ${exists ? `
            <button class="save-slot__btn save-slot__btn--load" data-action="load">Load</button>
            <button class="save-slot__btn save-slot__btn--save" data-action="save">Overwrite</button>
          ` : `
            <button class="save-slot__btn save-slot__btn--save" data-action="save">Save</button>
          `}
        </div>
      </div>
    `;
  }

  private renderSlots(slots: string[]): string {
    const manualSlots: string[] = [];

    for (let i = 1; i <= MAX_MANUAL_SLOTS; i++) {
      const slotId = `save_${i}`;
      const exists = slots.includes(slotId);
      const metadata = exists ? getSaveMetadata(slotId) : null;
      const dateStr = metadata ? new Date(metadata.savedAt).toLocaleString() : '';

      manualSlots.push(`
        <div class="save-slot ${exists ? 'save-slot--filled' : 'save-slot--empty'}" data-slot="${slotId}">
          <div class="save-slot__info">
            <div class="save-slot__name">Slot ${i}</div>
            ${exists ? `
              <div class="save-slot__meta">
                ${metadata?.year ?? ''} Q${metadata?.quarter ?? ''}
                <span class="save-slot__date">${dateStr}</span>
              </div>
            ` : '<div class="save-slot__meta">Empty</div>'}
          </div>
          <div class="save-slot__actions">
            ${exists ? `
              <button class="save-slot__btn save-slot__btn--load" data-action="load">Load</button>
              <button class="save-slot__btn save-slot__btn--save" data-action="save">Overwrite</button>
              <button class="save-slot__btn save-slot__btn--delete" data-action="delete">&times;</button>
            ` : `
              <button class="save-slot__btn save-slot__btn--save" data-action="save">Save</button>
            `}
          </div>
        </div>
      `);
    }

    return manualSlots.join('');
  }

  private bindEvents(): void {
    if (!this.overlay) return;

    // Close button
    this.overlay.querySelector('.save-manager__close')?.addEventListener('click', () => this.hide());

    // Click outside to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.hide();
    });

    // Slot actions
    this.overlay.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        const slot = (btn.closest('.save-slot') as HTMLElement)?.dataset.slot;
        if (!slot) return;

        switch (action) {
          case 'save':
            this.saveToSlot(slot);
            break;
          case 'load':
            this.loadFromSlot(slot);
            break;
          case 'delete':
            this.deleteSlot(slot);
            break;
        }
      });
    });

    // New save button
    this.overlay.querySelector('.save-manager__btn--new')?.addEventListener('click', () => {
      this.saveToNextAvailable();
    });
  }

  private saveToSlot(slotId: string): void {
    if (!this.currentState) return;

    if (saveToLocalStorage(this.currentState, slotId)) {
      playSave();
      this.renderOverlay();
    }
  }

  private loadFromSlot(slotId: string): void {
    const state = loadFromLocalStorage(slotId);
    if (state) {
      playLoad();
      this.callbacks?.onLoad(state);
      this.hide();
    }
  }

  private deleteSlot(slotId: string): void {
    if (confirm(`Delete save "${slotId}"?`)) {
      deleteSaveSlot(slotId);
      this.renderOverlay();
    }
  }

  private saveToNextAvailable(): void {
    const slots = getSaveSlots();
    for (let i = 1; i <= MAX_MANUAL_SLOTS; i++) {
      const slotId = `save_${i}`;
      if (!slots.includes(slotId)) {
        this.saveToSlot(slotId);
        return;
      }
    }
    // All slots full, overwrite first
    this.saveToSlot('save_1');
  }

  public autosave(state: GameState): void {
    saveToLocalStorage(state, AUTOSAVE_SLOT);
  }
}

// Singleton
let saveManager: SaveManager | null = null;

export const getSaveManager = (): SaveManager => {
  if (!saveManager) {
    saveManager = new SaveManager();
  }
  return saveManager;
};

export const showSaveManager = (state: GameState, callbacks: SaveManagerCallbacks): void => {
  getSaveManager().show(state, callbacks);
};

export const autosave = (state: GameState): void => {
  getSaveManager().autosave(state);
};
