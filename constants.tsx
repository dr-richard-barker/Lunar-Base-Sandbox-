/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { BuildingConfig, BuildingType } from './types';

// Map Settings
export const GRID_SIZE = 15;

// Game Settings
export const TICK_RATE_MS = 2000; // Game loop updates every 2 seconds
export const INITIAL_MONEY = 2000; // Slightly higher starting money for space tech

export const BUILDINGS: Record<BuildingType, BuildingConfig> = {
  [BuildingType.None]: {
    type: BuildingType.None,
    cost: 0,
    name: 'Recycle',
    description: 'Clear module',
    color: '#ef4444', // Used for UI
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Road]: {
    type: BuildingType.Road,
    cost: 15,
    name: 'Corridor',
    description: 'Connects modules.',
    color: '#4b5563', // gray-600
    popGen: 0,
    incomeGen: 0,
  },
  [BuildingType.Residential]: {
    type: BuildingType.Residential,
    cost: 150,
    name: 'Habitation',
    description: '+5 Crew/sol',
    color: '#e5e7eb', // gray-200 (White/Silver)
    popGen: 5,
    incomeGen: 0,
  },
  [BuildingType.Commercial]: {
    type: BuildingType.Commercial,
    cost: 300,
    name: 'Comms Hub',
    description: '+15 Credits/sol',
    color: '#3b82f6', // blue-500
    popGen: 0,
    incomeGen: 15,
  },
  [BuildingType.Industrial]: {
    type: BuildingType.Industrial,
    cost: 500,
    name: 'Reactor',
    description: '+40 Credits/sol',
    color: '#f59e0b', // amber-500
    popGen: 0,
    incomeGen: 40,
  },
  [BuildingType.Park]: {
    type: BuildingType.Park,
    cost: 100,
    name: 'Bio-Dome',
    description: 'Oxygen & Sanity.',
    color: '#10b981', // emerald-500
    popGen: 1,
    incomeGen: 0,
  },
};