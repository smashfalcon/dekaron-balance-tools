/* upgrade-simulator/js/script.js */

const state = {
  // Default Talisman usage:
  // +1..+4 => None (index 0)
  // +5..+6 => +18% (index 1)
  // +7 => +20% (index 2)
  // +8 => +25% (index 3)
  // +9 => +30% (index 4)
  talismanStrategy: {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 1,
    6: 1,
    7: 2,
    8: 3,
    9: 4
  },
  baseRates: {
    1: 0.95,
    2: 0.90,
    3: 0.85,
    4: 0.70,
    5: 0.60,
    6: 0.50,
    7: 0.30,
    8: 0.20,
    9: 0.10
  },
  talismanOptions: [
    { name: "None", rate: 0 },
    { name: "+18% Talisman", rate: 0.18 },
    { name: "+20% Talisman", rate: 0.20 },
    { name: "+25% Talisman", rate: 0.25 },
    { name: "+30% Talisman", rate: 0.30 },
    { name: "+50% Talisman", rate: 0.50 }
  ],
  // User inputs (defaults):
  startingPoint: 0,
  targetPlus: 9,
  confidenceLevel: 95,
  numSimulatedPlayers: 1000,
  // Computed compound rates (for theoretical, no-degrade)
  compoundRates: {},
  // Charts
  charts: {
    probability: null,
    attemptsDistribution: null
  },
  // Simulation results
  simulationAttempts: []
};

const elements = {
  configurationTable: document.getElementById("configurationTable"),
  startingPoint: document.getElementById("startingPoint"),
  targetPlus: document.getElementById("targetPlus"),
  confidenceLevel: document.getElementById("confidenceLevel"),
  targetError: document.getElementById("targetError"),
  numSimulatedPlayers: document.getElementById("numSimulatedPlayers"),
  runSimulationButton: document.getElementById("runSimulationButton"),
  resultsContainer: document.getElementById("resultsContainer"),
  probabilityChart: document.getElementById("probabilityChart"),
  confidenceInfo: document.getElementById("confidenceInfo"),
  attemptsDistributionChart: document.getElementById("attemptsDistributionChart"),
  luckyAttempts: document.getElementById("luckyAttempts"),
  luckySuccessRate: document.getElementById("luckySuccessRate"),
  avgAttempts: document.getElementById("avgAttempts"),
  avgSuccessRate: document.getElementById("avgSuccessRate"),
  unluckyAttempts: document.getElementById("unluckyAttempts"),
  unluckySuccessRate: document.getElementById("unluckySuccessRate")
};

function initApp() {
  try {
    initConfigurationTable();
    attachEventListeners();
    validateSelections();
    runAllCalculations();
  } catch (err) {
    console.error("Error during init:", err);
  }
}

function initConfigurationTable() {
  const tableBody = elements.configurationTable.querySelector("tbody");
  tableBody.innerHTML = "";
  calculateCompoundRates();
  for (let plus = 1; plus <= 9; plus++) {
    const row = document.createElement("tr");
    const plusCell = document.createElement("td");
    plusCell.textContent = `+${plus}`;
    const baseRateCell = document.createElement("td");
    baseRateCell.className = "text-right";
    baseRateCell.textContent = `${(state.baseRates[plus] * 100).toFixed(0)}%`;
    const talismanCell = document.createElement("td");
    const selectEl = document.createElement("select");
    selectEl.id = `talisman-${plus}`;
    state.talismanOptions.forEach((option, index) => {
      const opt = document.createElement("option");
      opt.value = index;
      opt.textContent = option.name;
      selectEl.appendChild(opt);
    });
    selectEl.value = state.talismanStrategy[plus];
    selectEl.addEventListener("change", (e) => {
      state.talismanStrategy[plus] = parseInt(e.target.value);
      updateConfigurationTable();
    });
    talismanCell.appendChild(selectEl);
    const totalRateCell = document.createElement("td");
    totalRateCell.className = "text-right";
    totalRateCell.id = `total-rate-${plus}`;
    totalRateCell.textContent = calculateTotalSuccessRate(plus).toFixed(2) + "%";
    const compoundRateCell = document.createElement("td");
    compoundRateCell.className = "text-right";
    compoundRateCell.id = `compound-rate-${plus}`;
    compoundRateCell.textContent = (state.compoundRates[plus] * 100).toFixed(2) + "%";
    row.appendChild(plusCell);
    row.appendChild(baseRateCell);
    row.appendChild(talismanCell);
    row.appendChild(totalRateCell);
    row.appendChild(compoundRateCell);
    tableBody.appendChild(row);
  }
}

function updateConfigurationTable() {
  calculateCompoundRates();
  for (let plus = 1; plus <= 9; plus++) {
    const totalRateCell = document.getElementById(`total-rate-${plus}`);
    if (totalRateCell) {
      totalRateCell.textContent = calculateTotalSuccessRate(plus).toFixed(2) + "%";
    }
    const compoundRateCell = document.getElementById(`compound-rate-${plus}`);
    if (compoundRateCell) {
      compoundRateCell.textContent = (state.compoundRates[plus] * 100).toFixed(2) + "%";
    }
  }
}

