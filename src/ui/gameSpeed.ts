// Game Speed Controls - Adjust turn processing speed

const STORAGE_KEY = 'agi_race_game_speed';

export type GameSpeed = 'slow' | 'normal' | 'fast' | 'instant';

interface SpeedConfig {
  label: string;
  delay: number; // ms between AI decisions
  animationDuration: string; // CSS duration
}

export const SPEED_CONFIGS: Record<GameSpeed, SpeedConfig> = {
  slow: { label: 'Slow', delay: 2000, animationDuration: '600ms' },
  normal: { label: 'Normal', delay: 1000, animationDuration: '300ms' },
  fast: { label: 'Fast', delay: 300, animationDuration: '150ms' },
  instant: { label: 'Instant', delay: 0, animationDuration: '0ms' },
};

let currentSpeed: GameSpeed = 'normal';

export const loadGameSpeed = (): GameSpeed => {
  if (typeof localStorage === 'undefined') return 'normal';

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved in SPEED_CONFIGS) {
      currentSpeed = saved as GameSpeed;
      return currentSpeed;
    }
  } catch {
    // Ignore
  }

  return 'normal';
};

export const saveGameSpeed = (speed: GameSpeed): void => {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, speed);
    currentSpeed = speed;
  } catch {
    // Ignore
  }
};

export const getGameSpeed = (): GameSpeed => currentSpeed;

export const getSpeedConfig = (): SpeedConfig => SPEED_CONFIGS[currentSpeed];

export const cycleSpeed = (): GameSpeed => {
  const speeds: GameSpeed[] = ['slow', 'normal', 'fast', 'instant'];
  const currentIndex = speeds.indexOf(currentSpeed);
  const nextIndex = (currentIndex + 1) % speeds.length;
  const nextSpeed = speeds[nextIndex];
  saveGameSpeed(nextSpeed);
  return nextSpeed;
};

export const getSpeedLabel = (): string => {
  return SPEED_CONFIGS[currentSpeed].label;
};

export const getDelay = (): number => {
  return SPEED_CONFIGS[currentSpeed].delay;
};

// Apply speed to CSS custom properties
export const applySpeedToDocument = (): void => {
  const config = getSpeedConfig();
  document.documentElement.style.setProperty('--animation-duration', config.animationDuration);
};

// Initialize
loadGameSpeed();
