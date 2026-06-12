/**
 * effectFormatter.ts — shared human-readable labels and signed-delta formatting
 * for event effects. Used by EventModal, event panel in main.ts, and any other
 * place that renders EventEffect previews.
 */

import type { EventEffect } from '../data/events.js';

// ---------------------------------------------------------------------------
// Human-readable label map
// Covers all ResourceKey, stat keys, score keys, and the research branches.
// ---------------------------------------------------------------------------

export const EFFECT_KEY_LABELS: Record<string, string> = {
  // ResourceKey
  compute: 'Compute',
  cybersecurity: 'Cybersecurity',
  capital: 'Capital',
  influence: 'Influence',
  trust: 'Trust',
  // Stat keys
  safetyCulture: 'Safety Culture',
  opsec: 'OPSEC',
  hardPower: 'Hard Power',
  // Score keys
  capabilityScore: 'Capability',
  safetyScore: 'Safety Score',
  // Research branch ids
  capabilities: 'Capabilities Research',
  safety: 'Safety Research',
  ops: 'Operations Research',
  policy: 'Policy Research',
  // Misc
  exposure: 'Exposure',
  globalSafety: 'Global Safety',
};

/**
 * Return the human label for an effect key, falling back to a title-cased
 * version of the raw key if it is not in the map.
 */
export function humanLabel(key: string): string {
  if (key in EFFECT_KEY_LABELS) return EFFECT_KEY_LABELS[key];
  // Fallback: split camelCase → "Title Case"
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Format a numeric delta as a signed string using the proper Unicode minus
 * (U+2212) for negative values and '+' for non-negative.
 *
 * Examples:
 *   signedDelta(5)  → "+5"
 *   signedDelta(-5) → "−5"
 *   signedDelta(0)  → "+0"
 */
export function signedDelta(delta: number): string {
  return delta < 0 ? `−${Math.abs(delta)}` : `+${delta}`;
}

/**
 * Format a single EventEffect into a short human-readable chip label.
 * Returns a plain string (no HTML).
 */
export function formatSingleEffect(effect: EventEffect): string {
  switch (effect.kind) {
    case 'resource':
      return `${signedDelta(effect.delta)} ${humanLabel(effect.key)}`;
    case 'score':
      return `${signedDelta(effect.delta)} ${humanLabel(effect.key)}`;
    case 'stat':
      return `${signedDelta(effect.delta)} ${humanLabel(effect.key)}`;
    case 'research':
      return `${signedDelta(effect.delta)} ${humanLabel(effect.branch)}`;
    case 'globalSafety':
      return `${signedDelta(effect.delta)} ${humanLabel('globalSafety')}`;
    case 'exposure':
      return `${signedDelta(effect.delta)} ${humanLabel('exposure')}`;
    default:
      return '';
  }
}

/**
 * Format an array of EventEffects into a dot-separated preview string
 * (plain text, suitable for the event panel innerHTML chips).
 */
export function formatEffectPreviewText(effects: EventEffect[]): string {
  return effects
    .map(formatSingleEffect)
    .filter(Boolean)
    .join(' · ');
}
