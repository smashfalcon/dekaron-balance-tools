/* ossuary-simulator/js/script.js */

const state = {
  // default rates
  rates: {
    '+20% Talisman': 50,
    '+25% Talisman': 45,
    '+30% Talisman': 4.9,
    '+50% Talisman': 0.1
  },
  numChests: 10,
  numSimulations: 1000,
  ossuaryPrice: 240,
  items: [],
  simulationResults: null,
  showPercentiles: true,
  charts: {
    distribution: null,
    journey: null
  }
};

// DOM references
const els = {
  dropRatesInputs: document.getElementById('dropRatesInputs'),
  totalRate: document.getElementById('totalRate'),
  rateError: document.getElementById('rateError'),
  numChests: document.getElementById('numChests'),
  numSimulations: document.getElementById('numSimulations'),
  ossuaryPrice: document.getElementById('ossuaryPrice'),
  runSimulation: document.getElementById('runSimulation'),
  resetConfig: document.getElementById('resetConfig'),
  dropRatesTable: document.getElementById('dropRatesTable'),
  distributionChart: document.getElementById('distributionChart'),
  journeyChart: document.getElementById('journeyChart'),
  showPercentiles: document.getElementById('showPercentiles'),
  chestsCount: document.getElementById('chestsCount'),
  // percentile boxes
  unluckyAvg: document.getElementById('unluckyAvg'),
  avgAvg: document.getElementById('avgAvg'),
  luckyAvg: document.getElementById('luckyAvg'),
  ratioCostTable: document.getElementById('ratioCostTable')
};

// =============== 1) Drop Rate UI ===============
function initDropRateInputs() {
  els.dropRatesInputs.innerHTML = '';
  for (const [name, val] of Object.entries(state.rates)) {
    const div = document.createElement('div');
    const lab = document.createElement('label');
    lab.textContent = name;

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '0';
    inp.max = '100';
    inp.step = '0.1';
    inp.value = val;
    inp.addEventListener('input', e => {
      state.rates[name] = parseFloat(e.target.value);
      updateTotalRate();
    });

    div.appendChild(lab);
    div.appendChild(inp);
    els.dropRatesInputs.appendChild(div);
  }
  updateTotalRate();
}

function updateTotalRate() {
  const sum = Object.values(state.rates).reduce((a, b) => a + b, 0);
  els.totalRate.textContent = `Total: ${sum.toFixed(1)}% (must equal 100%)`;
  if (Math.abs(sum - 100) > 0.01) {
    els.rateError.textContent = `Total must be 100%. Currently ${sum.toFixed(1)}%`;
    els.runSimulation.disabled = true;
  } else {
    els.rateError.textContent = '';
    els.runSimulation.disabled = false;
  }
}

function ratesToItems() {
  state.items = Object.entries(state.rates).map(([name, val]) => ({
    name,
    probability: val / 100,
    value: parseInt(name.replace(/\D+/g, '')) || 0
  }));
}

// =============== 2) Simulation with full journey ===============
function openChest() {
  const roll = Math.random();
  let cumulative = 0;
  for (const it of state.items) {
    cumulative += it.probability;
    if (roll < cumulative) {
      return it;
    }
  }
  // Fallback in case of floating-point rounding
  return state.items[state.items.length - 1];
}

function simulatePlayerJourney(numChests) {
  const journey = [];
  const itemCounts = {};
  state.items.forEach(it => (itemCounts[it.name] = 0));
  let totalVal = 0;

  for (let c = 0; c < numChests; c++) {
    const it = openChest();
    itemCounts[it.name]++;
    totalVal += it.value;
    const runAvg = totalVal / (c + 1);

    const chestData = {
      chest: c + 1,
      item: it.name,
      itemValue: it.value,
      runningAverage: runAvg
    };
    // Also track how many of each item so far
    for (const nm in itemCounts) {
      chestData[`count_${nm}`] = itemCounts[nm];
    }
    journey.push(chestData);
  }

  const finalAverage = journey[journey.length - 1].runningAverage;
  return { journey, finalAverage, itemCounts };
}

