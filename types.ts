
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export enum BuildingType {
  None = 'None',
  Road = 'Road',
  Residential = 'Residential',
  Commercial = 'Commercial',
  Industrial = 'Industrial',
  Agriculture = 'Agriculture',
  Park = 'Park',
  SolarPanel = 'SolarPanel',
  FusionReactor = 'FusionReactor',
  ResearchLab = 'ResearchLab',
}

export interface BuildingConfig {
  type: BuildingType;
  cost: number;
  name: string;
  description: string;
  color: string;
  popGen: number;
  incomeGen: number;
  powerGen: number;   // Positive for production, negative for consumption
  scienceGen: number;
  width: number;
  height: number;
}

export interface TileData {
  x: number;
  y: number;
  buildingType: BuildingType;
  ownerX?: number;
  ownerY?: number;
  variant?: number;
}

export type Grid = TileData[][];

export interface CityStats {
  money: number;
  population: number;
  day: number;
  science: number;
  powerSupply: number;
  powerDemand: number;
}

export interface TechNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  unlocks: BuildingType[];
  prerequisites: string[]; // IDs of required techs
}

export interface AIGoal {
  description: string;
  targetType: 'population' | 'money' | 'building_count' | 'science';
  targetValue: number;
  buildingType?: BuildingType;
  reward: number;
  completed: boolean;
}

export interface NewsItem {
  id: string;
  text: string;
  type: 'positive' | 'negative' | 'neutral';
}
