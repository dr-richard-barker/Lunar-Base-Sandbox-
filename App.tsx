
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem, HistoryEntry } from './types';
import { BUILDINGS, TICK_RATE_MS, INITIAL_MONEY, MAP_SIZES, TECH_TREE, INITIAL_UNLOCKED_TECHS, POP_CO2_PRODUCTION, POP_O2_CONSUMPTION, POP_FOOD_CONSUMPTION } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateCityGoal, generateNewsEvent } from './services/geminiService';

const createInitialGrid = (size: number): Grid => {
  const grid: Grid = [];
  // Simple noise simulation for terrain
  const seed = Math.random() * 100;
  
  for (let y = 0; y < size; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < size; x++) {
      // Create craters and plateaus
      const dist = Math.sqrt(Math.pow(x - size/2, 2) + Math.pow(y - size/2, 2));
      let height = 0;
      
      // Central plateau
      if (dist < 5) height = 1;
      
      // Random crater
      const craterX = size * 0.2;
      const craterY = size * 0.7;
      const craterDist = Math.sqrt(Math.pow(x - craterX, 2) + Math.pow(y - craterY, 2));
      if (craterDist < 4) height = -1;

      // Quantize height for buildable terraces
      height = Math.round(height);

      row.push({ x, y, buildingType: BuildingType.None, height });
    }
    grid.push(row);
  }
  return grid;
};