function runSimulation() {
  // Read config from DOM
  state.numChests = parseInt(els.numChests.value) || 10;
  state.numSimulations = parseInt(els.numSimulations.value) || 100;
  state.ossuaryPrice = parseFloat(els.ossuaryPrice.value) || 240;
  els.chestsCount.textContent = state.numChests;

  // Convert rates -> items
  ratesToItems();

  // Run simulations
  const allSimulations = [];
  const finalAverages = [];

  for (let i = 0; i < state.numSimulations; i++) {
    const sim = simulatePlayerJourney(state.numChests);
    allSimulations.push(sim);
    finalAverages.push(sim.finalAverage);
  }

  finalAverages.sort((a, b) => a - b);

  // percentile journeys
  const pvals = { 5: null, 50: null, 95: null };
  [5, 50, 95].forEach(p => {
    let idx = Math.floor((p / 100) * finalAverages.length);
    if (idx >= finalAverages.length) idx = finalAverages.length - 1;
    pvals[p] = finalAverages[idx];
  });

  const percentileJourneys = {};
  [5, 50, 95].forEach(p => {
    const target = pvals[p];
    let best = allSimulations[0];
    let bestDiff = Math.abs(best.finalAverage - target);
    for (const sim of allSimulations) {
      const diff = Math.abs(sim.finalAverage - target);
      if (diff < bestDiff) {
        best = sim;
        bestDiff = diff;
      }
    }
    percentileJourneys[p] = best.journey;
  });

  // average journey across all players
  const averageJourney = [];
  for (let c = 0; c < state.numChests; c++) {
    let sumRunning = 0;
    for (const sim of allSimulations) {
      sumRunning += sim.journey[c].runningAverage;
    }
    const avg = sumRunning / allSimulations.length;
    averageJourney.push({
      chest: c + 1,
      runningAverage: avg
    });
  }

  // Save results
  state.simulationResults = {
    allSimulations,
    finalAverages,
    percentileJourneys,
    averageJourney
  };

  // Update the UI
  updateDisplay();
}

// =============== 3) Display updates ===============
function updateDisplay() {
  updateDropRatesTable();
  updateDistributionChart();
  updateJourneyChart();
  updatePercentileBoxes();
  // No longer needed, as we've integrated the cost calculation into the main table
  // updateRatioCostTable();
}

// (A) Drop Rates Table with Effective Cost
function updateDropRatesTable() {
  els.dropRatesTable.innerHTML = '';
  const allSim = state.simulationResults.allSimulations;
  const totalChests = state.numChests * state.numSimulations;

  // Sum item counts
  const sums = {};
  state.items.forEach(it => (sums[it.name] = 0));
  for (const sim of allSim) {
    for (const nm in sim.itemCounts) {
      sums[nm] += sim.itemCounts[nm];
    }
  }

  // Sort items by value (descending - best items first) for cost calculation
  const sortedItems = [...state.items].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return b.probability - a.probability;
  });

  // Calculate "or better" probabilities for expected costs
  const expectedCosts = {};
  sortedItems.forEach((item, idx) => {
    let orBetterProbability;
    if (idx === 0) {
      orBetterProbability = item.probability;
    } else {
      orBetterProbability = sortedItems
        .slice(0, idx + 1)
        .reduce((sum, it) => sum + it.probability, 0);
    }
    expectedCosts[item.name] = orBetterProbability < 0.0001 
      ? Infinity 
      : Math.round(state.ossuaryPrice / orBetterProbability);
  });

  // Calculate actual "or better" probabilities for actual costs
  const actualProbs = {};
  const actualCosts = {};
  
  // First get the actual probabilities from simulation results
  const actualProbabilities = {};
  state.items.forEach(it => {
    actualProbabilities[it.name] = sums[it.name] / totalChests;
  });
  
  // Sort items by value for actual cost calculation
  const valueItemMap = {};
  state.items.forEach(it => {
    valueItemMap[it.name] = it.value;
  });
  
  const sortedByValue = Object.keys(actualProbabilities)
    .sort((a, b) => valueItemMap[b] - valueItemMap[a]);
  
  // Calculate "or better" probabilities
  sortedByValue.forEach((name, idx) => {
    let orBetterProb;
    if (idx === 0) {
      orBetterProb = actualProbabilities[name];
    } else {
      orBetterProb = sortedByValue
        .slice(0, idx + 1)
        .reduce((sum, n) => sum + actualProbabilities[n], 0);
    }
    actualProbs[name] = orBetterProb;
    actualCosts[name] = orBetterProb < 0.0001 
      ? Infinity 
      : Math.round(state.ossuaryPrice / orBetterProb);
  });

  // Build table rows - sort by original order for display
  for (const it of state.items) {
    const row = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.textContent = it.name;

    const tdExp = document.createElement('td');
    tdExp.className = 'text-right';
    tdExp.textContent = (it.probability * 100).toFixed(2) + '%';

    const actual = (sums[it.name] / totalChests) * 100;
    const tdAct = document.createElement('td');
    tdAct.className = 'text-right';
    tdAct.textContent = actual.toFixed(2) + '%';

    const tdAvg = document.createElement('td');
    tdAvg.className = 'text-right';
    tdAvg.textContent = (sums[it.name] / state.numSimulations).toFixed(2);
    
    // Expected effective cost
    const tdExpCost = document.createElement('td');
    tdExpCost.className = 'text-right';
    tdExpCost.textContent = expectedCosts[it.name] === Infinity 
      ? '∞' 
      : expectedCosts[it.name].toLocaleString();
    
    // Simulated effective cost
    const tdActCost = document.createElement('td');
    tdActCost.className = 'text-right';
    tdActCost.textContent = actualCosts[it.name] === Infinity 
      ? '∞' 
      : actualCosts[it.name].toLocaleString();

    row.append(tdName, tdExp, tdAct, tdAvg, tdExpCost, tdActCost);
    els.dropRatesTable.appendChild(row);
  }
}