function attachEventListeners() {
  elements.startingPoint.addEventListener("change", () => {
    state.startingPoint = parseInt(elements.startingPoint.value);
    validateSelections();
  });

  elements.targetPlus.addEventListener("change", () => {
    state.targetPlus = parseInt(elements.targetPlus.value);
    validateSelections();
  });

  elements.confidenceLevel.addEventListener("input", () => {
    state.confidenceLevel = parseFloat(elements.confidenceLevel.value);
  });

  elements.numSimulatedPlayers.addEventListener("input", () => {
    state.numSimulatedPlayers = parseInt(elements.numSimulatedPlayers.value);
  });

  elements.runSimulationButton.addEventListener("click", () => {
    runAllCalculations();
  });
}

function validateSelections() {
  const sp = parseInt(elements.startingPoint.value);
  const tp = parseInt(elements.targetPlus.value);
  if (tp <= sp) {
    elements.targetError.textContent = "Target plus level must be higher than starting point.";
    return false;
  }
  elements.targetError.textContent = "";
  return true;
}

function calculateCompoundRates() {
  let compoundRate = 1.0;
  for (let plus = 1; plus <= 9; plus++) {
    const totalRate = calculateTotalSuccessRate(plus) / 100;
    compoundRate *= totalRate;
    state.compoundRates[plus] = compoundRate;
  }
}

function calculateTotalSuccessRate(plus) {
  const baseRate = state.baseRates[plus];
  const talismanIndex = state.talismanStrategy[plus];
  const talismanBoost = state.talismanOptions[talismanIndex].rate;
  return Math.min(100, (baseRate + talismanBoost) * 100);
}

function calculateSuccessProbability() {
  let startProb = 1.0;
  if (state.startingPoint > 0) {
    startProb = state.compoundRates[state.startingPoint];
  }
  const targetProb = state.compoundRates[state.targetPlus];
  return targetProb / startProb;
}

function calculateAverageAttempts() {
  const p = calculateSuccessProbability();
  return 1 / p;
}

function calculateConfidenceAttempts(confLevel) {
  const p = calculateSuccessProbability();
  const c = confLevel / 100;
  if (p < 1e-9) {
    return Number.MAX_SAFE_INTEGER;
  }
  const denominator = Math.log(1 - p);
  if (Math.abs(denominator) < 1e-9) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.ceil(Math.log(1 - c) / denominator);
}

function updateTheoreticalDisplay() {
  const avgAttempts = calculateAverageAttempts();
  const confAttempts = calculateConfidenceAttempts(state.confidenceLevel);
  const successProb = calculateSuccessProbability();

  elements.resultsContainer.innerHTML = `
    <p class="mb-2">
      <strong>From +${state.startingPoint} to +${state.targetPlus} (no degrade theoretical):</strong>
    </p>
    <p class="mb-2">
      Expected attempts (theoretical): <strong>${avgAttempts.toFixed(2)}</strong>
    </p>
    <p class="mb-2">
      Success probability per attempt: <strong>${(successProb * 100).toFixed(2)}%</strong>
    </p>
    <p>
      Attempts for ${state.confidenceLevel}% confidence: <strong>${confAttempts}</strong>
    </p>
  `;
}

function generateProbabilityData() {
  const p = calculateSuccessProbability();
  const confAttempts = calculateConfidenceAttempts(state.confidenceLevel);

  const data = [];
  let cumProb = 0;
  for (let i = 1; i <= confAttempts; i++) {
    const prob = p * Math.pow(1 - p, i - 1);
    cumProb += prob;
    data.push({
      attempt: i,
      probability: prob,
      cumulativeProbability: cumProb
    });
  }
  return data;
}

function updateProbabilityChart() {
  if (state.charts.probability) {
    state.charts.probability.destroy();
  }
  if (!elements.probabilityChart) return;

  const data = generateProbabilityData();
  const chartData = {
    labels: data.map(d => d.attempt),
    datasets: [
      {
        label: "Success Probability",
        data: data.map(d => d.probability * 100),
        backgroundColor: "rgba(88, 101, 242, 0.5)",
        borderColor: "rgba(88, 101, 242, 1)",
        borderWidth: 1
      },
      {
        label: "Cumulative Probability",
        data: data.map(d => d.cumulativeProbability * 100),
        backgroundColor: "rgba(59, 165, 92, 0.5)",
        borderColor: "rgba(59, 165, 92, 1)",
        borderWidth: 1,
        type: "line"
      }
    ]
  };

  const ctx = elements.probabilityChart.getContext("2d");
  state.charts.probability = new Chart(ctx, {
    type: "bar",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "Number of Attempts",
            color: "#dcddde"
          },
          ticks: {
            color: "#b9bbbe"
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          }
        },
        y: {
          title: {
            display: true,
            text: "Probability (%)",
            color: "#dcddde"
          },
          ticks: {
            color: "#b9bbbe"
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#dcddde"
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || "";
              const value = context.raw.toFixed(2);
              return `${label}: ${value}%`;
            }
          }
        }
      }
    }
  });

  const confAttempts = calculateConfidenceAttempts(state.confidenceLevel);
  elements.confidenceInfo.innerHTML = `
    <div>
      <strong>${state.confidenceLevel}% Confidence (no degrade):</strong> 
      You need <strong>${confAttempts}</strong> attempts to have a 
      ${state.confidenceLevel}% chance of reaching +${state.targetPlus} from +${state.startingPoint}.
    </div>
  `;
}

