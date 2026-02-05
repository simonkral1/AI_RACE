// TechNode component - Individual tech node for the horizontal tech tree
import type { TechNode as TechNodeType, TechEffect, FactionState, BranchId } from '../../core/types.js';
import { el, div, span, BRANCH_COLORS, STATUS_COLORS, ICONS } from './base.js';

export type TechNodeStatus = 'locked' | 'available' | 'unlocked';

export interface TechNodeCallbacks {
  onSelect?: (node: TechNodeType) => void;
  onResearch?: (node: TechNodeType) => void;
}

// Determine node status based on faction state
export function getTechNodeStatus(
  node: TechNodeType,
  faction: FactionState
): TechNodeStatus {
  if (faction.unlockedTechs.has(node.id)) {
    return 'unlocked';
  }

  // Check if all prerequisites are met
  const prereqsMet = node.prereqs.every((prereqId) =>
    faction.unlockedTechs.has(prereqId)
  );

  return prereqsMet ? 'available' : 'locked';
}

// Format effect for display
function formatEffect(effect: TechEffect): string {
  switch (effect.kind) {
    case 'capability':
      return `+${effect.delta} Capability`;
    case 'safety':
      return `+${effect.delta} Safety`;
    case 'resource':
      return `+${effect.delta} ${capitalize(effect.key)}`;
    case 'stat':
      return `+${effect.delta} ${formatStatKey(effect.key)}`;
    case 'unlockAgi':
      return 'Unlocks AGI Deployment';
    default:
      return '';
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatStatKey(key: 'safetyCulture' | 'opsec'): string {
  if (key === 'safetyCulture') return 'Safety Culture';
  if (key === 'opsec') return 'Opsec';
  return key;
}

// Get status icon SVG
function getStatusIcon(status: TechNodeStatus): string {
  switch (status) {
    case 'unlocked':
      return ICONS.check;
    case 'available':
      return ICONS.unlock;
    case 'locked':
      return ICONS.lock;
  }
}

// Get branch color
function getBranchColor(branch: BranchId): { primary: string; glow: string } {
  return BRANCH_COLORS[branch] || BRANCH_COLORS.capabilities;
}

// Create a single tech node element
export function createTechNode(
  node: TechNodeType,
  status: TechNodeStatus,
  callbacks: TechNodeCallbacks = {},
  isSelected = false
): HTMLElement {
  const branchColor = getBranchColor(node.branch);
  const statusIcon = getStatusIcon(status);

  // Format effects summary (first 2 effects)
  const effectsSummary = node.effects
    .slice(0, 2)
    .map(formatEffect)
    .join(', ');

  // Build class list
  const classList = ['tech-node'];
  classList.push(`tech-node--${status}`);
  if (isSelected) {
    classList.push('is-selected');
  }
  // Add linked class if has prerequisites (for connector line styling)
  if (node.prereqs.length > 0) {
    classList.push('tech-node--linked');
  }

  const nodeEl = div({
    className: classList.join(' '),
    dataset: {
      nodeId: node.id,
      branch: node.branch,
      status,
    },
    children: [
      // Title row
      div({
        className: 'tech-node__title',
        text: node.name,
      }),
      // Meta row: cost and status icon
      div({
        className: 'tech-node__meta',
        children: [
          span({
            text: `${node.cost} RP`,
          }),
          span({
            className: 'tech-node__icon',
            html: statusIcon,
          }),
        ],
      }),
      // Effects summary
      div({
        className: 'tech-node__effects',
        text: effectsSummary,
      }),
    ],
    onClick: (e: MouseEvent) => {
      e.stopPropagation();
      callbacks.onSelect?.(node);
    },
  });

  // Apply branch color accent to left border
  nodeEl.style.borderLeftColor = branchColor.primary;
  nodeEl.style.borderLeftWidth = '3px';

  // Apply status-specific styling
  const statusColors = STATUS_COLORS[status];
  if (status === 'available') {
    // Add pulsing animation for available nodes
    nodeEl.style.animation = 'tech-node-pulse 2s ease-in-out infinite';
  }

  return nodeEl;
}

// Render a tech node with full details (for detail panel)
export function createTechNodeDetail(
  node: TechNodeType,
  status: TechNodeStatus,
  faction: FactionState,
  callbacks: TechNodeCallbacks = {}
): HTMLElement {
  const branchColor = getBranchColor(node.branch);
  const statusIcon = getStatusIcon(status);

  // Calculate research progress towards this tech
  const branchProgress = faction.research[node.branch] || 0;
  const progressPercent = Math.min(100, (branchProgress / node.cost) * 100);

  // Format all effects
  const effectsList = node.effects.map(formatEffect);

  // Format prerequisites
  const prereqNames = node.prereqs.length > 0
    ? node.prereqs.join(', ')
    : 'None';

  // Status label
  const statusLabel =
    status === 'unlocked' ? 'UNLOCKED' :
    status === 'available' ? 'AVAILABLE' :
    'LOCKED';

  const detailEl = div({
    className: 'tech-screen__detail',
    children: [
      // Status badge
      div({
        className: `tech-detail__status tech-detail__status--${status}`,
        children: [
          span({ html: statusIcon }),
          span({ text: statusLabel }),
        ],
      }),
      // Title
      div({
        className: 'tech-detail__title',
        text: node.name,
      }),
      // Progress bar (only for available/locked)
      ...(status !== 'unlocked'
        ? [
            div({
              className: 'tech-detail__progress',
              children: [
                div({
                  className: 'tech-detail__progress-bar',
                  children: [
                    div({
                      className: 'tech-detail__progress-fill',
                      attrs: {
                        style: `width: ${progressPercent}%`,
                      },
                    }),
                  ],
                }),
                div({
                  className: 'tech-detail__progress-meta',
                  text: `${branchProgress} / ${node.cost} RP`,
                }),
              ],
            }),
          ]
        : []),
      // Effects section
      div({
        className: 'tech-detail__section',
        children: [
          span({ text: 'Effects:' }),
          el('ul', {
            className: 'tech-detail__list',
            children: effectsList.map((effect) =>
              el('li', { text: effect })
            ),
          }),
        ],
      }),
      // Prerequisites section
      div({
        className: 'tech-detail__section',
        children: [
          span({ text: 'Prerequisites: ' }),
          span({
            text: prereqNames,
            className: 'tech-detail__prereqs',
          }),
        ],
      }),
      // Action buttons (only for available nodes)
      ...(status === 'available' && callbacks.onResearch
        ? [
            div({
              className: 'tech-detail__actions',
              children: [
                el('button', {
                  className: 'tech-detail__button',
                  text: 'Research',
                  onClick: () => callbacks.onResearch?.(node),
                }),
              ],
            }),
          ]
        : []),
    ],
  });

  // Apply branch color accent
  detailEl.style.borderLeftColor = branchColor.primary;
  detailEl.style.borderLeftWidth = '3px';

  return detailEl;
}

// Empty state for detail panel
export function createTechNodeEmptyDetail(): HTMLElement {
  return div({
    className: 'tech-screen__detail',
    children: [
      div({
        className: 'tech-detail__section',
        children: [
          span({
            text: 'Select a technology node to view details',
            className: 'tech-detail__placeholder',
          }),
        ],
      }),
    ],
  });
}
