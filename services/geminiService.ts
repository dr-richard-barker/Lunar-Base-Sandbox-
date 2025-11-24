
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { AIGoal, BuildingType, CityStats, Grid, NewsItem } from "../types";
import { BUILDINGS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = 'gemini-2.5-flash';

// --- Circuit Breaker / Fallback System ---
let apiCooldownUntil = 0;
const COOLDOWN_DURATION_MS = 120000; // 2 minutes cooldown on error

const FALLBACK_NEWS_TEMPLATES = [
    { text: "Solar flare activity detected. Shields holding.", type: "neutral" },
    { text: "He3 production efficiency nominal.", type: "positive" },
    { text: "Minor pressure drop in Sector 7.", type: "negative" },
    { text: "Trade shuttle arriving from Earth orbit.", type: "positive" },
    { text: "Dust storms reported near the crater rim.", type: "neutral" },
    { text: "Colonist morale is stable.", type: "positive" },
    { text: "Recycling systems require maintenance.", type: "neutral" },
    { text: "Deep space telemetry signal received.", type: "neutral" },
    { text: "Fusion reactor output within safety limits.", type: "positive" },
    { text: "Automated perimeter drones deployed.", type: "neutral" },
    { text: "Atmospheric regulators cycling.", type: "neutral" },
    { text: "Cargo manifest received from Luna-2.", type: "positive" },
];

const FALLBACK_GOALS: Partial<AIGoal>[] = [
    { description: "Expand habitation modules to support new colonists.", targetType: 'population', targetValue: 50, reward: 500 },
    { description: "Stockpile credits for emergency repairs.", targetType: 'money', targetValue: 5000, reward: 200 },
    { description: "Increase Science output to unlock new tech.", targetType: 'science', targetValue: 100, reward: 1000 },
    { description: "Construct additional Solar Arrays for grid stability.", targetType: 'building_count', buildingType: BuildingType.SolarPanel, targetValue: 5, reward: 300 },
    { description: "Establish a stable food supply chain.", targetType: 'building_count', buildingType: BuildingType.Agriculture, targetValue: 3, reward: 450 },
    { description: "Develop commercial district for off-world trade.", targetType: 'building_count', buildingType: BuildingType.Commercial, targetValue: 2, reward: 600 },
];

const getFallbackGoal = (stats: CityStats): AIGoal => {
    const template = FALLBACK_GOALS[Math.floor(Math.random() * FALLBACK_GOALS.length)];
    let target = template.targetValue || 100;
    
    // Scale target based on current stats to make it relevant
    if (template.targetType === 'money') target = Math.floor(stats.money * 1.5) + 1000;
    if (template.targetType === 'population') target = Math.floor(stats.population * 1.2) + 15;
    if (template.targetType === 'science') target = Math.floor(stats.science * 1.2) + 50;
    
    return {
        description: template.description || "Expand Colony Operations",
        targetType: template.targetType as any,
        targetValue: target,
        buildingType: template.buildingType,
        reward: template.reward || 500,
        completed: false
    };
};

const getFallbackNews = (): NewsItem => {
    const template = FALLBACK_NEWS_TEMPLATES[Math.floor(Math.random() * FALLBACK_NEWS_TEMPLATES.length)];
    return {
        id: Date.now().toString() + Math.random(),
        text: template.text,
        type: template.type as any
    };
};

const handleApiError = (error: any) => {
    console.warn("Gemini API Error (Switching to Fallback Mode):", error);
    // Trigger cooldown on quota limits or server errors
    if (error.status === 'RESOURCE_EXHAUSTED' || error.code === 429 || error.code === 500 || error.status === 'UNKNOWN') {
        apiCooldownUntil = Date.now() + COOLDOWN_DURATION_MS;
    }
};

// --- Goal Generation ---

const goalSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A short, creative objective from the perspective of the Lunar Command AI. Focus on Helium-3 mining operations, bio-regenerative life support stability, and expansion.",
    },
    targetType: {
      type: Type.STRING,
      enum: ['population', 'money', 'building_count', 'science'],
      description: "The metric to track.",
    },
    targetValue: {
      type: Type.INTEGER,
      description: "The target numeric value to reach.",
    },
    buildingType: {
      type: Type.STRING,
      enum: [BuildingType.Residential, BuildingType.Commercial, BuildingType.Industrial, BuildingType.Park, BuildingType.Road, BuildingType.SolarPanel, BuildingType.FusionReactor, BuildingType.ResearchLab, BuildingType.Agriculture],
      description: "Required if targetType is building_count.",
    },
    reward: {
      type: Type.INTEGER,
      description: "Credit reward for completion.",
    },
  },
  required: ['description', 'targetType', 'targetValue', 'reward'],
};

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  if (Date.now() < apiCooldownUntil) {
      return getFallbackGoal(stats);
  }

  // Count buildings
  const counts: Record<string, number> = {};
  grid.flat().forEach(tile => {
    // Only count "root" tiles to avoid double counting multi-tile buildings
    if (tile.buildingType !== BuildingType.None && (!tile.ownerX || (tile.ownerX === tile.x && tile.ownerY === tile.y))) {
      counts[tile.buildingType] = (counts[tile.buildingType] || 0) + 1;
    }
  });

  const context = `
    Current Lunar Base Stats:
    Sol: ${stats.day}
    Credits: ${stats.money}
    Colonists: ${stats.population}
    Science: ${stats.science}
    Modules Built: ${JSON.stringify(counts)}
  `;

  const prompt = `You are the Central AI (LUNA-9000). Generate a mission. Prioritize industrial expansion (mining) and life-support sustainability. Use "Cyberpunk NASA" terminology (e.g., "regolith slurry", "biomass critical", "fusion yield"). Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: goalSchema,
        temperature: 0.8,
      },
    });

    if (response.text) {
      const goalData = JSON.parse(response.text) as Omit<AIGoal, 'completed'>;
      return { ...goalData, completed: false };
    }
  } catch (error) {
    handleApiError(error);
    return getFallbackGoal(stats);
  }
  return getFallbackGoal(stats);
};

// --- News Feed Generation ---

const newsSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "A one-sentence system alert or news headline." },
    type: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] },
  },
  required: ['text', 'type'],
};

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  if (Date.now() < apiCooldownUntil) {
      // Small chance to return news in fallback mode to avoid spamming UI
      return Math.random() > 0.5 ? getFallbackNews() : null;
  }

  const context = `Base Stats - Crew: ${stats.population}, Credits: ${stats.money}, Sol: ${stats.day}. ${recentAction ? `Recent Action: ${recentAction}` : ''}`;
  const prompt = "Generate a short, atmospheric sci-fi news headline for a cyberpunk lunar colony. Topics: He3 extraction yields, algae bloom efficiency, hull pressure variances, corporate transmissions, android maintenance.";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: newsSchema,
        temperature: 1.0, 
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: Date.now().toString() + Math.random(),
        text: data.text,
        type: data.type,
      };
    }
  } catch (error) {
    handleApiError(error);
    return getFallbackNews();
  }
  return null;
};