function runSimulation() {
  state.simulationAttempts = [];
  for (let i = 0; i < state.numSimulatedPlayers; i++) {
    let currentPlus = state.startingPoint;
    let attempts = 0;
    while (currentPlus < state.targetPlus) {
      attempts++;
      const successRate = calculateTotalSuccessRate(currentPlus + 1) / 100;
      if (Math.random() < successRate) {
        currentPlus++;
      } else {
        currentPlus = state.startingPoint;
      }
    }
    state.simulationAttempts.push(attempts);
  }
}

function updateSimulationDisplay() {
  updateAttemptsDistributionChart();
  updatePercentileCards();
}

function buildAttemptsBins() {
  const sorted = state.simulationAttempts.slice().sort((a, b) => a - b);
  if (!sorted.length) {
    return { labels: [], counts: [] };
  }
  const binCount = 20;
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  if (minVal === maxVal) {
    return {
      labels: [`${minVal}`],
      counts: [sorted.length]
    };
  }
  const range = maxVal - minVal + 1;
  const binSize = Math.ceil(range / binCount);
  const bins = [];
  for (let i = 0; i < binCount; i++) {
    const start = minVal + i * binSize;
    const end = start + binSize - 1;
    if (start > maxVal) break;
    bins.push({ start, end, count: 0 });
  }
  sorted.forEach(val => {
    const idx = Math.floor((val - minVal) / binSize);
    const clamped = Math.min(idx, bins.length - 1);
    bins[clamped].count++;
  });
  const labels = [];
  const counts = [];
  bins.forEach(b => {
    if (b.count > 0 || b.start <= maxVal) {
      let label = b.start === b.end ? `${b.start}` : `${b.start}-${b.end}`;
      labels.push(label);
      counts.push(b.count);
    }
  });
  return { labels, counts };
}

function updateAttemptsDistributionChart() {
  if (state.charts.attemptsDistribution) {
    state.charts.attemptsDistribution.destroy();
  }
  if (!elements.attemptsDistributionChart) return;
  const { labels, counts } = buildAttemptsBins();
  const chartData = {
    labels,
    datasets: [
      {
        label: "Number of Players",
        data: counts,
        backgroundColor: "#5865f2",
        borderColor: "#4752c4",
        borderWidth: 1
      }
    ]
  };
  const ctx = elements.attemptsDistributionChart.getContext("2d");
  state.charts.attemptsDistribution = new Chart(ctx, {
    type: "bar",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: "Total Attempts (Binned)",
            color: "#dcddde"
          },
          ticks: {
            color: "#b9bbbe"
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          }
        },
        y: {
          title: {
            display: true,
            text: "Number of Players",
            color: "#dcddde"
          },
          ticks: {
            color: "#b9bbbe"
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)"
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#dcddde"
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.parsed.y} players`;
            }
          }
        }
      }
    }
  });
}

function updatePercentileCards() {
  const sorted = state.simulationAttempts.slice().sort((a, b) => a - b);
  if (!sorted.length) return;
  const percentiles = [5, 50, 95];
  const results = {};
  percentiles.forEach(pct => {
    let idx = Math.floor((pct / 100) * sorted.length);
    if (idx >= sorted.length) idx = sorted.length - 1;
    if (idx < 0) idx = 0;
    const attempts = sorted[idx];
    const levelsGained = state.targetPlus - state.startingPoint;
    const successRate = attempts > 0 ? levelsGained / attempts : 1.0;
    results[pct] = { attempts, successRate };
  });
  elements.luckyAttempts.textContent = results[5].attempts;
  elements.luckySuccessRate.textContent = (results[5].successRate * 100).toFixed(2) + "%";
  elements.avgAttempts.textContent = results[50].attempts;
  elements.avgSuccessRate.textContent = (results[50].successRate * 100).toFixed(2) + "%";
  elements.unluckyAttempts.textContent = results[95].attempts;
  elements.unluckySuccessRate.textContent = (results[95].successRate * 100).toFixed(2) + "%";
}

function runAllCalculations() {
  if (!validateSelections()) return;
  state.startingPoint = parseInt(elements.startingPoint.value);
  state.targetPlus = parseInt(elements.targetPlus.value);
  state.confidenceLevel = parseFloat(elements.confidenceLevel.value);
  state.numSimulatedPlayers = parseInt(elements.numSimulatedPlayers.value);
  if (state.confidenceLevel < 1) state.confidenceLevel = 1;
  if (state.confidenceLevel > 99.99) state.confidenceLevel = 99.99;
  updateTheoreticalDisplay();
  updateProbabilityChart();
  runSimulation();
  updateSimulationDisplay();
}

document.addEventListener("DOMContentLoaded", initApp);
