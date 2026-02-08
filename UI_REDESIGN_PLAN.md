# AGI Race UI Redesign Plan

## Executive Summary

A complete architectural overhaul of the AGI Race game UI, following John Carmack's principles of simplicity and strategy game best practices. The redesign eliminates the broken right panel behavior, removes unnecessary tabs, and introduces a modal-first approach for detail views.

---

## Problem Analysis

### Current Issues

1. **Right Panel Instability**: The `.panel--wide` with `min-width: 420px` combined with flexible grid columns causes layout shifts
2. **Tab Complexity**: Four tabs (Actions, Gamemaster, Events, Intel) in the Command Center add cognitive load
3. **Content Density**: Too much information crammed into available space
4. **Inconsistent Heights**: `.main-screen` with `max-height: calc(100vh - 280px)` creates scroll areas within panels
5. **Layout Coupling**: Grid columns `minmax(260px, 1fr) 2fr minmax(260px, 1fr)` fight each other at edge cases

### Root Cause

The current layout attempts to show everything simultaneously. Strategy games solve this through layered information: overview on screen, details on demand.

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Simplicity** | Only essential info visible; complexity hidden until needed |
| **Fixed Layout** | Pixel-based widths for sidebars; no `minmax` fights |
| **Modals for Details** | Events, full chat, intel details in overlay modals |
| **Progressive Disclosure** | Click to reveal, not scroll to find |
| **Immediate Responsiveness** | 60fps animations; no layout recalculations |
| **Consistency** | Same card, button, and spacing system throughout |

---

## New Layout Architecture

### Grid Specification

```
+------------------------------------------+
|              TOP BAR (64px fixed)        |
+--------+----------------+----------------+
|        |                |                |
| LEFT   |     CENTER     |     RIGHT      |
| 280px  |     flex: 1    |     320px      |
| fixed  |    (tech tree) |     fixed      |
|        |                |                |
+--------+----------------+----------------+
|              FOOTER (48px fixed)         |
+------------------------------------------+
```

### CSS Grid Definition

```css
.layout {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  grid-template-rows: 1fr;
  gap: 16px;
  height: calc(100vh - 64px - 48px - 32px); /* viewport minus header/footer/padding */
  padding: 16px 24px;
  overflow: hidden; /* CRITICAL: prevents layout shift */
}
```

### Column Breakdown

#### Left Panel (280px fixed) - Factions

```
Purpose: Faction overview and selection
Height: 100% of available space
Scroll: Internal scroll if needed

Content:
- Faction cards (compact mode)
- Player indicator badge
- Focus indicator (selected faction)
- Quick stats: Capability/Safety/Trust bars
```

#### Center Panel (flexible) - Tech Tree

```
Purpose: Primary gameplay viewport
Height: 100% of available space
Scroll: None (pan/zoom for tech tree)

Content:
- Branch tabs at top (Capabilities/Safety/Ops/Policy)
- Tech tree visualization (SVG canvas)
- Zoom controls (floating, bottom-right)
- No detail panel (click opens modal)
```

#### Right Panel (320px fixed) - Actions Only

```
Purpose: Player orders and turn control
Height: 100% of available space
Scroll: None (compact design fits)

Content:
- Turn indicator (Year/Quarter)
- Advance button (prominent)
- Player faction selector
- Freeform directive input
- "Ask Gamemaster" button (opens modal)
- Event notification badge (if pending)
```

---

## Modal Architecture

### Modal Types

| Modal | Trigger | Content |
|-------|---------|---------|
| **Event Modal** | Auto on event | Event description, choices, effects preview |
| **Gamemaster Modal** | "Ask Gamemaster" button | Full chat interface, quick actions |
| **Tech Detail Modal** | Click tech node | Tech info, requirements, research button |
| **Faction Detail Modal** | Click faction card | Full stats, relationships, intel |
| **Intel Modal** | Keyboard shortcut (I) | Victory tracker, AGI clock, focus dossier |
| **Victory Modal** | Game end | Endgame analysis, statistics, restart |

### Modal Design Spec

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 15, 12, 0.8);
  backdrop-filter: blur(8px);
  display: grid;
  place-items: center;
  z-index: 100;
}

.modal-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  width: min(600px, 90vw);
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
```

---

## Component Breakdown

### 1. TopBar Component

```
+------------------------------------------------------------------+
| [AGI RACE logo]  [2026 Q1] [Safety: 42] [Tension: Low]  [B] [?]  |
+------------------------------------------------------------------+

Specifications:
- Height: 64px fixed
- Logo: Left-aligned, Playfair Display font
- Status pills: Center-aligned
- Theme toggle + Help: Right-aligned
- No "Advance" or "Reset" buttons (moved to right panel)
```

### 2. FactionList Component

```
+------------------------+
| FACTIONS               |
+------------------------+
| [US Lab A]      * YOU  |
| Cap ====---- 45        |
| Saf ==------ 18        |
+------------------------+
| [China Lab]            |
| Cap ====----- Med      |
| Saf ==------- Low      |
+------------------------+
| ... more factions      |
+------------------------+