function App() {
  // --- Game State ---
  const [gameStarted, setGameStarted] = useState(false);
  const [mapSize, setMapSize] = useState(MAP_SIZES.Medium);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoGrowth, setAutoGrowth] = useState(false);
  const [viewMode, setViewMode] = useState<'standard' | 'orbital' | 'moon'>('standard');

  const [grid, setGrid] = useState<Grid>(() => createInitialGrid(MAP_SIZES.Medium));
  const [stats, setStats] = useState<CityStats>({ 
    money: INITIAL_MONEY, 
    population: 0, 
    day: 1,
    science: 0,
    powerSupply: 0,
    powerDemand: 0,
    oxygen: 100,
    co2: 400,
    food: 100
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [selectedTool, setSelectedTool] = useState<BuildingType>(BuildingType.Road);
  const [unlockedTechs, setUnlockedTechs] = useState<string[]>(INITIAL_UNLOCKED_TECHS);
  const [unlockedBuildings, setUnlockedBuildings] = useState<BuildingType[]>([]);

  // --- AI State ---
  const [currentGoal, setCurrentGoal] = useState<AIGoal | null>(null);
  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  
  // Refs
  const gridRef = useRef(grid);
  const statsRef = useRef(stats);
  const goalRef = useRef(currentGoal);
  const aiEnabledRef = useRef(aiEnabled);
  const autoGrowthRef = useRef(autoGrowth);
  const unlockedBuildingsRef = useRef(unlockedBuildings);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { goalRef.current = currentGoal; }, [currentGoal]);
  useEffect(() => { aiEnabledRef.current = aiEnabled; }, [aiEnabled]);
  useEffect(() => { autoGrowthRef.current = autoGrowth; }, [autoGrowth]);
  useEffect(() => { unlockedBuildingsRef.current = unlockedBuildings; }, [unlockedBuildings]);

  // --- Tech Logic ---
  useEffect(() => {
      const buildings = new Set<BuildingType>();
      buildings.add(BuildingType.None); // Always available
      
      unlockedTechs.forEach(techId => {
          const tech = TECH_TREE.find(t => t.id === techId);
          if (tech) {
              tech.unlocks.forEach(b => buildings.add(b));
          }
      });
      setUnlockedBuildings(Array.from(buildings));
  }, [unlockedTechs]);

  const handleUnlockTech = (techId: string) => {
      const tech = TECH_TREE.find(t => t.id === techId);
      if (!tech) return;
      
      if (stats.science >= tech.cost) {
          setStats(prev => ({ ...prev, science: prev.science - tech.cost }));
          setUnlockedTechs(prev => [...prev, techId]);
          addNewsItem({ id: Date.now().toString(), text: `Research Completed: ${tech.name}`, type: 'positive' });
      } else {
          addNewsItem({ id: Date.now().toString(), text: `Insufficient Science for ${tech.name}`, type: 'negative' });
      }
  };

  const addNewsItem = useCallback((item: NewsItem) => {
    setNewsFeed(prev => [...prev.slice(-12), item]); 
  }, []);

  const fetchNewGoal = useCallback(async () => {
    if (isGeneratingGoal || !aiEnabledRef.current) return;
    setIsGeneratingGoal(true);
    await new Promise(r => setTimeout(r, 500));
    
    const newGoal = await generateCityGoal(statsRef.current, gridRef.current);
    if (newGoal) {
      setCurrentGoal(newGoal);
    } else {
      if(aiEnabledRef.current) setTimeout(fetchNewGoal, 5000);
    }
    setIsGeneratingGoal(false);
  }, [isGeneratingGoal]); 

  const fetchNews = useCallback(async () => {
    if (!aiEnabledRef.current || Math.random() > 0.15) return; 
    const news = await generateNewsEvent(statsRef.current, null);
    if (news) addNewsItem(news);
  }, [addNewsItem]);

  // --- Initial Setup ---
  useEffect(() => {
    if (!gameStarted) return;
    addNewsItem({ id: Date.now().toString(), text: "Colony initialization complete. Life support systems active.", type: 'positive' });
    if (aiEnabled) fetchNewGoal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted]);


  // --- Auto Growth Logic (Smart Needs Based & Organic Clustering) ---
  const attemptAutoBuild = useCallback(() => {
    const currentStats = statsRef.current;
    const currentGrid = gridRef.current;
    const available = unlockedBuildingsRef.current;

    // Safety buffer
    if (currentStats.money < 300) return;

    // 1. Calculate Needs
    const powerRatio = currentStats.powerSupply > 0 ? currentStats.powerDemand / currentStats.powerSupply : 1.1;
    const foodStock = currentStats.food;
    const oxygen = currentStats.oxygen;
    
    // Calculate Housing Capacity
    let residentialCount = 0;
    currentGrid.flat().forEach(t => {
        if (t.buildingType === BuildingType.Residential && t.ownerX === undefined) residentialCount++;
        else if (t.buildingType === BuildingType.Residential && t.ownerX === t.x && t.ownerY === t.y) residentialCount++;
    });
    const maxPop = residentialCount * 50;
    const popRatio = maxPop > 0 ? currentStats.population / maxPop : 1.1;

    let targetType: BuildingType | null = null;

    // Priority 1: Life Support Critical
    if (oxygen < 80 || foodStock < currentStats.population * 2) {
         if (available.includes(BuildingType.Agriculture)) targetType = BuildingType.Agriculture;
         else if (available.includes(BuildingType.Park)) targetType = BuildingType.Park;
    }
    // Priority 2: Power
    else if (powerRatio > 0.85) {
        if (available.includes(BuildingType.FusionReactor) && currentStats.money > 3500) {
            targetType = BuildingType.FusionReactor;
        } else if (available.includes(BuildingType.SolarPanel)) {
            targetType = BuildingType.SolarPanel;
        }
    } 
    // Priority 3: Housing
    else if (popRatio > 0.9) {
        if (available.includes(BuildingType.Residential)) {
            targetType = BuildingType.Residential;
        }
    }
    // Priority 4: Economy / Jobs
    else {
        // Weighted random choice based on availability
        const ecoOptions = [];
        if (available.includes(BuildingType.Agriculture)) ecoOptions.push(BuildingType.Agriculture); 
        if (available.includes(BuildingType.Commercial)) ecoOptions.push(BuildingType.Commercial);
        if (available.includes(BuildingType.Industrial)) ecoOptions.push(BuildingType.Industrial);
        if (available.includes(BuildingType.Park)) ecoOptions.push(BuildingType.Park);
        if (available.includes(BuildingType.ResearchLab) && currentStats.money > 2000) ecoOptions.push(BuildingType.ResearchLab);
        if (available.includes(BuildingType.GreenRoad) && Math.random() > 0.7) ecoOptions.push(BuildingType.GreenRoad);

        if (ecoOptions.length > 0) {
             targetType = ecoOptions[Math.floor(Math.random() * ecoOptions.length)];
        }
    }

    if (!targetType) return;
    const config = BUILDINGS[targetType];
    if (currentStats.money < config.cost) return;

    // 2. Find Location (Organic Clustering)
    // Identify existing hubs to grow from
    const hubs: TileData[] = [];
    currentGrid.flat().forEach(t => {
        // We prefer to build near existing structures that aren't just roads (though roads are okay too)
        if (t.buildingType !== BuildingType.None) {
            hubs.push(t);
        }
    });

    let startX = mapSize / 2;
    let startY = mapSize / 2;

    // If we have buildings, pick a random one to expand near
    if (hubs.length > 0) {
        const randomHub = hubs[Math.floor(Math.random() * hubs.length)];
        startX = randomHub.x;
        startY = randomHub.y;
    }

    // Try multiple spots spiraling/randomly near the chosen hub
    for (let attempt = 0; attempt < 20; attempt++) {
        // Biased random point near the hub (closer is more likely)
        const angle = Math.random() * Math.PI * 2;
        // Range 1 to 5 tiles away
        const dist = 1 + Math.random() * 4 + (attempt * 0.2); 
        
        const x = Math.floor(startX + Math.cos(angle) * dist);
        const y = Math.floor(startY + Math.sin(angle) * dist);

        if (x < 0 || y < 0 || x >= mapSize || y >= mapSize) continue;
        if (x + config.width > mapSize || y + config.height > mapSize) continue;

        // Check if spot is valid (empty AND flat)
        let occupied = false;
        let baseHeight = currentGrid[y][x].height; // Height of top-left corner
        
        for(let i=0; i<config.width; i++) {
            for(let j=0; j<config.height; j++) {
                if (currentGrid[y+j][x+i].buildingType !== BuildingType.None) occupied = true;
                if (currentGrid[y+j][x+i].height !== baseHeight) occupied = true; // Must be flat
            }
        }
        if (occupied) continue;

        // Place it
        const newGrid = currentGrid.map(row => [...row]);
        const variant = Math.floor(Math.random() * 4); // Random variant

        for(let i=0; i<config.width; i++) {
            for(let j=0; j<config.height; j++) {
                newGrid[y+j][x+i] = {
                    ...newGrid[y+j][x+i],
                    buildingType: targetType,
                    ownerX: x,
                    ownerY: y,
                    variant: variant
                };
            }
        }
        
        setGrid(newGrid);
        setStats(prev => ({ ...prev, money: prev.money - config.cost }));
        break; 
    }
  }, [mapSize]);

  // --- Game Loop ---
  useEffect(() => {
    if (!gameStarted) return;

    const intervalId = setInterval(() => {
      let dailyIncome = 0;
      let dailyPopGrowth = 0;
      let dailyScience = 0;
      let powerGen = 0;
      let powerDrain = 0;
      let bioFoodGen = 0;
      let bioO2Gen = 0;
      let bioCO2Gen = 0;

      let buildingCounts: Record<string, number> = {};

      const processedRoots = new Set<string>();

      gridRef.current.flat().forEach(tile => {
        if (tile.buildingType !== BuildingType.None) {
          const rootId = tile.ownerX !== undefined ? `${tile.ownerX},${tile.ownerY}` : `${tile.x},${tile.y}`;
          
          if (!processedRoots.has(rootId)) {
            processedRoots.add(rootId);
            const config = BUILDINGS[tile.buildingType];
            
            // Power Calculation
            if (config.powerGen > 0) powerGen += config.powerGen;
            else powerDrain += Math.abs(config.powerGen);

            // Bio Stats
            bioFoodGen += config.foodGen;
            bioO2Gen += config.oxygenGen;
            bioCO2Gen += config.co2Gen;

            // Base stats (will adjust for low power later)
            dailyIncome += config.incomeGen;
            dailyPopGrowth += config.popGen;
            dailyScience += config.scienceGen;
            
            buildingCounts[tile.buildingType] = (buildingCounts[tile.buildingType] || 0) + 1;
          }
        }
      });

      // Power Penalty Logic
      const powerRatio = powerDrain > 0 ? Math.min(1, powerGen / powerDrain) : 1;
      const isLowPower = powerRatio < 1;

      if (isLowPower) {
          dailyIncome = Math.floor(dailyIncome * powerRatio);
          dailyPopGrowth = 0; // No growth without full power
          dailyScience = Math.floor(dailyScience * powerRatio);
          bioFoodGen = Math.floor(bioFoodGen * powerRatio); // Farms fail without power
          bioO2Gen = bioO2Gen * powerRatio; // Algae dies without light/pumps
      }

      const resCount = buildingCounts[BuildingType.Residential] || 0;
      const maxPop = resCount * 50; 

      // Auto Growth Tick
      if (autoGrowthRef.current) attemptAutoBuild();

      setStats(prev => {
        // --- Atmosphere & Food Simulation ---
        const pop = prev.population;
        
        // 1. Food Consumption
        const foodNeeded = pop * POP_FOOD_CONSUMPTION;
        let newFood = prev.food + bioFoodGen - foodNeeded;
        let starvation = 0;
        
        if (newFood < 0) {
            // Starvation mechanic
            starvation = Math.abs(newFood); // People who couldn't eat
            newFood = 0;
        }

        // 2. Oxygen & CO2
        const o2Consumed = pop * POP_O2_CONSUMPTION;
        const co2Produced = pop * POP_CO2_PRODUCTION;

        let newO2 = prev.oxygen + bioO2Gen - o2Consumed;
        let newCO2 = prev.co2 + co2Produced + bioCO2Gen;

        // Natural baseline drift if empty (lunar regolith doesn't breathe)
        if (pop === 0 && processedRoots.size === 0) {
            newO2 = 100;
            newCO2 = 400;
        }

        // Clamping
        if (newO2 > 100) newO2 = 100;
        if (newO2 < 0) newO2 = 0;
        if (newCO2 < 300) newCO2 = 300; // Minimum baseline

        // Survival Check
        let deathToll = 0;
        
        // Starvation Deaths
        if (starvation > 0) deathToll += Math.floor(starvation * 0.1); // 10% of starving people die per tick
        
        // Suffocation Deaths
        if (newO2 < 10) deathToll += Math.floor(pop * 0.05);
        else if (newO2 < 5) deathToll += Math.floor(pop * 0.2);

        // CO2 Toxicity
        if (newCO2 > 2000) deathToll += Math.floor(pop * 0.02);

        let newPop = pop + dailyPopGrowth - deathToll;
        if (newPop > maxPop) newPop = maxPop; 
        if (newPop < 0) newPop = 0;

        // Alerts
        if (deathToll > 0 && Math.random() < 0.2) {
            addNewsItem({id: Date.now().toString(), text: "CRITICAL: Life support failure causing casualties.", type: 'negative'});
        }
        if (newCO2 > 1500 && Math.random() < 0.1) {
             addNewsItem({id: Date.now().toString(), text: "WARNING: High CO2 levels detected.", type: 'negative'});
        }
        if (newO2 < 20 && Math.random() < 0.1) {
             addNewsItem({id: Date.now().toString(), text: "WARNING: Low Oxygen levels.", type: 'negative'});
        }
        if (starvation > 0 && Math.random() < 0.1) {
             addNewsItem({id: Date.now().toString(), text: "WARNING: Food stocks depleted.", type: 'negative'});
        }

        const newStats = {
          money: prev.money + dailyIncome,
          population: newPop,
          day: prev.day + 1,
          science: prev.science + dailyScience,
          powerSupply: powerGen,
          powerDemand: powerDrain,
          oxygen: newO2,
          co2: newCO2,
          food: newFood
        };

        // --- Update History Buffer ---
        setHistory(prevHist => {
            const newEntry: HistoryEntry = {
                day: newStats.day,
                population: newStats.population,
                money: newStats.money,
                science: newStats.science,
                powerSupply: newStats.powerSupply,
                powerDemand: newStats.powerDemand,
                oxygen: newStats.oxygen,
                co2: newStats.co2,
                food: newStats.food
            };
            // Keep last 60 ticks (approx 2 minutes of real time at 2s/tick, or just a nice trail)
            const newHist = [...prevHist, newEntry];
            if (newHist.length > 60) newHist.shift();
            return newHist;
        });
        
        // Check Goal
        const goal = goalRef.current;
        if (aiEnabledRef.current && goal && !goal.completed) {
          let isMet = false;
          if (goal.targetType === 'money' && newStats.money >= goal.targetValue) isMet = true;
          if (goal.targetType === 'population' && newStats.population >= goal.targetValue) isMet = true;
          if (goal.targetType === 'science' && newStats.science >= goal.targetValue) isMet = true;
          if (goal.targetType === 'building_count' && goal.buildingType) {
            if ((buildingCounts[goal.buildingType] || 0) >= goal.targetValue) isMet = true;
          }

          if (isMet) {
            setCurrentGoal({ ...goal, completed: true });
          }
        }

        return newStats;
      });
      
      // Alert for power
      if (isLowPower && Math.random() < 0.1) {
         addNewsItem({id: Date.now().toString(), text: "WARNING: Power grid insufficient. Systems failing.", type: 'negative'});
      }

      fetchNews();

    }, TICK_RATE_MS);

    return () => clearInterval(intervalId);
  }, [fetchNews, gameStarted, attemptAutoBuild, addNewsItem]);


  // --- Interaction Logic ---

  const handleTileClick = useCallback((x: number, y: number) => {
    if (!gameStarted || viewMode === 'moon') return; 

    const currentGrid = gridRef.current;
    const currentStats = statsRef.current;
    const tool = selectedTool; 
    
    if (x < 0 || x >= mapSize || y < 0 || y >= mapSize) return;

    const clickedTile = currentGrid[y][x];
    const buildingConfig = BUILDINGS[tool];

    // Bulldoze logic
    if (tool === BuildingType.None) {
      if (clickedTile.buildingType !== BuildingType.None) {
        const demolishCost = 50; 
        if (currentStats.money >= demolishCost) {
            const newGrid = currentGrid.map(row => [...row]);
            const rootX = clickedTile.ownerX !== undefined ? clickedTile.ownerX : clickedTile.x;
            const rootY = clickedTile.ownerY !== undefined ? clickedTile.ownerY : clickedTile.y;
            const targetType = currentGrid[rootY][rootX].buildingType;
            const targetConfig = BUILDINGS[targetType];
            
            for(let i = 0; i < targetConfig.width; i++) {
              for(let j = 0; j < targetConfig.height; j++) {
                 if (rootY+j < mapSize && rootX+i < mapSize) {
                    newGrid[rootY+j][rootX+i] = { 
                      ...newGrid[rootY+j][rootX+i],
                      buildingType: BuildingType.None,
                      ownerX: undefined,
                      ownerY: undefined,
                      variant: undefined
                    };
                 }
              }
            }
            setGrid(newGrid);
            setStats(prev => ({ ...prev, money: prev.money - demolishCost }));
        } else {
            addNewsItem({id: Date.now().toString(), text: "Insufficient credits for demolition crews.", type: 'negative'});
        }
      }
      return;
    }

    // Placement Logic
    if (!unlockedBuildings.includes(tool)) {
         addNewsItem({id: Date.now().toString(), text: "Technology not yet researched.", type: 'negative'});
         return;
    }

    if (x + buildingConfig.width > mapSize || y + buildingConfig.height > mapSize) {
       addNewsItem({id: Date.now().toString(), text: "Cannot place here: Outside colony bounds.", type: 'negative'});
       return;
    }

    let occupied = false;
    let baseHeight = currentGrid[y][x].height;

    for(let i = 0; i < buildingConfig.width; i++) {
      for(let j = 0; j < buildingConfig.height; j++) {
        const t = currentGrid[y+j][x+i];
        
        // Special case: Upgrading Road to GreenRoad
        if (tool === BuildingType.GreenRoad && t.buildingType === BuildingType.Road) {
             // Allow placement (it counts as unoccupied for this specific upgrade)
        } else {
            if (t.buildingType !== BuildingType.None) occupied = true;
        }
        
        if (t.height !== baseHeight) occupied = true; 
      }
    }

    if (occupied) {
      addNewsItem({id: Date.now().toString(), text: "Sector occupied or uneven terrain.", type: 'negative'});
      return;
    }

    if (currentStats.money >= buildingConfig.cost) {
      setStats(prev => ({ ...prev, money: prev.money - buildingConfig.cost }));
      
      const newGrid = currentGrid.map(row => [...row]);
      const variant = Math.floor(Math.random() * 4); // Random visual variant
      
      for(let i = 0; i < buildingConfig.width; i++) {
        for(let j = 0; j < buildingConfig.height; j++) {
           newGrid[y+j][x+i] = {
             ...newGrid[y+j][x+i],
             buildingType: tool,
             ownerX: x,
             ownerY: y,
             variant: variant
           };
        }
      }
      setGrid(newGrid);
    } else {
      addNewsItem({id: Date.now().toString(), text: `Insufficient credits for ${buildingConfig.name}.`, type: 'negative'});
    }
  }, [selectedTool, addNewsItem, gameStarted, mapSize, unlockedBuildings, viewMode]);

  const handleClaimReward = () => {
    if (currentGoal && currentGoal.completed) {
      setStats(prev => ({ ...prev, money: prev.money + currentGoal.reward }));
      addNewsItem({id: Date.now().toString(), text: `Contract fulfilled. ${currentGoal.reward} deposited.`, type: 'positive'});
      setCurrentGoal(null);
      fetchNewGoal();
    }
  };

  const handleStart = (enabled: boolean, size: number) => {
    setAiEnabled(enabled);
    setMapSize(size);
    setGrid(createInitialGrid(size));
    setGameStarted(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden selection:bg-transparent selection:text-transparent bg-black">
      <IsoMap 
        grid={grid} 
        onTileClick={handleTileClick} 
        hoveredTool={selectedTool}
        population={stats.population}
        mapSize={mapSize}
        viewMode={viewMode}
      />
      
      {!gameStarted && (
        <StartScreen onStart={handleStart} />
      )}

      {gameStarted && (
        <UIOverlay
          stats={stats}
          history={history}
          selectedTool={selectedTool}
          onSelectTool={setSelectedTool}
          currentGoal={currentGoal}
          newsFeed={newsFeed}
          onClaimReward={handleClaimReward}
          isGeneratingGoal={isGeneratingGoal}
          aiEnabled={aiEnabled}
          autoGrowth={autoGrowth}
          onToggleAutoGrowth={() => setAutoGrowth(!autoGrowth)}
          unlockedTechs={unlockedTechs}
          onUnlockTech={handleUnlockTech}
          unlockedBuildings={unlockedBuildings}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      )}
    </div>
  );
}

export default App;
