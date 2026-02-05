// TechConnectors component - SVG overlay for tech tree prerequisite connections
import type { TechNode, BranchId } from '../../core/types.js';
import {
  createSvgContainer,
  createSvgElement,
  bezierPath,
  Point,
} from '../utils/svg.js';
import { BRANCH_COLORS } from './base.js';

export interface ConnectorOptions {
  defaultColor?: string;
  highlightColor?: string;
  strokeWidth?: number;
  highlightStrokeWidth?: number;
}

const DEFAULT_OPTIONS: Required<ConnectorOptions> = {
  defaultColor: 'rgba(255, 255, 255, 0.15)',
  highlightColor: 'rgba(246, 192, 106, 0.6)',
  strokeWidth: 2,
  highlightStrokeWidth: 3,
};

// Calculate center point of a DOM element relative to a container
function getElementCenter(
  element: HTMLElement,
  container: HTMLElement
): Point | null {
  const elemRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (elemRect.width === 0 || elemRect.height === 0) {
    return null;
  }

  return {
    x: elemRect.left - containerRect.left + elemRect.width / 2,
    y: elemRect.top - containerRect.top + elemRect.height / 2,
  };
}

// Get connection points on node edges (right side of source, left side of target)
function getConnectionPoints(
  sourceEl: HTMLElement,
  targetEl: HTMLElement,
  container: HTMLElement
): { from: Point; to: Point } | null {
  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (sourceRect.width === 0 || targetRect.width === 0) {
    return null;
  }

  // Connect from right edge of source to left edge of target
  const from: Point = {
    x: sourceRect.right - containerRect.left,
    y: sourceRect.top - containerRect.top + sourceRect.height / 2,
  };

  const to: Point = {
    x: targetRect.left - containerRect.left,
    y: targetRect.top - containerRect.top + targetRect.height / 2,
  };

  return { from, to };
}

// Create a single connector path
function createConnectorPathElement(
  from: Point,
  to: Point,
  color: string,
  strokeWidth: number,
  isHighlighted = false
): SVGPathElement {
  const path = createSvgElement('path', {
    d: bezierPath(from, to),
    fill: 'none',
    stroke: color,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    class: isHighlighted ? 'tech-connector tech-connector--highlighted' : 'tech-connector',
  });

  if (isHighlighted) {
    // Add glow effect for highlighted connectors
    path.style.filter = 'drop-shadow(0 0 4px rgba(246, 192, 106, 0.4))';
  }

  return path;
}

// Build a map of tech IDs to their DOM elements
function buildNodeElementMap(
  container: HTMLElement
): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  const nodeElements = container.querySelectorAll<HTMLElement>('[data-node-id]');

  nodeElements.forEach((el) => {
    const nodeId = el.dataset.nodeId;
    if (nodeId) {
      map.set(nodeId, el);
    }
  });

  return map;
}

// Create the SVG overlay with all connectors
export function createTechConnectors(
  container: HTMLElement,
  techNodes: TechNode[],
  selectedNodeId: string | null = null,
  options: ConnectorOptions = {}
): SVGSVGElement {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get container dimensions
  const containerRect = container.getBoundingClientRect();
  const width = container.scrollWidth;
  const height = container.scrollHeight;

  // Create SVG container
  const svg = createSvgContainer(width, height);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.pointerEvents = 'none';
  svg.style.overflow = 'visible';
  svg.classList.add('tech-connectors-overlay');

  // Build node element map
  const nodeMap = buildNodeElementMap(container);

  // Find nodes connected to the selected node (for highlighting)
  const highlightedConnections = new Set<string>();
  if (selectedNodeId) {
    const selectedNode = techNodes.find((n) => n.id === selectedNodeId);
    if (selectedNode) {
      // Highlight prereqs pointing to selected
      selectedNode.prereqs.forEach((prereqId) => {
        highlightedConnections.add(`${prereqId}->${selectedNodeId}`);
      });
      // Highlight nodes that depend on selected
      techNodes.forEach((node) => {
        if (node.prereqs.includes(selectedNodeId)) {
          highlightedConnections.add(`${selectedNodeId}->${node.id}`);
        }
      });
    }
  }

  // Create groups for layering (regular connectors behind, highlighted on top)
  const regularGroup = createSvgElement('g', { class: 'tech-connectors-regular' });
  const highlightGroup = createSvgElement('g', { class: 'tech-connectors-highlight' });

  // Create connector paths for each prerequisite relationship
  techNodes.forEach((node) => {
    const targetEl = nodeMap.get(node.id);
    if (!targetEl) return;

    node.prereqs.forEach((prereqId) => {
      const sourceEl = nodeMap.get(prereqId);
      if (!sourceEl) return;

      const points = getConnectionPoints(sourceEl, targetEl, container);
      if (!points) return;

      const connectionKey = `${prereqId}->${node.id}`;
      const isHighlighted = highlightedConnections.has(connectionKey);

      // Get branch color for the connector
      const prereqNode = techNodes.find((n) => n.id === prereqId);
      const branchColor = prereqNode
        ? BRANCH_COLORS[prereqNode.branch]?.primary
        : opts.defaultColor;

      const color = isHighlighted
        ? opts.highlightColor
        : branchColor ?? opts.defaultColor;
      const strokeWidth = isHighlighted
        ? opts.highlightStrokeWidth
        : opts.strokeWidth;

      const path = createConnectorPathElement(
        points.from,
        points.to,
        color,
        strokeWidth,
        isHighlighted
      );

      if (isHighlighted) {
        highlightGroup.appendChild(path);
      } else {
        regularGroup.appendChild(path);
      }
    });
  });

  svg.appendChild(regularGroup);
  svg.appendChild(highlightGroup);

  return svg;
}

// Update connectors when selection changes (more efficient than recreating)
export function updateTechConnectorHighlights(
  svg: SVGSVGElement,
  techNodes: TechNode[],
  selectedNodeId: string | null,
  options: ConnectorOptions = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Find connections to highlight
  const highlightedConnections = new Set<string>();
  if (selectedNodeId) {
    const selectedNode = techNodes.find((n) => n.id === selectedNodeId);
    if (selectedNode) {
      selectedNode.prereqs.forEach((prereqId) => {
        highlightedConnections.add(`${prereqId}->${selectedNodeId}`);
      });
      techNodes.forEach((node) => {
        if (node.prereqs.includes(selectedNodeId)) {
          highlightedConnections.add(`${selectedNodeId}->${node.id}`);
        }
      });
    }
  }

  // Update all paths
  const paths = svg.querySelectorAll<SVGPathElement>('.tech-connector');
  paths.forEach((path) => {
    const connectionKey = path.dataset.connection;
    const isHighlighted = connectionKey
      ? highlightedConnections.has(connectionKey)
      : false;

    if (isHighlighted) {
      path.classList.add('tech-connector--highlighted');
      path.setAttribute('stroke', opts.highlightColor);
      path.setAttribute('stroke-width', String(opts.highlightStrokeWidth));
      path.style.filter = 'drop-shadow(0 0 4px rgba(246, 192, 106, 0.4))';
    } else {
      path.classList.remove('tech-connector--highlighted');
      path.setAttribute('stroke', opts.defaultColor);
      path.setAttribute('stroke-width', String(opts.strokeWidth));
      path.style.filter = '';
    }
  });
}

// Resize the SVG to match container dimensions
export function resizeTechConnectors(
  svg: SVGSVGElement,
  container: HTMLElement
): void {
  const width = container.scrollWidth;
  const height = container.scrollHeight;

  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
}
