// Pax Historia-inspired Free-form Action System
// AI Strategic Analysis with expandable suggestions + free-form text input

import { FactionState, GameState } from '../core/types.js';

export interface StrategicSituation {
  id: string;
  title: string;
  description: string;
  potentialResponses: {
    id: string;
    title: string;
    description: string;
  }[];
}

export interface FreeformActionCallbacks {
  onDirectiveSubmit: (directive: string) => void;
  onSuggestedAction: (suggestion: string) => void;
}

// Generate AI strategic analysis based on game state
function generateStrategicAnalysis(faction: FactionState, state: GameState): StrategicSituation[] {
  const situations: StrategicSituation[] = [];
  const labs = Object.values(state.factions).filter(f => f.type === 'lab');
  const govs = Object.values(state.factions).filter(f => f.type === 'government');
  const leadingLab = labs.sort((a, b) => b.capabilityScore - a.capabilityScore)[0];
  const isPlayer = faction.id === leadingLab?.id;

  // Safety vs Capability Trade-off
  if (faction.type === 'lab') {
    const safetyGap = faction.capabilityScore - faction.safetyScore;
    if (safetyGap > 15) {
      situations.push({
        id: 'safety-deficit',
        title: 'The Safety Deficit',
        description: `Your capability outpaces your safety measures by ${Math.round(safetyGap)} points. Regulators are watching, and a misstep could be catastrophic.`,
        potentialResponses: [
          {
            id: 'safety-pause',
            title: 'Initiate Safety Pause',
            description: 'Halt capability research for this quarter to focus entirely on alignment and safety protocols.'
          },
          {
            id: 'parallel-track',
            title: 'Parallel Safety Track',
            description: 'Split resources between capability and safety research, accepting slower progress on both fronts.'
          },
          {
            id: 'accept-risk',
            title: 'Accept the Risk',
            description: 'Continue pushing capabilities forward. First to AGI wins, regardless of safety margins.'
          }
        ]
      });
    }

    // Competition pressure
    if (!isPlayer && leadingLab) {
      const gap = leadingLab.capabilityScore - faction.capabilityScore;
      if (gap > 10) {
        situations.push({
          id: 'competitive-pressure',
          title: 'Falling Behind',
          description: `${leadingLab.name} leads by ${Math.round(gap)} capability points. Without aggressive action, you may be rendered obsolete.`,
          potentialResponses: [
            {
              id: 'accelerate',
              title: 'Accelerate Timeline',
              description: 'Push development faster with higher exposure risk to close the gap.'
            },
            {
              id: 'hire-talent',
              title: 'Talent Acquisition',
              description: 'Invest heavily in recruiting top researchers away from competitors.'
            },
            {
              id: 'niche-strategy',
              title: 'Specialize',
              description: 'Focus on a niche area where you can establish dominance rather than competing head-to-head.'
            }
          ]
        });
      }
    }

    // Trust issues
    if (faction.resources.trust < 40) {
      situations.push({
        id: 'trust-crisis',
        title: 'Public Trust Crisis',
        description: `Public trust at ${Math.round(faction.resources.trust)}% is dangerously low. A scandal could trigger regulatory crackdown or worse.`,
        potentialResponses: [
          {
            id: 'open-research',
            title: 'Open Research Initiative',
            description: 'Publish research openly and engage with safety advocates to rebuild trust.'
          },
          {
            id: 'pr-campaign',
            title: 'Public Relations Campaign',
            description: 'Invest in positive messaging about AI benefits while downplaying risks.'
          },
          {
            id: 'stay-quiet',
            title: 'Maintain Low Profile',
            description: 'Avoid public attention and focus on internal development.'
          }
        ]
      });
    }

    // Compute shortage
    if (faction.resources.compute < 30) {
      situations.push({
        id: 'compute-shortage',
        title: 'The Compute Crunch',
        description: `With only ${Math.round(faction.resources.compute)} compute units, your training runs are limited. Major breakthroughs require infrastructure investment.`,
        potentialResponses: [
          {
            id: 'build-datacenter',
            title: 'Build Infrastructure',
            description: 'Invest capital to build out compute capacity for larger training runs.'
          },
          {
            id: 'cloud-partnership',
            title: 'Cloud Partnership',
            description: 'Negotiate access to external compute resources through strategic partnerships.'
          },
          {
            id: 'efficient-algos',
            title: 'Algorithmic Efficiency',
            description: 'Focus research on more compute-efficient training methods.'
          }
        ]
      });
    }
  }

  // Government-specific situations
  if (faction.type === 'government') {
    // Runaway labs
    const riskyLabs = labs.filter(l => l.capabilityScore > l.safetyScore + 10);
    if (riskyLabs.length > 0) {
      situations.push({
        id: 'unsafe-development',
        title: 'Unsafe Development Detected',
        description: `${riskyLabs.map(l => l.name).join(' and ')} appear to be prioritizing capability over safety. Intervention may be necessary.`,
        potentialResponses: [
          {
            id: 'regulate',
            title: 'Impose Regulations',
            description: 'Draft and enforce new safety requirements that slow development but ensure compliance.'
          },
          {
            id: 'subsidize-safety',
            title: 'Fund Safety Research',
            description: 'Provide grants specifically for safety and alignment work.'
          },
          {
            id: 'monitor',
            title: 'Increase Monitoring',
            description: 'Establish reporting requirements and inspection protocols without direct intervention.'
          }
        ]
      });
    }

    // International competition
    const foreignLabs = labs.filter(l => !l.id.includes(faction.id.includes('us') ? 'us' : 'cn'));
    const foreignLeader = foreignLabs.sort((a, b) => b.capabilityScore - a.capabilityScore)[0];
    if (foreignLeader && foreignLeader.capabilityScore > 40) {
      situations.push({
        id: 'foreign-competition',
        title: 'International AI Race',
        description: `Foreign competitors like ${foreignLeader.name} are advancing rapidly. National security implications are significant.`,
        potentialResponses: [
          {
            id: 'boost-domestic',
            title: 'Boost Domestic Labs',
            description: 'Increase funding and resources to domestic AI companies.'
          },
          {
            id: 'international-agreement',
            title: 'Seek International Agreement',
            description: 'Propose a global framework for AI safety and development coordination.'
          },
          {
            id: 'strategic-initiative',
            title: 'Launch Strategic Initiative',
            description: 'Create a national AI program with combined government and private sector resources.'
          }
        ]
      });
    }
  }

  // Global safety concern
  if (state.globalSafety < 50) {
    situations.push({
      id: 'global-risk',
      title: 'Rising Global Risk',
      description: `Global AI safety index at ${Math.round(state.globalSafety)}%. The entire field is moving faster than safety measures can keep up.`,
      potentialResponses: [
        {
          id: 'safety-coalition',
          title: 'Form Safety Coalition',
          description: 'Coordinate with other factions to establish safety standards.'
        },
        {
          id: 'safety-research',
          title: 'Prioritize Safety Research',
          description: 'Dedicate significant resources to alignment and interpretability.'
        },
        {
          id: 'public-awareness',
          title: 'Public Awareness Campaign',
          description: 'Raise public concern about AI risks to create pressure for caution.'
        }
      ]
    });
  }

  // Return top 3 most relevant situations
  return situations.slice(0, 3);
}