// (B) Distribution of final averages
function buildDistData() {
  const bucketSize = 0.5;
  const simulatedBuckets = {};
  
  // Make sure we have data
  if (!state.simulationResults || !state.simulationResults.finalAverages) {
    return { labels: [], simulatedData: [], expectedData: [] };
  }
  
  // Build actual distribution from simulation
  for (const val of state.simulationResults.finalAverages) {
    const bucket = Math.floor(val / bucketSize) * bucketSize;
    simulatedBuckets[bucket] = (simulatedBuckets[bucket] || 0) + 1;
  }
  
  // Calculate the theoretical distribution for the average talisman %
  const numPlayers = state.simulationResults.finalAverages.length;
  
  // Calculate expected value (mean) of a single chest
  const expectedSingleChestValue = state.items.reduce(
    (sum, item) => sum + item.value * item.probability, 
    0
  );
  
  // Variance of a single chest
  const varianceSingleChest = state.items.reduce(
    (sum, item) => sum + Math.pow(item.value - expectedSingleChestValue, 2) * item.probability,
    0
  );
  
  // For the average of N chests, the variance scales by 1/N
  const varianceOfAverage = varianceSingleChest / state.numChests;
  const stdDevOfAverage = Math.sqrt(varianceOfAverage);
  
  // Get all bucket keys from the simulation
  const allBuckets = new Set(Object.keys(simulatedBuckets).map(k => parseFloat(k)));
  
  // Extend range to cover the theoretical distribution's tails
  const minRange = Math.max(0, expectedSingleChestValue - 4 * stdDevOfAverage);
  const maxRange = expectedSingleChestValue + 4 * stdDevOfAverage;
  
  for (let x = minRange; x <= maxRange; x += bucketSize) {
    allBuckets.add(parseFloat(x.toFixed(1)));
  }
  
  // Convert set to sorted array
  const sortedBuckets = Array.from(allBuckets).sort((a, b) => a - b);
  
  // Calculate theoretical distribution (expected number in each bucket)
  const expectedBuckets = {};
  
  for (const bucket of sortedBuckets) {
    // Calculate normal probability between bucket and bucket+bucketSize
    const z1 = (bucket - expectedSingleChestValue) / stdDevOfAverage;
    const z2 = (bucket + bucketSize - expectedSingleChestValue) / stdDevOfAverage;
    const prob = normalCDF(z2) - normalCDF(z1);
    
    // Expected count in this bucket
    expectedBuckets[bucket] = Math.round(prob * numPlayers);
  }
  
  // Generate labels and datasets
  const labels = sortedBuckets.map(bucket => {
    const low = bucket.toFixed(1);
    const high = (bucket + bucketSize).toFixed(1);
    return `${low}-${high}`;
  });
  
  const simulatedData = sortedBuckets.map(bucket => simulatedBuckets[bucket] || 0);
  const expectedData = sortedBuckets.map(bucket => expectedBuckets[bucket] || 0);
  
  return { labels, simulatedData, expectedData };
}

