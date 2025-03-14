import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const OssuarySimulator = () => {
  const [numSimulations, setNumSimulations] = useState(100);
  const [numChests, setNumChests] = useState(10);
  const [simulationResults, setSimulationResults] = useState(null);
  const [percentileView, setPercentileView] = useState(50); // default median
  const [showPercentiles, setShowPercentiles] = useState(true);
  const [error, setError] = useState(null);
  
  // Discord-inspired colors
  const colors = {
    background: '#2c2d31',
    backgroundSecondary: '#36393f',
    backgroundTertiary: '#202225',
    textPrimary: '#dcddde',
    textSecondary: '#b9bbbe',
    textMuted: '#72767d',
    blurple: '#5865f2',
    red: '#ed4245',
    green: '#3ba55c',
    yellow: '#faa61a'
  };
  
  // Initial rates
  const [rates, setRates] = useState({
    "+20% Talisman": 50,
    "+25% Talisman": 45, 
    "+30% Talisman": 4.9,
    "+50% Talisman": 0.1
  });
  
  // Convert rates (in percentage) to item structure with probabilities
  const items = [
    { name: "+20% Talisman", probability: rates["+20% Talisman"] / 100, value: 20 },
    { name: "+25% Talisman", probability: rates["+25% Talisman"] / 100, value: 25 },
    { name: "+30% Talisman", probability: rates["+30% Talisman"] / 100, value: 30 },
    { name: "+50% Talisman", probability: rates["+50% Talisman"] / 100, value: 50 }
  ];
  
  // Handle rate change
  const handleRateChange = (name, value) => {
    const newRates = { ...rates, [name]: value };
    setRates(newRates);
    
    // Validate total equals 100%
    const sum = Object.values(newRates).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      setError(`Total rates must equal 100%. Current total: ${sum}%`);
    } else {
      setError(null);
    }
  };

  // Function to simulate a single chest open
  const openChest = () => {
    const roll = Math.random();
    let cumulativeProbability = 0;
    
    for (const item of items) {
      cumulativeProbability += item.probability;
      if (roll < cumulativeProbability) {
        return item;
      }
    }
    
    return items[items.length - 1]; // Fallback (shouldn't happen)
  };

  // Function to simulate a player opening n chests
  const simulatePlayerJourney = (numChests) => {
    const journey = [];
    const itemCounts = items.reduce((acc, item) => {
      acc[item.name] = 0;
      return acc;
    }, {});
    
    let totalValue = 0;
    let cumulativeValue = 0;
    
    for (let i = 0; i < numChests; i++) {
      const item = openChest();
      itemCounts[item.name]++;
      totalValue += item.value;
      cumulativeValue = totalValue / (i + 1);
      
      journey.push({
        chest: i + 1,
        item: item.name,
        itemValue: item.value,
        runningAverage: cumulativeValue,
        ...Object.fromEntries(items.map(it => [`count_${it.name}`, itemCounts[it.name]]))
      });
    }
    
    return {
      journey,
      finalAverage: cumulativeValue,
      itemCounts
    };
  };

  // Run the simulation
  const runSimulation = () => {
    // Validate rates
    const totalRate = Object.values(rates).reduce((a, b) => a + b, 0);
    if (totalRate !== 100) {
      setError(`Total rates must equal 100%. Current total: ${totalRate}%`);
      return;
    }
    
    const allSimulations = [];
    const finalAverages = [];
    
    for (let i = 0; i < numSimulations; i++) {
      const playerResult = simulatePlayerJourney(numChests);
      allSimulations.push(playerResult);
      finalAverages.push(playerResult.finalAverage);
    }
    
    // Sort averages to find percentiles
    finalAverages.sort((a, b) => a - b);
    
    // Calculate percentiles for every 5th percentile from 5 to 95, plus 1 and 99
    const percentiles = {};
    const percentilesList = [1, ...Array.from({length: 19}, (_, i) => (i + 1) * 5), 99];
    
    percentilesList.forEach(p => {
      const index = Math.floor((p / 100) * finalAverages.length);
      percentiles[p] = finalAverages[index];
    });
    
    // Find the simulations closest to each percentile
    const percentileJourneys = {};
    Object.entries(percentiles).forEach(([percentile, value]) => {
      const closestSimulation = allSimulations.reduce((closest, current) => {
        return Math.abs(current.finalAverage - value) < Math.abs(closest.finalAverage - value) ? current : closest;
      });
      percentileJourneys[percentile] = closestSimulation.journey;
    });
    
    // Average journey across all simulations
    const averageJourney = [];
    for (let chest = 0; chest < numChests; chest++) {
      const chestData = { chest: chest + 1 };
      
      // Calculate average running average at this chest across all simulations
      chestData.runningAverage = allSimulations.reduce((sum, sim) => sum + sim.journey[chest].runningAverage, 0) / allSimulations.length;
      
      // Calculate average counts for each item at this chest
      items.forEach(item => {
        chestData[`avg_count_${item.name}`] = allSimulations.reduce((sum, sim) => sum + sim.journey[chest][`count_${item.name}`], 0) / allSimulations.length;
      });
      
      averageJourney.push(chestData);
    }
    
    setSimulationResults({
      allSimulations,
      averageJourney,
      percentiles,
      percentileJourneys,
      finalAverages
    });
  };

  // Initial simulation run
  useEffect(() => {
    runSimulation();
  }, []);

  const handlePercentileChange = (event) => {
    setPercentileView(Number(event.target.value));
  };

  if (!simulationResults) {
    return <div style={{ backgroundColor: colors.background, color: colors.textPrimary, minHeight: '100vh', padding: '1rem' }}>Loading simulation...</div>;
  }

  // Prepare data for distribution chart
  const prepareDistributionData = () => {
    const bucketSize = 0.5;
    const buckets = {};
    
    simulationResults.finalAverages.forEach(avg => {
      const bucketKey = Math.floor(avg / bucketSize) * bucketSize;
      buckets[bucketKey] = (buckets[bucketKey] || 0) + 1;
    });
    
    return Object.entries(buckets).map(([bucket, count]) => ({
      bucket: `${parseFloat(bucket).toFixed(1)}-${(parseFloat(bucket) + bucketSize).toFixed(1)}`,
      count,
      percentage: (count / simulationResults.finalAverages.length) * 100
    }));
  };

  // Format data for final item distribution
  const formatItemCounts = () => {
    const totalChests = numChests * numSimulations;
    return items.map(item => {
      const totalCount = simulationResults.allSimulations.reduce(
        (sum, sim) => sum + sim.itemCounts[item.name], 0
      );
      
      return {
        name: item.name,
        expectedCount: Math.round(item.probability * numChests * 100) / 100,
        actualCount: Math.round(totalCount / numSimulations * 100) / 100,
        actualPercentage: (totalCount / totalChests * 100).toFixed(2),
        expectedPercentage: (item.probability * 100).toFixed(2)
      };
    });
  };

  return (
    <div className="p-4 max-w-6xl mx-auto" style={{ 
      backgroundColor: colors.background, 
      color: colors.textPrimary,
      minHeight: '100vh' 
    }}>
      <h1 className="text-2xl font-bold mb-4" style={{ color: colors.textPrimary }}>Ossuary Item Drop Simulator</h1>
      
      <div className="mb-6 p-4 rounded-lg shadow" style={{ backgroundColor: colors.backgroundSecondary }}>
        <h2 className="text-lg font-semibold mb-3">Simulation Configuration</h2>
        
        {/* Drop Rates Configuration */}
        <div className="mb-4">
          <h3 className="text-md font-medium mb-2">Talisman Drop Rates (%)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            {items.map(item => (
              <div key={item.name}>
                <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>{item.name}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={rates[item.name]}
                  onChange={(e) => handleRateChange(item.name, Number(e.target.value))}
                  className="px-3 py-2 border rounded w-full"
                  style={{ backgroundColor: '#4f545c', color: colors.textPrimary, border: 'none' }}
                />
              </div>
            ))}
          </div>
          
          {error && (
            <div className="text-sm mb-2" style={{ color: colors.red }}>{error}</div>
          )}
          
          <div className="text-sm" style={{ color: colors.textSecondary }}>
            Total: {Object.values(rates).reduce((a, b) => a + b, 0)}% (must equal 100%)
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Number of Chests per Player</label>
            <input
              type="number"
              min="1"
              max="1000"
              value={numChests}
              onChange={(e) => setNumChests(parseInt(e.target.value) || 1)}
              className="px-3 py-2 border rounded w-32"
              style={{ backgroundColor: '#4f545c', color: colors.textPrimary, border: 'none' }}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>Number of Simulated Players</label>
            <input
              type="number"
              min="1"
              max="10000"
              value={numSimulations}
              onChange={(e) => setNumSimulations(parseInt(e.target.value) || 1)}
              className="px-3 py-2 border rounded w-32"
              style={{ backgroundColor: '#4f545c', color: colors.textPrimary, border: 'none' }}
            />
          </div>
          
          <div className="flex items-end">
            <button 
              onClick={runSimulation}
              disabled={error !== null}
              className="px-4 py-2 rounded text-white"
              style={{ 
                backgroundColor: error ? colors.textMuted : colors.blurple,
                cursor: error ? 'not-allowed' : 'pointer'
              }}
            >
              Run Simulation
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Expected vs Actual Drops */}
        <div className="p-4 rounded-lg shadow" style={{ backgroundColor: colors.backgroundSecondary }}>
          <h2 className="text-lg font-semibold mb-3">Expected vs. Actual Drop Rates</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: colors.backgroundTertiary }}>
                <th className="text-left p-2 border border-gray-700">Item</th>
                <th className="text-right p-2 border border-gray-700">Expected %</th>
                <th className="text-right p-2 border border-gray-700">Actual %</th>
                <th className="text-right p-2 border border-gray-700">Avg Items per Player</th>
              </tr>
            </thead>
            <tbody>
              {formatItemCounts().map((item, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? colors.backgroundSecondary : colors.background }}>
                  <td className="p-2 border border-gray-700">{item.name}</td>
                  <td className="text-right p-2 border border-gray-700">{item.expectedPercentage}%</td>
                  <td className="text-right p-2 border border-gray-700">{item.actualPercentage}%</td>
                  <td className="text-right p-2 border border-gray-700">{item.actualCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Distribution of Final Averages */}
        <div className="p-4 rounded-lg shadow" style={{ backgroundColor: colors.backgroundSecondary }}>
          <h2 className="text-lg font-semibold mb-3">Distribution of Final Averages</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={prepareDistributionData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
              <XAxis dataKey="bucket" stroke={colors.textSecondary} />
              <YAxis label={{ value: 'Number of Players', angle: -90, position: 'insideLeft', fill: colors.textSecondary }} stroke={colors.textSecondary} />
              <Tooltip contentStyle={{ 
                backgroundColor: colors.backgroundSecondary, 
                borderColor: colors.textMuted, 
                color: colors.textPrimary 
              }} 
              labelStyle={{ color: colors.textPrimary }} 
              />
              <Bar dataKey="count" fill={colors.blurple} name="Number of Players" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-sm text-center" style={{ color: colors.textSecondary }}>
            Average Talisman % after {numChests} chests
          </div>
        </div>
      </div>
      
      {/* Player Journey Analysis - fully styled dark mode */}
      <div className="mb-6 rounded-lg shadow" style={{ 
        backgroundColor: colors.backgroundSecondary,
        color: colors.textPrimary,
        border: `1px solid ${colors.backgroundTertiary}`,
        overflow: 'hidden'
      }}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Player Journey Analysis</h2>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showPercentiles"
                checked={showPercentiles}
                onChange={() => setShowPercentiles(!showPercentiles)}
                className="mr-2"
                style={{ accentColor: colors.blurple }}
              />
              <label htmlFor="showPercentiles" style={{ color: colors.textSecondary }}>Show Luck Percentiles</label>
            </div>
          </div>
          
          <h3 className="text-md font-medium mb-3">Average Value Progression</h3>
        </div>
        
        {/* Chart with dark background */}
        <div style={{ backgroundColor: colors.backgroundSecondary, padding: '0 20px 20px' }}>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
              style={{ backgroundColor: colors.backgroundSecondary }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#555555" />
              <XAxis 
                dataKey="chest" 
                type="number"
                domain={[1, numChests]}
                allowDataOverflow={true}
                label={{ value: 'Number of Chests Opened', position: 'insideBottom', offset: 0, fill: colors.textSecondary }}
                stroke={colors.textSecondary}
                tickMargin={10}
              />
              <YAxis 
                domain={[20, 35]}
                allowDataOverflow={true}
                label={{ 
                  value: 'Average Talisman %', 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: 10, 
                  fill: colors.textSecondary,
                  style: {
                    textAnchor: 'middle',
                    dominantBaseline: 'central',
                  }
                }}
                stroke={colors.textSecondary}
                tickMargin={10}
              />
              <Tooltip 
                formatter={(value) => [`${value.toFixed(2)}%`, 'Average Value']}
                contentStyle={{ 
                  backgroundColor: colors.backgroundSecondary, 
                  borderColor: colors.textMuted, 
                  color: colors.textPrimary 
                }}
                labelStyle={{ color: colors.textPrimary }}
              />
              <Legend 
                wrapperStyle={{ 
                  paddingTop: 20, 
                  paddingBottom: 10, 
                  color: colors.textSecondary 
                }}
                formatter={(value) => <span style={{ color: colors.textSecondary }}>{value}</span>}
              />
              
              {/* Mean Line */}
              <Line
                data={simulationResults.averageJourney}
                type="monotone"
                dataKey="runningAverage"
                stroke={colors.textPrimary}
                strokeWidth={2}
                name="Mean (All Players)"
                dot={false}
              />
              
              {/* Percentile Lines */}
              {showPercentiles && [5, 50, 95].map(percentile => {
                // Special highlighting for 5th, 50th, and 95th percentiles
                let strokeColor = "#aaaaaa";
                let strokeWidth = 2;
                let strokeOpacity = 1;
                
                if (percentile === 5) {
                  strokeColor = colors.red; // Red
                } else if (percentile === 50) {
                  strokeColor = colors.yellow; // Yellow
                } else if (percentile === 95) {
                  strokeColor = colors.green; // Green
                }
                
                return (
                  <Line
                    key={percentile}
                    data={simulationResults.percentileJourneys[percentile]}
                    type="monotone"
                    dataKey="runningAverage"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={strokeOpacity}
                    name={`${percentile}th Percentile${percentile === 5 ? ' (Unlucky)' : percentile === 50 ? ' (Average)' : percentile === 95 ? ' (Lucky)' : ''}`}
                    dot={false}
                  />
                );
              })}
              
              {/* Selected Percentile */}
              {!showPercentiles && percentileView && (
                <Line
                  data={simulationResults.percentileJourneys[percentileView]}
                  type="monotone"
                  dataKey="runningAverage"
                  stroke="#0000FF"
                  strokeWidth={2}
                  name={`${percentileView}th Percentile Player`}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Player Experience Insights - styled for dark mode */}
        <div className="p-4">
          <h3 className="text-md font-medium mb-3">Player Experience Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded border-2" style={{ 
              backgroundColor: 'rgba(237, 66, 69, 0.1)', 
              borderColor: colors.red,
            }}>
              <h4 className="font-semibold mb-2" style={{ color: colors.textPrimary }}>Unlucky Players (5th percentile)</h4>
              <p style={{ color: colors.textSecondary }}>Final Average: <strong style={{ color: colors.textPrimary }}>{simulationResults.percentiles[5].toFixed(2)}%</strong></p>
              <p style={{ color: colors.textSecondary }}>Expected +50% items: <strong style={{ color: colors.textPrimary }}>{Math.round(numChests * rates["+50% Talisman"] / 100 * 100) / 100}</strong></p>
              <p style={{ color: colors.textSecondary }}>Actual +50% items: <strong style={{ color: colors.textPrimary }}>{simulationResults.percentileJourneys[5][numChests-1]["count_+50% Talisman"]}</strong></p>
            </div>
            
            <div className="p-4 rounded border-2" style={{ 
              backgroundColor: 'rgba(250, 166, 26, 0.1)', 
              borderColor: colors.yellow,
            }}>
              <h4 className="font-semibold mb-2" style={{ color: colors.textPrimary }}>Average Players (50th percentile)</h4>
              <p style={{ color: colors.textSecondary }}>Final Average: <strong style={{ color: colors.textPrimary }}>{simulationResults.percentiles[50].toFixed(2)}%</strong></p>
              <p style={{ color: colors.textSecondary }}>Expected +50% items: <strong style={{ color: colors.textPrimary }}>{Math.round(numChests * rates["+50% Talisman"] / 100 * 100) / 100}</strong></p>
              <p style={{ color: colors.textSecondary }}>Actual +50% items: <strong style={{ color: colors.textPrimary }}>{simulationResults.percentileJourneys[50][numChests-1]["count_+50% Talisman"]}</strong></p>
            </div>
            
            <div className="p-4 rounded border-2" style={{ 
              backgroundColor: 'rgba(59, 165, 92, 0.1)', 
              borderColor: colors.green,
            }}>
              <h4 className="font-semibold mb-2" style={{ color: colors.textPrimary }}>Lucky Players (95th percentile)</h4>
              <p style={{ color: colors.textSecondary }}>Final Average: <strong style={{ color: colors.textPrimary }}>{simulationResults.percentiles[95].toFixed(2)}%</strong></p>
              <p style={{ color: colors.textSecondary }}>Expected +50% items: <strong style={{ color: colors.textPrimary }}>{Math.round(numChests * rates["+50% Talisman"] / 100 * 100) / 100}</strong></p>
              <p style={{ color: colors.textSecondary }}>Actual +50% items: <strong style={{ color: colors.textPrimary }}>{simulationResults.percentileJourneys[95][numChests-1]["count_+50% Talisman"]}</strong></p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-sm p-4 rounded mb-4" style={{ backgroundColor: colors.backgroundTertiary, color: colors.textSecondary }}>
        <p><strong style={{ color: colors.textPrimary }}>Note:</strong> This simulation helps you understand the player experience based on your configured drop rates. The color-coded lines show different luck levels, with the 5th percentile in red (unlucky players), 50th percentile in yellow (average players), and 95th percentile in green (lucky players).</p>
      </div>
    </div>
  );
};

export default OssuarySimulator;