export function renderFreeformActions(
  container: HTMLElement,
  faction: FactionState,
  state: GameState,
  callbacks: FreeformActionCallbacks
): void {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'freeform-actions';

  // Header
  const header = document.createElement('div');
  header.className = 'freeform-actions__header';
  header.innerHTML = `
    <div class="freeform-actions__title">Actions</div>
    <div class="freeform-actions__subtitle">
      Submit directives for ${faction.name} for ${state.year} Q${state.quarter}.
      Your actions will affect how the world responds.
    </div>
  `;
  wrapper.appendChild(header);

  // AI Strategic Analysis Section
  const analysisSection = document.createElement('div');
  analysisSection.className = 'freeform-actions__analysis';

  const analysisHeader = document.createElement('div');
  analysisHeader.className = 'freeform-actions__analysis-header';
  analysisHeader.innerHTML = `
    <span class="freeform-actions__analysis-title">AI Strategic Analysis</span>
    <button class="freeform-actions__refresh" title="Refresh analysis">
      <span>&#x21bb;</span>
    </button>
  `;
  analysisSection.appendChild(analysisHeader);

  // Generate strategic situations
  const situations = generateStrategicAnalysis(faction, state);

  const situationsList = document.createElement('div');
  situationsList.className = 'freeform-actions__situations';

  for (const situation of situations) {
    const situationEl = document.createElement('div');
    situationEl.className = 'freeform-actions__situation';
    situationEl.dataset.id = situation.id;

    const situationHeader = document.createElement('div');
    situationHeader.className = 'freeform-actions__situation-header';
    situationHeader.innerHTML = `
      <span class="freeform-actions__situation-title">${situation.title}</span>
      <span class="freeform-actions__situation-toggle">&#x203A;</span>
    `;
    situationEl.appendChild(situationHeader);

    const situationContent = document.createElement('div');
    situationContent.className = 'freeform-actions__situation-content';
    situationContent.style.display = 'none';

    situationContent.innerHTML = `
      <p class="freeform-actions__situation-desc">${situation.description}</p>
      <div class="freeform-actions__responses-label">Potential Responses:</div>
      <div class="freeform-actions__responses">
        ${situation.potentialResponses.map(r => `
          <button class="freeform-actions__response" data-response-id="${r.id}" data-response-text="${r.title}: ${r.description}">
            <div class="freeform-actions__response-title">${r.title}</div>
            <div class="freeform-actions__response-desc">${r.description}</div>
          </button>
        `).join('')}
      </div>
    `;
    situationEl.appendChild(situationContent);

    // Toggle expansion
    situationHeader.addEventListener('click', () => {
      const isOpen = situationContent.style.display !== 'none';
      situationContent.style.display = isOpen ? 'none' : 'block';
      situationEl.classList.toggle('is-expanded', !isOpen);
    });

    situationsList.appendChild(situationEl);
  }

  if (situations.length === 0) {
    situationsList.innerHTML = `
      <div class="freeform-actions__no-situations">
        No immediate strategic concerns. Consider your long-term goals.
      </div>
    `;
  }

  analysisSection.appendChild(situationsList);
  wrapper.appendChild(analysisSection);

  // Free-form input section
  const inputSection = document.createElement('div');
  inputSection.className = 'freeform-actions__input-section';
  inputSection.innerHTML = `
    <div class="freeform-actions__input-wrapper">
      <input
        type="text"
        class="freeform-actions__input"
        placeholder="Enter your directive..."
        maxlength="200"
      />
      <button class="freeform-actions__ai-help" title="AI suggestions">
        <span>&#x2728;</span>
      </button>
      <button class="freeform-actions__submit" title="Submit directive">
        <span>&#x27A4;</span>
      </button>
    </div>
  `;
  wrapper.appendChild(inputSection);

  container.appendChild(wrapper);

  // Bind events
  const input = container.querySelector<HTMLInputElement>('.freeform-actions__input');
  const submitBtn = container.querySelector<HTMLButtonElement>('.freeform-actions__submit');
  const aiHelpBtn = container.querySelector<HTMLButtonElement>('.freeform-actions__ai-help');

  // Submit on button click
  submitBtn?.addEventListener('click', () => {
    const directive = input?.value.trim();
    if (directive) {
      callbacks.onDirectiveSubmit(directive);
      if (input) input.value = '';
    }
  });

  // Submit on Enter
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const directive = input.value.trim();
      if (directive) {
        callbacks.onDirectiveSubmit(directive);
        input.value = '';
      }
    }
  });

  // AI help (could trigger gamemaster)
  aiHelpBtn?.addEventListener('click', () => {
    callbacks.onSuggestedAction('What actions should I take this quarter?');
  });

  // Response button clicks
  container.querySelectorAll<HTMLButtonElement>('.freeform-actions__response').forEach(btn => {
    btn.addEventListener('click', () => {
      const responseText = btn.dataset.responseText || '';
      if (input && responseText) {
        input.value = responseText;
        input.focus();
      }
    });
  });

  // Refresh analysis
  container.querySelector('.freeform-actions__refresh')?.addEventListener('click', () => {
    renderFreeformActions(container, faction, state, callbacks);
  });
}