Specifications:
- Width: 280px fixed
- Card height: ~100px each
- Compact stat bars (no labels, just visual)
- Click: Opens FactionDetailModal
- Player badge: Small pill overlay
- Focus state: Border highlight
```

### 3. TechTree Component

```
+------------------------------------------------------+
| [Capabilities] [Safety] [Ops] [Policy]    [search]   |
+------------------------------------------------------+
|                                                      |
|    [Node] --- [Node] --- [Node]                     |
|       |                     |                        |
|    [Node]               [Node] --- [Node]           |
|                                                      |
|                                      [Zoom: +/-]     |
+------------------------------------------------------+

Specifications:
- Tabs: 4 branches, no "All" view
- Canvas: SVG-based, pannable
- Nodes: Click to open TechDetailModal
- Zoom: Floating controls, 50%-200% range
- Search: Filters/highlights nodes
- No inline detail panel
```

### 4. ActionsPanel Component

```
+------------------------+
| 2026 Q1          Turn 1|
+------------------------+
| [=== ADVANCE QUARTER ==]
+------------------------+
| Playing as:            |
| [US Lab A --------v]   |
+------------------------+
| Your Directive:        |
| [___________________]  |
| [Type your orders...]  |
+------------------------+
| [? Ask Gamemaster]     |
+------------------------+
| [!] Event Pending (1)  |
+------------------------+
| [Reset] [Stats] [Keys] |
+------------------------+

Specifications:
- Width: 320px fixed
- Turn indicator: Prominent, top
- Advance button: Full width, primary color
- Faction selector: Dropdown
- Directive: Text input, single line
- Gamemaster: Opens GamemasterModal
- Event badge: Shows pending count, opens EventModal
- Footer actions: Ghost buttons
```

### 5. EventModal Component

```
+------------------------------------------+
| [x]                          EVENT       |
+------------------------------------------+
| ## Compute Shortage Crisis              |
|                                          |
| Global chip supply disrupted. All labs   |
| face difficult choices about resource    |
| allocation.                              |
|                                          |
| Choose your response:                    |
|                                          |
| [ Stockpile chips ]                      |
|   -10 trust, +15 compute                 |
|                                          |
| [ Share resources ]                      |
|   +5 trust, -5 compute to all labs       |
|                                          |
| [ Lobby for policy ]                     |
|   +3 policy research                     |
+------------------------------------------+

Specifications:
- Auto-opens on event trigger
- Choice buttons: Full width, stacked
- Effect preview: Monospace, color-coded
- Cannot dismiss until choice made
- Sound effect on appearance
```

### 6. GamemasterModal Component

```
+------------------------------------------+
| [x]                     GAMEMASTER       |
+------------------------------------------+
| Quick Actions:                           |
| [What should I do?] [Explain safety]     |
| [Current situation] [Tech advice]        |
+------------------------------------------+
|                                          |
| [User message bubble]                    |
|                                          |
|           [Assistant response bubble]    |
|                                          |
| ... chat history scrolls up ...          |
|                                          |
+------------------------------------------+
| [Type a question...             ] [Send] |
+------------------------------------------+

Specifications:
- Width: 600px
- Chat area: Scrollable, bottom-anchored
- Quick actions: Horizontal button row
- Input: Bottom-fixed
- Loading state: Animated dots
```

### 7. TechDetailModal Component

```
+------------------------------------------+
| [x]    Neural Architecture v2    TECH   |
+------------------------------------------+
| Branch: Capabilities                     |
| Status: Available                        |
|                                          |
| Requirements:                            |
| - Basic ML Toolkit (unlocked)            |
| - 30 research points                     |
|                                          |
| Effects:                                 |
| - +8 Capability                          |
| - -2 Safety                              |
| - Unlocks: Advanced Reasoning            |
+------------------------------------------+
| Progress: [=====-----] 52/100            |
+------------------------------------------+
|                           [Research Now] |
+------------------------------------------+

Specifications:
- Width: 500px
- Requirements: Checklist style
- Effects: Color-coded (+green, -red)
- Progress bar: Branch research points
- Research button: Primary, disabled if unavailable
```

---

## CSS Architecture

### File Structure

```
src/ui/
  styles/
    _variables.css      # Design tokens
    _reset.css          # Box-sizing, margins
    _typography.css     # Font families, sizes
    _layout.css         # Grid, flexbox utilities
    _components.css     # Cards, buttons, inputs
    _modals.css         # Modal overlay system
    _animations.css     # Transitions, keyframes
    _theme-light.css    # Light theme overrides
    _theme-dark.css     # Dark theme (default)
  main.css              # Imports all partials
```

### Design Tokens

```css
:root {
  /* Spacing scale (8px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  /* Fixed dimensions */
  --sidebar-left: 280px;
  --sidebar-right: 320px;
  --topbar-height: 64px;
  --footer-height: 48px;
  --modal-width-sm: 400px;
  --modal-width-md: 500px;
  --modal-width-lg: 600px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 16px 48px rgba(0, 0, 0, 0.2);
  --shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.3);

  /* Animation */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}
