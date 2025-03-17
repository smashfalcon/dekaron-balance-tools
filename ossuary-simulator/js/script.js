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
  numSimulations: 100,
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
  updateRatioCostTable();
}

// (A) Drop Rates Table
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

  // Build table rows
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

    row.append(tdName, tdExp, tdAct, tdAvg);
    els.dropRatesTable.appendChild(row);
  }
}

// (B) Distribution of final averages
function buildDistData() {
  const bucketSize = 0.5;
  const buckets = {};
  for (const val of state.simulationResults.finalAverages) {
    const bucket = Math.floor(val / bucketSize) * bucketSize;
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  }
  // 1) Convert keys to numbers and sort them ascending
  const sortedKeys = Object.keys(buckets)
    .map(k => parseFloat(k))
    .sort((a, b) => a - b);

  // 2) Build labels and data in sorted order
  const labels = sortedKeys.map(k => {
    const low = k.toFixed(1);
    const high = (k + bucketSize).toFixed(1);
    return `${low}-${high}`;
  });
  const data = sortedKeys.map(k => buckets[k]);
  return { labels, data };
}

function updateDistributionChart() {
  if (state.charts.distribution) {
    state.charts.distribution.destroy();
  }
  const { labels, data } = buildDistData();
  const ctx = els.distributionChart.getContext('2d');
  state.charts.distribution = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Number of Players',
          data,
          backgroundColor: '#5865f2'
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
  if (!simRes) return;

  const arr = simRes.finalAverages;
  if (!arr.length) return;

  const idx5 = Math.floor(0.05 * (arr.length - 1));
  const idx50 = Math.floor(0.50 * (arr.length - 1));
  const idx95 = Math.floor(0.95 * (arr.length - 1));

  els.unluckyAvg.textContent = arr[idx5].toFixed(2) + '%';
  els.avgAvg.textContent = arr[idx50].toFixed(2) + '%';
  els.luckyAvg.textContent = arr[idx95].toFixed(2) + '%';
}

// (E) Ratio-based cost table
function updateRatioCostTable() {
  const tb = els.ratioCostTable;
  tb.innerHTML = '';

  // Find baseline item (the one with highest probability)
  let baseline = state.items[0];
  for (const it of state.items) {
    if (it.probability > baseline.probability) {
      baseline = it;
    }
  }

  // Sum item counts
  const allSim = state.simulationResults.allSimulations;
  const itemCounts = {};
  state.items.forEach(it => (itemCounts[it.name] = 0));
  allSim.forEach(sim => {
    for (const nm in sim.itemCounts) {
      itemCounts[nm] += sim.itemCounts[nm];
    }
  });

  const baselineCount = itemCounts[baseline.name] || 0;
  const baselineProb = baseline.probability;

  // Show only Talisman items
  const relevant = state.items.filter(it => it.name.includes('Talisman'));
  relevant.forEach(it => {
    const row = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.textContent = it.name;

    // theoretical ratio
    let ratioTheo = Infinity;
    if (baselineProb > 0 && it.probability > 0) {
      ratioTheo = baselineProb / it.probability;
    }
    const costTheo = isFinite(ratioTheo)
      ? state.ossuaryPrice * ratioTheo
      : Infinity;

    const tdTheo = document.createElement('td');
    tdTheo.className = 'text-right';
    tdTheo.textContent = isFinite(costTheo) ? costTheo.toFixed(2) : '∞';

    // empirical ratio
    const cItem = itemCounts[it.name] || 0;
    let ratioEmp = Infinity;
    if (baselineCount > 0 && cItem > 0) {
      ratioEmp = baselineCount / cItem;
    }
    const costEmp = isFinite(ratioEmp)
      ? state.ossuaryPrice * ratioEmp
      : Infinity;

    const tdEmp = document.createElement('td');
    tdEmp.className = 'text-right';
    tdEmp.textContent = isFinite(costEmp) ? costEmp.toFixed(2) : '∞';

    row.append(tdName, tdTheo, tdEmp);
    tb.appendChild(row);
  });
}

// =============== Attach events ===============
function attachEvents() {
  els.runSimulation.addEventListener('click', runSimulation);

  els.numChests.addEventListener('input', () => {
    state.numChests = parseInt(els.numChests.value) || 10;
  });
  els.numSimulations.addEventListener('input', () => {
    state.numSimulations = parseInt(els.numSimulations.value) || 100;
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

// =============== Master init function ===============
function init() {
  initDropRateInputs();
  attachEvents();
  // Immediately run once so we have data on load
  runSimulation();
}

document.addEventListener('DOMContentLoaded', init);
