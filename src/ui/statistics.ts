// Statistics Tracking - Track player performance across sessions

const STORAGE_KEY = 'agi_race_statistics';

export interface GameStatistics {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalTurnsPlayed: number;
  fastestVictory: number | null; // Turns to win
  factionsPlayed: Record<string, number>;
  safeAgiDeployments: number;
  unsafeAgiEvents: number;
  lastPlayed: string;
}

const DEFAULT_STATS: GameStatistics = {
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  totalTurnsPlayed: 0,
  fastestVictory: null,
  factionsPlayed: {},
  safeAgiDeployments: 0,
  unsafeAgiEvents: 0,
  lastPlayed: '',
};

export const loadStatistics = (): GameStatistics => {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_STATS };

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_STATS };
  }
};

export const saveStatistics = (stats: GameStatistics): void => {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
};

export const recordGameStart = (factionId: string): void => {
  const stats = loadStatistics();
  stats.gamesPlayed++;
  stats.factionsPlayed[factionId] = (stats.factionsPlayed[factionId] || 0) + 1;
  stats.lastPlayed = new Date().toISOString();
  saveStatistics(stats);
};

export const recordGameEnd = (
  won: boolean,
  turnsPlayed: number,
  safeDeployment: boolean
): void => {
  const stats = loadStatistics();

  if (won) {
    stats.gamesWon++;
    stats.safeAgiDeployments++;
    if (stats.fastestVictory === null || turnsPlayed < stats.fastestVictory) {
      stats.fastestVictory = turnsPlayed;
    }
  } else {
    stats.gamesLost++;
    if (!safeDeployment) {
      stats.unsafeAgiEvents++;
    }
  }

  stats.totalTurnsPlayed += turnsPlayed;
  saveStatistics(stats);
};

export const recordTurn = (): void => {
  const stats = loadStatistics();
  stats.totalTurnsPlayed++;
  saveStatistics(stats);
};

export const getWinRate = (): number => {
  const stats = loadStatistics();
  if (stats.gamesPlayed === 0) return 0;
  return Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
};

export const resetStatistics = (): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};

// Statistics Panel UI

export const createStatisticsOverlay = (): HTMLElement => {
  const stats = loadStatistics();
  const winRate = getWinRate();

  const overlay = document.createElement('div');
  overlay.id = 'statisticsOverlay';
  overlay.className = 'overlay statistics-overlay is-hidden';
  overlay.innerHTML = `
    <div class="statistics-panel">
      <div class="statistics-panel__header">
        <h2 class="statistics-panel__title">Statistics</h2>
        <button class="statistics-panel__close" aria-label="Close">&times;</button>
      </div>
      <div class="statistics-panel__content">
        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-item__value">${stats.gamesPlayed}</div>
            <div class="stat-item__label">Games Played</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__value">${stats.gamesWon}</div>
            <div class="stat-item__label">Victories</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__value">${winRate}%</div>
            <div class="stat-item__label">Win Rate</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__value">${stats.fastestVictory ?? '-'}</div>
            <div class="stat-item__label">Fastest Win (turns)</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__value">${stats.totalTurnsPlayed}</div>
            <div class="stat-item__label">Total Turns</div>
          </div>
          <div class="stat-item">
            <div class="stat-item__value">${stats.safeAgiDeployments}</div>
            <div class="stat-item__label">Safe AGI Deployments</div>
          </div>
        </div>
        ${Object.keys(stats.factionsPlayed).length > 0 ? `
          <div class="statistics-panel__section">
            <h3 class="statistics-panel__subtitle">Factions Played</h3>
            <div class="faction-stats">
              ${Object.entries(stats.factionsPlayed)
                .sort((a, b) => b[1] - a[1])
                .map(([faction, count]) => `
                  <div class="faction-stat">
                    <span>${faction}</span>
                    <span>${count} games</span>
                  </div>
                `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
      <div class="statistics-panel__footer">
        <button class="statistics-panel__btn statistics-panel__btn--reset">Reset Statistics</button>
      </div>
    </div>
  `;

  return overlay;
};

let statisticsOverlay: HTMLElement | null = null;

export const showStatistics = (): void => {
  if (statisticsOverlay) {
    statisticsOverlay.remove();
  }

  statisticsOverlay = createStatisticsOverlay();
  document.body.appendChild(statisticsOverlay);
  statisticsOverlay.classList.remove('is-hidden');

  // Bind events
  statisticsOverlay.querySelector('.statistics-panel__close')?.addEventListener('click', hideStatistics);
  statisticsOverlay.addEventListener('click', (e) => {
    if (e.target === statisticsOverlay) hideStatistics();
  });
  statisticsOverlay.querySelector('.statistics-panel__btn--reset')?.addEventListener('click', () => {
    if (confirm('Reset all statistics? This cannot be undone.')) {
      resetStatistics();
      hideStatistics();
      showStatistics(); // Refresh
    }
  });
};

export const hideStatistics = (): void => {
  statisticsOverlay?.classList.add('is-hidden');
};
