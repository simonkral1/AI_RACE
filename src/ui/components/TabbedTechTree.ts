// Tabbed Tech Tree - Main component combining tabs and branch screens
import { div } from './base.js';
import { BranchId, FactionState, TechNode } from '../../core/types.js';
import { TECH_TREE } from '../../data/techTree.js';
import { renderTechTreeTabs, BRANCH_TABS } from './TechTreeTabs.js';
import { renderBranchScreen, getBranchProgress, BranchScreenState } from './BranchScreen.js';

export interface TabbedTechTreeCallbacks {
  onResearch: (techId: string) => void;
  onBranchChange?: (branch: BranchId) => void;
}

export interface TabbedTechTreeState {
  activeBranch: BranchId;
  selectedTechId: string | null;
  hoveredTechId: string | null;
}

// Create the controller for the tabbed tech tree
export function createTabbedTechTree(
  container: HTMLElement,
  faction: FactionState,
  initialState: Partial<TabbedTechTreeState>,
  callbacks: TabbedTechTreeCallbacks
): {
  update: (faction: FactionState, state: Partial<TabbedTechTreeState>) => void;
  getState: () => TabbedTechTreeState;
  destroy: () => void;
} {
  // Internal state
  let state: TabbedTechTreeState = {
    activeBranch: initialState.activeBranch || 'capabilities',
    selectedTechId: initialState.selectedTechId || null,
    hoveredTechId: initialState.hoveredTechId || null,
  };

  let currentFaction = faction;

  // Render the component
  function render() {
    container.innerHTML = '';

    const wrapper = div({ className: 'tabbed-tech-tree' });

    // Calculate branch progress for tabs
    const branchProgress = getBranchProgress(currentFaction);

    // Render tabs
    const tabs = renderTechTreeTabs({
      activeBranch: state.activeBranch,
      branchProgress,
      onTabChange: (branch) => {
        state.activeBranch = branch;
        state.selectedTechId = null; // Clear selection when switching branches
        callbacks.onBranchChange?.(branch);
        render();
      },
    });

    // Render active branch screen
    const branchScreenState: BranchScreenState = {
      selectedTechId: state.selectedTechId,
      hoveredTechId: state.hoveredTechId,
    };

    const branchScreen = renderBranchScreen(
      state.activeBranch,
      currentFaction,
      branchScreenState,
      {
        onResearch: (techId) => {
          callbacks.onResearch(techId);
          // Clear selection after research
          state.selectedTechId = null;
          render();
        },
        onTechSelect: (techId) => {
          state.selectedTechId = techId;
          render();
        },
      }
    );

    wrapper.appendChild(tabs);
    wrapper.appendChild(branchScreen);

    container.appendChild(wrapper);
  }

  // Initial render
  render();

  return {
    update(newFaction: FactionState, newState: Partial<TabbedTechTreeState>) {
      currentFaction = newFaction;
      state = { ...state, ...newState };
      render();
    },

    getState() {
      return { ...state };
    },

    destroy() {
      container.innerHTML = '';
    },
  };
}

// Simple render function for one-shot rendering
export function renderTabbedTechTree(
  faction: FactionState,
  state: TabbedTechTreeState,
  callbacks: TabbedTechTreeCallbacks
): HTMLElement {
  const wrapper = div({ className: 'tabbed-tech-tree' });

  // Calculate branch progress for tabs
  const branchProgress = getBranchProgress(faction);

  // Render tabs
  const tabs = renderTechTreeTabs({
    activeBranch: state.activeBranch,
    branchProgress,
    onTabChange: (branch) => {
      callbacks.onBranchChange?.(branch);
    },
  });

  // Render active branch screen
  const branchScreenState: BranchScreenState = {
    selectedTechId: state.selectedTechId,
    hoveredTechId: state.hoveredTechId,
  };

  const branchScreen = renderBranchScreen(
    state.activeBranch,
    faction,
    branchScreenState,
    {
      onResearch: callbacks.onResearch,
      onTechSelect: () => {}, // No-op for one-shot render
    }
  );

  wrapper.appendChild(tabs);
  wrapper.appendChild(branchScreen);

  return wrapper;
}
