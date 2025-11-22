
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Grid, TileData, BuildingType, CityStats, AIGoal, NewsItem } from './types';
import { BUILDINGS, TICK_RATE_MS, INITIAL_MONEY, MAP_SIZES, TECH_TREE, INITIAL_UNLOCKED_TECHS } from './constants';
import IsoMap from './components/IsoMap';
import UIOverlay from './components/UIOverlay';
import StartScreen from './components/StartScreen';
import { generateCityGoal, generateNewsEvent } from './services/geminiService';

const createInitialGrid = (size: number): Grid => {
  const grid: Grid = [];
  for (let y = 0; y < size; y++) {
    const row: TileData[] = [];
    for (let x = 0; x < size; x++) {
      row.push({ x, y, buildingType: BuildingType.None });
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

  const [grid, setGrid] = useState<Grid>(() => createInitialGrid(MAP_SIZES.Medium));
  const [stats, setStats] = useState<CityStats>({ 
    money: INITIAL_MONEY, 
    population: 0, 
    day: 1,
    science: 0,
    powerSupply: 0,
    powerDemand: 0
  });
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


  // --- Auto Growth Logic ---
  const attemptAutoBuild = useCallback(() => {
    const currentStats = statsRef.current;
    const currentGrid = gridRef.current;
    const available = unlockedBuildingsRef.current;

    if (currentStats.money < 500) return;
    if (currentStats.powerSupply < currentStats.powerDemand) {
         // Prioritize Power
         if (available.includes(BuildingType.FusionReactor) && currentStats.money > 3000) {
            // Try building fusion
         } else if (available.includes(BuildingType.SolarPanel)) {
             // Try building solar
             // (Logic simplified below to just generic picking for now)
         }
    }

    // Simple logic: Pick a random available building (weighted slightly)
    let candidates = available.filter(b => b !== BuildingType.None && b !== BuildingType.Road);
    if (candidates.length === 0) return;
    
    const typeToBuild = candidates[Math.floor(Math.random() * candidates.length)];
    const config = BUILDINGS[typeToBuild];

    if (currentStats.money < config.cost) return;

    // Try to find a valid spot
    for (let attempt = 0; attempt < 20; attempt++) {
        const x = Math.floor(Math.random() * mapSize);
        const y = Math.floor(Math.random() * mapSize);
        
        if (x + config.width > mapSize || y + config.height > mapSize) continue;

        let occupied = false;
        for(let i=0; i<config.width; i++) {
            for(let j=0; j<config.height; j++) {
                if (currentGrid[y+j][x+i].buildingType !== BuildingType.None) occupied = true;
            }
        }
        if (occupied) continue;

        // Place it
        const newGrid = currentGrid.map(row => [...row]);
        for(let i=0; i<config.width; i++) {
            for(let j=0; j<config.height; j++) {
                newGrid[y+j][x+i] = {
                    ...newGrid[y+j][x+i],
                    buildingType: typeToBuild,
                    ownerX: x,
                    ownerY: y
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
      }

      const resCount = buildingCounts[BuildingType.Residential] || 0;
      const maxPop = resCount * 50; 

      // Auto Growth
      if (autoGrowthRef.current) attemptAutoBuild();

      setStats(prev => {
        let newPop = prev.population + dailyPopGrowth;
        if (newPop > maxPop) newPop = maxPop; 
        if (resCount === 0 && prev.population > 0) newPop = Math.max(0, prev.population - 5);

        const newStats = {
          money: prev.money + dailyIncome,
          population: newPop,
          day: prev.day + 1,
          science: prev.science + dailyScience,
          powerSupply: powerGen,
          powerDemand: powerDrain
        };
        
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
    if (!gameStarted) return; 

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
                      x: rootX+i, 
                      y: rootY+j, 
                      buildingType: BuildingType.None,
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
    for(let i = 0; i < buildingConfig.width; i++) {
      for(let j = 0; j < buildingConfig.height; j++) {
        if (currentGrid[y+j][x+i].buildingType !== BuildingType.None) {
          occupied = true;
          break;
        }
      }
    }

    if (occupied) {
      addNewsItem({id: Date.now().toString(), text: "Sector occupied. Demolish existing structures first.", type: 'negative'});
      return;
    }

    if (currentStats.money >= buildingConfig.cost) {
      setStats(prev => ({ ...prev, money: prev.money - buildingConfig.cost }));
      
      const newGrid = currentGrid.map(row => [...row]);
      for(let i = 0; i < buildingConfig.width; i++) {
        for(let j = 0; j < buildingConfig.height; j++) {
           newGrid[y+j][x+i] = {
             ...newGrid[y+j][x+i],
             buildingType: tool,
             ownerX: x,
             ownerY: y
           };
        }
      }
      setGrid(newGrid);
    } else {
      addNewsItem({id: Date.now().toString(), text: `Insufficient credits for ${buildingConfig.name}.`, type: 'negative'});
    }
  }, [selectedTool, addNewsItem, gameStarted, mapSize, unlockedBuildings]);

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
      />
      
      {!gameStarted && (
        <StartScreen onStart={handleStart} />
      )}

      {gameStarted && (
        <UIOverlay
          stats={stats}
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
        />
      )}
    </div>
  );
}

export default App;