// Helper function for normal CDF (cumulative distribution function)
function normalCDF(z) {
  // Faster approximation of normal CDF
  if (z < -6) return 0;
  if (z > 6) return 1;
  
  const b1 =  0.31938153;
  const b2 = -0.356563782;
  const b3 =  1.781477937;
  const b4 = -1.821255978;
  const b5 =  1.330274429;
  const p  =  0.2316419;
  const c  =  0.39894228;

  if (z >= 0.0) {
    const t = 1.0 / (1.0 + p * z);
    return 1.0 - c * Math.exp(-z * z / 2.0) * t * 
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * z);
    return c * Math.exp(-z * z / 2.0) * t * 
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

function updateDistributionChart() {
  if (state.charts.distribution) {
    state.charts.distribution.destroy();
  }
  
  const { labels, simulatedData, expectedData } = buildDistData();
  
  // Skip if there's no data to show
  if (!labels.length) return;
  
  const ctx = els.distributionChart.getContext('2d');
  state.charts.distribution = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Simulated Number of Players',
          data: simulatedData,
          backgroundColor: '#5865f2',
          order: 2
        },
        {
          label: 'Expected Number of Players',
          data: expectedData,
          type: 'line',
          borderColor: '#ed4245',
          backgroundColor: '#ed4245',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.1,
          fill: false,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: '#555' },
          ticks: { color: '#b9bbbe' },
          title: {
            display: true,
            text: 'Average Talisman %',
            color: '#b9bbbe'
          }
        },
        y: {
          grid: { color: '#555' },
          ticks: { color: '#b9bbbe' },
          title: {
            display: true,
            text: 'Number of Players',
            color: '#b9bbbe'
          }
        }
      }
    }
  });
}

// (C) Journey Chart
function updateJourneyChart() {
  if (state.charts.journey) {
    state.charts.journey.destroy();
  }
  
  // Make sure we have data
  if (!state.simulationResults || !state.simulationResults.averageJourney) {
    return;
  }
  
  const ctx = els.journeyChart.getContext('2d');

  // Build data sets
  const dataSets = [];
  
  // Mean line
  const meanData = state.simulationResults.averageJourney.map(pt => ({
    x: pt.chest,
    y: pt.runningAverage
  }));
  
  dataSets.push({
    label: 'Mean (All Players)',
    data: meanData,
    borderColor: '#dcddde',
    backgroundColor: '#dcddde',
    borderWidth: 2,
    tension: 0.1,
    pointRadius: 0
  });

  // Add percentile lines if checked
  if (state.showPercentiles) {
    const colors = { 5: '#ed4245', 50: '#faa61a', 95: '#3ba55c' };
    [5, 50, 95].forEach(p => {
      const journey = state.simulationResults.percentileJourneys[p];
      if (!journey) return;
      let label = `${p}th Percentile`;
      if (p === 5) label += ' (Unlucky)';
      if (p === 50) label += ' (Average)';
      if (p === 95) label += ' (Lucky)';
      const lineData = journey.map(ch => ({ x: ch.chest, y: ch.runningAverage }));
      dataSets.push({
        label,
        data: lineData,
        borderColor: colors[p],
        backgroundColor: colors[p],
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0
      });
    });
  }

  // Determine min/max Y for a nice chart
  let allY = [];
  for (const ds of dataSets) {
    for (const pt of ds.data) {
      allY.push(pt.y);
    }
  }
  if (!allY.length) allY = [0, 100];
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const padding = (maxY - minY) * 0.1 || 1;
  const chartMinY = Math.max(0, minY - padding);
  const chartMaxY = maxY + padding;

  state.charts.journey = new Chart(ctx, {
    type: 'line',
    data: { datasets: dataSets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          min: 1,
          max: state.numChests,
          ticks: { color: '#b9bbbe' },
          grid: { color: '#555' },
          title: {
            display: true,
            text: 'Number of Chests Opened',
            color: '#b9bbbe'
          }
        },
        y: {
          min: chartMinY,
          max: chartMaxY,
          ticks: { color: '#b9bbbe' },
          grid: { color: '#555' },
          title: {
            display: true,
            text: 'Average Talisman %',
            color: '#b9bbbe'
          }
        }
      }
    }
  });
}

// (D) Percentile boxes
function updatePercentileBoxes() {
  const simRes = state.simulationResults;
  if (!simRes || !simRes.finalAverages || !simRes.finalAverages.length) return;

  const arr = simRes.finalAverages;
  
  const idx5 = Math.floor(0.05 * (arr.length - 1));
  const idx50 = Math.floor(0.50 * (arr.length - 1));
  const idx95 = Math.floor(0.95 * (arr.length - 1));

  els.unluckyAvg.textContent = arr[idx5].toFixed(2) + '%';
  els.avgAvg.textContent = arr[idx50].toFixed(2) + '%';
  els.luckyAvg.textContent = arr[idx95].toFixed(2) + '%';
}