```

### Light Theme (AI 2027 Style)

```css
body.theme-light {
  --bg: #faf9f7;           /* Warm off-white */
  --panel: #ffffff;        /* Pure white panels */
  --panel-soft: #f5f4f2;   /* Subtle background */
  --ink: #1a1a1a;          /* Near-black text */
  --muted: #6b7280;        /* Gray-500 */
  --accent: #2563eb;       /* Blue-600 */
  --accent-bright: #3b82f6;/* Blue-500 */
  --accent-2: #d97706;     /* Amber-600 */
  --danger: #dc2626;       /* Red-600 */
  --success: #16a34a;      /* Green-600 */
  --line: rgba(0, 0, 0, 0.08);

  --branch-capabilities: #ef4444;
  --branch-safety: #22c55e;
  --branch-ops: #3b82f6;
  --branch-policy: #8b5cf6;

  background: var(--bg);
}
```

---

## Interaction Patterns

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Advance turn (if no modal open) |
| `Escape` | Close modal / deselect |
| `1-5` | Focus faction |
| `I` | Open Intel modal |
| `G` | Open Gamemaster modal |
| `S` | Quick save |
| `L` | Quick load |
| `?` | Show shortcuts overlay |
| `B` | Toggle theme |

### Click Behaviors

| Element | Single Click | Double Click |
|---------|--------------|--------------|
| Faction Card | Focus faction | Open detail modal |
| Tech Node | Open detail modal | Research (if available) |
| Advance Button | Advance turn | - |
| Event Choice | Select choice | - |

### Hover States

```css
/* Cards and interactive elements */
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--accent);
}

/* Buttons */
.btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

/* Tech nodes */
.tech-node:hover {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

---

## State Management

### What Stays in Main View

- Current turn (year/quarter)
- Player faction selection
- Faction overview cards
- Tech tree (current branch)
- Advance button state

### What Moves to Modals

- Event resolution
- Gamemaster chat
- Tech details
- Faction details
- Victory tracker
- Intel dossier

### URL State (for sharing)

```
?faction=us_lab_a&year=2027&q=2
```

---

## Migration Strategy

### Phase 1: Layout Foundation

1. Create new layout grid with fixed sidebar widths
2. Remove all `minmax` flex columns
3. Set `overflow: hidden` on layout container
4. Test at multiple viewport sizes

### Phase 2: Modal System

1. Create modal overlay component
2. Port Event UI to EventModal
3. Port Gamemaster UI to GamemasterModal
4. Create TechDetailModal
5. Create FactionDetailModal

### Phase 3: Component Refactor

1. Simplify FactionList (compact mode only)
2. Refactor ActionsPanel (no tabs)
3. Clean up TechTree (remove inline detail)
4. Update TopBar (move actions)

### Phase 4: Polish

1. Add transitions/animations
2. Implement keyboard navigation
3. Add sound effects for modals
4. Test light theme
5. Responsive breakpoints

---

## Testing Checklist

- [ ] Layout does not shift on any interaction
- [ ] All modals open/close smoothly
- [ ] Keyboard shortcuts work with modals
- [ ] Light theme is cohesive
- [ ] No horizontal scroll at 1280px width
- [ ] Touch targets are 44px minimum
- [ ] Focus states are visible
- [ ] Screen reader announcements work

---

## File Changes Summary

| File | Action |
|------|--------|
| `index.html` | Simplify structure, remove tabs |
| `src/ui/main.ts` | Add modal system, remove tab handlers |
| `src/ui/styles.css` | Replace layout, add modal styles |
| `src/ui/simple.css` | Delete (merge relevant styles) |
| `src/ui/components/Modal.ts` | New file |
| `src/ui/components/EventModal.ts` | New file |
| `src/ui/components/GamemasterModal.ts` | New file |
| `src/ui/components/TechDetailModal.ts` | New file |
| `src/ui/components/FactionDetailModal.ts` | New file |
| `src/ui/components/ActionsPanel.ts` | Simplify |
| `src/ui/components/FactionCard.ts` | Compact mode |

---

## Visual Reference

```
BEFORE:                          AFTER:
+-------+-------+-------+        +------+----------+------+
|Faction|TechTree|Tabs  |        |Fac   | TechTree |Action|
|       |        +------+        |      |          |      |
|       |        |      |        |      |          |      |
|       |        |Scroll|        |      |          |      |
|       |        |Area  |        |      |          |      |
+-------+-------+-------+        +------+----------+------+

Tabs content in modals:          Fixed widths, no shifts
- Actions -> Right panel         Modals for details
- Gamemaster -> Modal            Clean separation
- Events -> Modal
- Intel -> Modal
```

---

## Conclusion

This redesign eliminates layout instability by using fixed pixel widths for sidebars and moving detail content into modals. The result is a cleaner, more responsive interface that follows strategy game conventions: overview at a glance, details on demand.

The key insight: **the problem is not CSS complexity, it is information density**. By moving secondary information into modals, the main view can be simple and stable.

---

*Plan created: 2026-02-06*
*Author: Architect Agent (Claude Opus 4.5)*
