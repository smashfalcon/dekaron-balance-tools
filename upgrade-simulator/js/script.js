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
    { name: "None", rate: 0, color: "" },
    { name: "+18% Talisman", rate: 0.18, color: "#faa61a" },
    { name: "+20% Talisman", rate: 0.20, color: "#ed4245" },
    { name: "+25% Talisman", rate: 0.25, color: "#3ba55c" },
    { name: "+30% Talisman", rate: 0.30, color: "#5865f2" },
    { name: "+50% Talisman", rate: 0.50, color: "#9b59b6" }
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
  simulationAttempts: [],
  simulationSuccesses: []
};

const elements = {
  configurationTable: document.getElementById("configurationTable"),
  startingPoint: document.getElementById("startingPoint"),
  targetPlus: document.getElementById("targetPlus"),
  confidenceLevel: document.getElementById("confidenceLevel"),
  targetError: document.getElementById("targetError"),
  numSimulatedPlayers: document.getElementById("numSimulatedPlayers"),
  runSimulationButton: document.getElementById("runSimulationButton"),
  resetConfigButton: document.getElementById("resetConfigButton"),
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
    
    // Plus level cell
    const plusCell = document.createElement("td");
    plusCell.textContent = `+${plus}`;
    
    // Base rate cell (now editable)
    const baseRateCell = document.createElement("td");
    baseRateCell.className = "text-right";
    const baseRateInput = document.createElement("input");
    baseRateInput.type = "number";
    baseRateInput.min = "0";
    baseRateInput.max = "100";
    baseRateInput.step = "1";
    baseRateInput.style.width = "60px";
    baseRateInput.value = (state.baseRates[plus] * 100).toFixed(0);
    baseRateInput.id = `base-rate-${plus}`;
    baseRateInput.addEventListener("input", (e) => {
      const newValue = parseInt(e.target.value) || 0;
      state.baseRates[plus] = newValue / 100;
      updateConfigurationTable();
    });
    baseRateCell.appendChild(baseRateInput);
    baseRateCell.appendChild(document.createTextNode("%"));
    
    // Talisman selection cell
    const talismanCell = document.createElement("td");
    const selectEl = document.createElement("select");
    selectEl.id = `talisman-${plus}`;
    selectEl.style.width = "150px";
    
    state.talismanOptions.forEach((option, index) => {
      const opt = document.createElement("option");
      opt.value = index;
      opt.textContent = option.name;
      if (option.color) {
        opt.style.backgroundColor = option.color;
        opt.style.color = "#ffffff";
        if (option.color === "#faa61a") {
          opt.style.color = "#000000"; // Yellow needs dark text
        }
      }
      selectEl.appendChild(opt);
    });
    
    selectEl.value = state.talismanStrategy[plus];
    selectEl.addEventListener("change", (e) => {
      state.talismanStrategy[plus] = parseInt(e.target.value);
      updateConfigurationTable();
    });
    
    // Style the select element based on selected option
    const selectedOption = state.talismanOptions[state.talismanStrategy[plus]];
    if (selectedOption.color) {
      selectEl.style.backgroundColor = selectedOption.color;
      selectEl.style.color = "#ffffff";
      if (selectedOption.color === "#faa61a") {
        selectEl.style.color = "#000000"; // Yellow needs dark text
      }
    }
    
    talismanCell.appendChild(selectEl);
    
    // Total success rate cell
    const totalRateCell = document.createElement("td");
    totalRateCell.className = "text-right";
    totalRateCell.id = `total-rate-${plus}`;
    totalRateCell.textContent = calculateTotalSuccessRate(plus).toFixed(2) + "%";
    
    // Compound success rate cell
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
    
    // Update select element styling
    const selectEl = document.getElementById(`talisman-${plus}`);
    if (selectEl) {
      const selectedOption = state.talismanOptions[state.talismanStrategy[plus]];
      if (selectedOption.color) {
        selectEl.style.backgroundColor = selectedOption.color;
        selectEl.style.color = "#ffffff";
        if (selectedOption.color === "#faa61a") {
          selectEl.style.color = "#000000"; // Yellow needs dark text
        }
      } else {
        selectEl.style.backgroundColor = "";
        selectEl.style.color = "";
      }
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
  
  if (elements.resetConfigButton) {
    elements.resetConfigButton.addEventListener("click", resetConfiguration);
  }
}

function resetConfiguration() {
  // Reset base rates
  state.baseRates = {
    1: 0.95,
    2: 0.90,
    3: 0.85,
    4: 0.70,
    5: 0.60,
    6: 0.50,
    7: 0.30,
    8: 0.20,
    9: 0.10
  };
  
  // Reset talisman strategy
  state.talismanStrategy = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 1,
    6: 1,
    7: 2,
    8: 3,
    9: 4
  };
  
  // Reset user inputs
  state.startingPoint = 0;
  state.targetPlus = 9;
  state.confidenceLevel = 95;
  state.numSimulatedPlayers = 1000;
  
  // Update UI elements
  elements.startingPoint.value = state.startingPoint;
  elements.targetPlus.value = state.targetPlus;
  elements.confidenceLevel.value = state.confidenceLevel;
  elements.numSimulatedPlayers.value = state.numSimulatedPlayers;
  
  // Re-initialize configuration table
  initConfigurationTable();
  
  // Run calculations
  runAllCalculations();
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
  // This calculates the REAL probability of succeeding in one complete attempt
  // Success means going from starting point to target without any failures
  
  let probability = 1.0;
  
  // For each step from starting point to target
  for (let plus = state.startingPoint; plus < state.targetPlus; plus++) {
    // Calculate success rate for this step including talisman
    const baseRate = state.baseRates[plus + 1];
    const talismanIndex = state.talismanStrategy[plus + 1];
    const talismanBoost = state.talismanOptions[talismanIndex].rate;
    const stepSuccessRate = baseRate + talismanBoost;
    
    // Multiply by the success rate for this step (capped at 100%)
    probability *= Math.min(1.0, stepSuccessRate);
  }
  
  return probability;
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

function updateExpectedDisplay() {
  const prob = calculateSuccessProbability();
  const avgAttempts = 1 / prob;
  const confAttempts = calculateConfidenceAttempts(state.confidenceLevel);

  elements.resultsContainer.innerHTML = `
    <p class="mb-2">
      <strong>From +${state.startingPoint} to +${state.targetPlus}:</strong>
    </p>
    <p class="mb-2">
      Expected attempts: <strong>${avgAttempts.toFixed(2)}</strong>
    </p>
    <p class="mb-2">
      Success probability per attempt: <strong>${(prob * 100).toFixed(4)}%</strong>
    </p>
    <p>
      Attempts for ${state.confidenceLevel}% confidence: <strong>${confAttempts}</strong>
    </p>
  `;
}

function generateProbabilityData() {
  // Calculate the real success probability per attempt
  const p = calculateSuccessProbability();
  const avgAttempts = 1 / p;
  
  // Cap the maximum attempts to display
  const maxAttempts = Math.min(Math.ceil(avgAttempts * 3), 100);
  
  const expectedData = [];
  
  // Calculate expected data (geometric distribution)
  let cumExpectedProb = 0;
  for (let i = 1; i <= maxAttempts; i++) {
    // Probability of success on exactly attempt i
    const expectedProb = p * Math.pow(1 - p, i - 1);
    cumExpectedProb += expectedProb;
    
    expectedData.push({
      attempt: i,
      probability: expectedProb,
      cumulativeProbability: cumExpectedProb
    });
  }
  
  // Calculate simulation data if available
  const simulatedData = [];
  
  if (state.simulationAttempts.length > 0) {
    // Sort attempts to calculate cumulative probability
    const sortedAttempts = [...state.simulationAttempts].sort((a, b) => a - b);
    const numPlayers = sortedAttempts.length;
    
    // For each attempt number, calculate how many players succeeded by that attempt
    for (let i = 1; i <= maxAttempts; i++) {
      const successfulPlayers = sortedAttempts.filter(attempts => attempts <= i).length;
      const simulatedCumulativeProb = successfulPlayers / numPlayers;
      
      simulatedData.push({
        attempt: i,
        cumulativeProbability: simulatedCumulativeProb
      });
    }
  }
  
  return { expectedData, simulatedData, maxAttempts };
}

function updateProbabilityChart() {
  if (state.charts.probability) {
    state.charts.probability.destroy();
  }
  if (!elements.probabilityChart) return;

  const { expectedData, simulatedData, maxAttempts } = generateProbabilityData();
  
  const labels = Array.from({ length: maxAttempts }, (_, i) => i + 1);
  
  const datasets = [
    {
      label: "Expected Success Probability",
      data: expectedData.map(d => d.probability * 100),
      backgroundColor: "rgba(88, 101, 242, 0.5)",
      borderColor: "rgba(88, 101, 242, 1)",
      borderWidth: 1
    },
    {
      label: "Expected Cumulative Probability",
      data: expectedData.map(d => d.cumulativeProbability * 100),
      backgroundColor: "rgba(59, 165, 92, 0.5)",
      borderColor: "rgba(59, 165, 92, 1)",
      borderWidth: 1,
      type: "line"
    }
  ];
  
  // Add simulated data if available
  if (simulatedData.length > 0) {
    datasets.push({
      label: "Simulated Cumulative Probability",
      data: simulatedData.map(d => d.cumulativeProbability * 100),
      backgroundColor: "rgba(250, 166, 26, 0.5)",
      borderColor: "rgba(250, 166, 26, 1)",
      borderWidth: 2,
      type: "line"
    });
  }

  const ctx = elements.probabilityChart.getContext("2d");
  state.charts.probability = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
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
            color: "#b9bbbe"
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
      <strong>${state.confidenceLevel}% Confidence:</strong> 
      You need <strong>${confAttempts}</strong> attempts to have a 
      ${state.confidenceLevel}% chance of reaching +${state.targetPlus} from +${state.startingPoint}.
    </div>
  `;
}

function runSimulation() {
  state.simulationAttempts = [];
  state.simulationSuccesses = [];
  const numPlayers = state.numSimulatedPlayers;
  
  for (let i = 0; i < numPlayers; i++) {
    let attempts = 0;
    let success = false;
    
    while (attempts < 1000 && !success) { // Cap at 1000 attempts
      attempts++; // Count this as one complete attempt
      
      // Try to go from starting point to target
      let currentPlus = state.startingPoint;
      let reachedTarget = true; // Assume success until we fail
      
      // For each step in the upgrade path
      while (currentPlus < state.targetPlus) {
        // Calculate success rate for this step
        const baseRate = state.baseRates[currentPlus + 1];
        const talismanIndex = state.talismanStrategy[currentPlus + 1];
        const talismanBoost = state.talismanOptions[talismanIndex].rate;
        const stepSuccessRate = Math.min(1.0, baseRate + talismanBoost);
        
        // Check if this individual upgrade succeeds
        if (Math.random() < stepSuccessRate) {
          // Success - go up one plus level
          currentPlus++;
        } else {
          // Failure - this attempt failed
          reachedTarget = false;
          break; // End this attempt
        }
      }
      
      // If we made it through all steps, this attempt succeeded
      if (reachedTarget) {
        success = true;
      }
    }
    
    state.simulationAttempts.push(attempts);
    state.simulationSuccesses.push(success);
  }
}

function updateSimulationDisplay() {
  updateAttemptsDistributionChart();
  updatePercentileCards();
}

function calculateExpectedDistribution() {
  // Calculate real success probability for one complete attempt
  const p = calculateSuccessProbability();
  if (p <= 0) return [];
  
  const avgAttempts = 1 / p;
  const maxAttempts = Math.min(Math.ceil(avgAttempts * 5), 1000);
  
  // Using geometric distribution for attempts to reach target
  const distribution = new Array(maxAttempts + 1).fill(0);
  
  // Calculate probability for each number of attempts
  for (let i = 1; i <= maxAttempts; i++) {
    distribution[i] = p * Math.pow(1 - p, i - 1);
  }
  
  return distribution;
}

function buildAttemptsBins() {
  const sorted = state.simulationAttempts.slice().sort((a, b) => a - b);
  if (!sorted.length) {
    return { labels: [], counts: [], expectedCounts: [] };
  }
  
  const binCount = 20;
  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  
  if (minVal === maxVal) {
    return {
      labels: [`${minVal}`],
      counts: [sorted.length],
      expectedCounts: [sorted.length]
    };
  }
  
  // Create bins with equal width
  const range = maxVal - minVal + 1;
  const binSize = Math.ceil(range / binCount);
  const bins = [];
  
  for (let i = 0; i < binCount; i++) {
    const start = minVal + i * binSize;
    const end = start + binSize - 1;
    if (start > maxVal) break;
    bins.push({ start, end, count: 0, expectedCount: 0 });
  }
  
  // Count actual attempts from simulation
  sorted.forEach(val => {
    const idx = Math.floor((val - minVal) / binSize);
    const clamped = Math.min(idx, bins.length - 1);
    if (clamped >= 0) {
      bins[clamped].count++;
    }
  });
  
  // Calculate expected distribution
  const expectedDist = calculateExpectedDistribution();
  const numPlayers = state.simulationAttempts.length;
  
  // Calculate expected counts for each bin
  bins.forEach(bin => {
    bin.expectedCount = 0;
    for (let i = bin.start; i <= bin.end; i++) {
      if (i > 0 && i < expectedDist.length) {
        bin.expectedCount += expectedDist[i] * numPlayers;
      }
    }
  });
  
  // Format data for chart
  const labels = [];
  const counts = [];
  const expectedCounts = [];
  
  bins.forEach(b => {
    if (b.count > 0 || b.expectedCount > 0 || b.start <= maxVal) {
      let label = b.start === b.end ? `${b.start}` : `${b.start}-${b.end}`;
      labels.push(label);
      counts.push(b.count);
      expectedCounts.push(Math.round(b.expectedCount));
    }
  });
  
  return { labels, counts, expectedCounts };
}

function updateAttemptsDistributionChart() {
  if (state.charts.attemptsDistribution) {
    state.charts.attemptsDistribution.destroy();
  }
  if (!elements.attemptsDistributionChart) return;
  
  const { labels, counts, expectedCounts } = buildAttemptsBins();
  
  const datasets = [
    {
      label: "Simulated Players",
      data: counts,
      backgroundColor: "#5865f2",
      borderColor: "#4752c4",
      borderWidth: 1
    }
  ];
  
  // Add expected counts if available
  if (expectedCounts.length > 0) {
    datasets.push({
      label: "Expected Players",
      data: expectedCounts,
      type: "line",
      borderColor: "#ed4245",
      backgroundColor: "#ed4245",
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.1
    });
  }
  
  const ctx = elements.attemptsDistributionChart.getContext("2d");
  state.charts.attemptsDistribution = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
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
            color: "#b9bbbe"
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y}`;
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
  updateExpectedDisplay();
  runSimulation();
  updateProbabilityChart();
  updateSimulationDisplay();
}

document.addEventListener("DOMContentLoaded", initApp);