// (E) New Effective Cost Calculation
function updateRatioCostTable() {
  const tb = els.ratioCostTable;
  tb.innerHTML = '';
  
  // Sort items by value (descending - best items first)
  const sortedItems = [...state.items].sort((a, b) => {
    // First sort by value (higher % is better)
    if (b.value !== a.value) return b.value - a.value;
    // If same value, sort by probability (higher probability first)
    return b.probability - a.probability;
  });
  
  // Create table rows for each item
  sortedItems.forEach((item, idx) => {
    const row = document.createElement('tr');
    
    // Item name
    const tdName = document.createElement('td');
    tdName.textContent = item.name;
    
    // Chance (%)
    const tdChancePercent = document.createElement('td');
    tdChancePercent.className = 'text-right';
    tdChancePercent.textContent = (item.probability * 100).toFixed(1) + '%';
    
    // Chance (decimal)
    const tdChanceDecimal = document.createElement('td');
    tdChanceDecimal.className = 'text-right';
    tdChanceDecimal.textContent = item.probability.toFixed(3);
    
    // Calculate probability for this item or better
    let orBetterProbability;
    if (idx === 0) {
      // For the best item, it's just its own probability
      orBetterProbability = item.probability;
    } else {
      // For other items, sum probabilities of all better items + this one
      orBetterProbability = sortedItems
        .slice(0, idx + 1)
        .reduce((sum, it) => sum + it.probability, 0);
    }
    
    // "Or better" probability (%)
    const tdCumulative = document.createElement('td');
    tdCumulative.className = 'text-right';
    tdCumulative.textContent = (orBetterProbability * 100).toFixed(1) + '%';
    
    // Formula
    const tdFormula = document.createElement('td');
    if (idx === 0) {
      // Best item - baseline calculation 
      tdFormula.textContent = 'always get at least this, so simply container cost';
    } else {
      // Calculation formula display
      tdFormula.innerHTML = `
        ${state.ossuaryPrice} ÷ ${orBetterProbability.toFixed(3)} = ${Math.round(state.ossuaryPrice / orBetterProbability)}
      `;
    }
    
    // Effective Cost
    const tdCost = document.createElement('td');
    tdCost.className = 'text-right';
    
    if (orBetterProbability < 0.0001) {
      // Avoid division by very small numbers
      tdCost.textContent = '∞';
    } else {
      const effectiveCost = state.ossuaryPrice / orBetterProbability;
      tdCost.textContent = Math.round(effectiveCost).toLocaleString();
    }
    
    row.append(tdName, tdChancePercent, tdChanceDecimal, tdCumulative, tdFormula, tdCost);
    tb.appendChild(row);
  });
}

// =============== Attach events ===============
function attachEvents() {
  els.runSimulation.addEventListener('click', runSimulation);
  
  // Add event for reset button
  const resetButton = document.getElementById('resetConfig');
  if (resetButton) {
    resetButton.addEventListener('click', resetConfiguration);
  }

  els.numChests.addEventListener('input', () => {
    state.numChests = parseInt(els.numChests.value) || 10;
  });
  els.numSimulations.addEventListener('input', () => {
    state.numSimulations = parseInt(els.numSimulations.value) || 1000;
  });
  els.ossuaryPrice.addEventListener('input', () => {
    state.ossuaryPrice = parseFloat(els.ossuaryPrice.value) || 240;
  });

  els.showPercentiles.addEventListener('change', () => {
    state.showPercentiles = els.showPercentiles.checked;
    if (state.simulationResults) {
      updateJourneyChart();
    }
  });
}

// Reset configuration to default values
function resetConfiguration() {
  // Reset the drop rates to default
  state.rates = {
    '+20% Talisman': 50,
    '+25% Talisman': 45,
    '+30% Talisman': 4.9,
    '+50% Talisman': 0.1
  };
  
  // Reset other configuration values
  state.numChests = 10;
  state.numSimulations = 1000;
  state.ossuaryPrice = 240;
  
  // Update the UI to reflect the reset values
  els.numChests.value = state.numChests;
  els.numSimulations.value = state.numSimulations;
  els.ossuaryPrice.value = state.ossuaryPrice;
  
  // Rebuild the drop rate inputs
  initDropRateInputs();
  
  // Run simulation with the reset configuration
  runSimulation();
}

// =============== Master init function ===============
function init() {
  initDropRateInputs();
  attachEvents();
  // Immediately run once so we have data on load
  setTimeout(() => {
    runSimulation();
  }, 100);
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', init);