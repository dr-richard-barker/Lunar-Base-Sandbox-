/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { MapControls, Stars, Float, Outlines, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType } from '../types';
import { GRID_SIZE, BUILDINGS } from '../constants';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {
      [elemName: string]: any;
    }
  }
}

// --- Constants & Helpers ---
const WORLD_OFFSET = GRID_SIZE / 2 - 0.5;
const gridToWorld = (x: number, y: number) => [x - WORLD_OFFSET, 0, y - WORLD_OFFSET] as [number, number, number];

// Deterministic random based on coordinates
const getHash = (x: number, y: number) => Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
const getRandomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Shared Geometries
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
const coneGeo = new THREE.ConeGeometry(1, 1, 4);
const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
const domeGeo = new THREE.SphereGeometry(1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const hexGeo = new THREE.CylinderGeometry(1, 1, 1, 6);

// --- 1. Advanced Procedural Buildings (Lunar Edition) ---

const WindowBlock = React.memo(({ position, scale, color="#3b82f6" }: { position: [number, number, number], scale: [number, number, number], color?: string }) => (
  <mesh geometry={boxGeo} position={position} scale={scale}>
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.2} metalness={0.8} />
  </mesh>
));

// Floating particles for Industrial zones
const Particles = ({ position, color }: { position: [number, number, number], color: string }) => {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    if(group.current) {
      group.current.rotation.y += 0.01;
      group.current.position.y = position[1] + Math.sin(state.clock.elapsedTime) * 0.1;
    }
  });
  return (
    <group ref={group} position={position}>
      {[0,1,2].map(i => (
        <mesh key={i} position={[Math.sin(i*2)*0.3, i*0.2, Math.cos(i*2)*0.3]} scale={0.08}>
          <sphereGeometry />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

interface BuildingMeshProps {
  type: BuildingType;
  baseColor: string;
  x: number;
  y: number;
  opacity?: number;
  transparent?: boolean;
}

const ProceduralBuilding = React.memo(({ type, baseColor, x, y, opacity = 1, transparent = false }: BuildingMeshProps) => {
  const hash = getHash(x, y);
  const variant = Math.floor(hash * 100); // 0-99
  const rotation = Math.floor(hash * 4) * (Math.PI / 2);
  
  // Space-y Color Palette Adjustment
  const color = useMemo(() => {
    const c = new THREE.Color(baseColor);
    // Desaturate and cool down for space vibe
    c.offsetHSL(0, -0.2, 0);
    return c;
  }, [baseColor]);

  const mainMat = useMemo(() => new THREE.MeshStandardMaterial({ color, flatShading: true, opacity, transparent, roughness: 0.4, metalness: 0.6 }), [color, opacity, transparent]);
  const accentMat = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), flatShading: true, opacity, transparent, metalness: 0.8 }), [color, opacity, transparent]);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a5f3fc', opacity: 0.3, transparent: true, metalness: 0.9, roughness: 0 }), []);
  
  const commonProps = { castShadow: true, receiveShadow: true };
  const yOffset = -0.3;

  return (
    <group rotation={[0, rotation, 0]} position={[0, yOffset, 0]}>
      {(() => {
        switch (type) {
          case BuildingType.Residential:
            // Habitation Domes & Modules
            if (variant < 40) {
              // Large Dome
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={domeGeo} position={[0, 0, 0]} scale={[0.4, 0.4, 0.4]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0, -0.1, 0]} scale={[0.42, 0.2, 0.42]} />
                  <WindowBlock position={[0, 0.2, 0.3]} scale={[0.1, 0.1, 0.05]} color="#60a5fa" />
                </>
              );
            } else if (variant < 70) {
              // Hexagonal Cluster
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={hexGeo} position={[0, 0.15, 0]} scale={[0.25, 0.3, 0.25]} />
                  <mesh {...commonProps} material={mainMat} geometry={hexGeo} position={[0.25, 0.1, 0.15]} scale={[0.2, 0.2, 0.2]} />
                  <mesh {...commonProps} material={mainMat} geometry={hexGeo} position={[-0.2, 0.1, -0.1]} scale={[0.2, 0.2, 0.2]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0, 0.3, 0]} scale={[0.05, 0.2, 0.05]} />
                </>
              );
            } else {
               // Stacked Pods
               return (
                 <>
                    <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.15, 0]} scale={[0.6, 0.3, 0.4]} />
                    <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.45, 0]} scale={[0.4, 0.3, 0.4]} rotation={[0, Math.PI/4, 0]} />
                    <WindowBlock position={[0, 0.15, 0.21]} scale={[0.4, 0.1, 0.05]} />
                 </>
               )
            }

          case BuildingType.Commercial:
            // Comms / Trade / Research
            return (
              <>
                <mesh {...commonProps} material={mainMat} geometry={cylinderGeo} position={[0, 0.3, 0]} scale={[0.3, 0.6, 0.3]} />
                <mesh {...commonProps} material={accentMat} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.7, 0.2, 0.7]} />
                {/* Dish */}
                <group position={[0, 0.7, 0]} rotation={[Math.PI/4, Math.PI/4, 0]}>
                    <mesh material={accentMat} geometry={sphereGeo} scale={[0.3, 0.05, 0.3]} />
                    <mesh material={new THREE.MeshBasicMaterial({color: '#ef4444'})} geometry={boxGeo} position={[0,0.1,0]} scale={[0.05, 0.2, 0.05]} />
                </group>
                <WindowBlock position={[0, 0.3, 0.16]} scale={[0.1, 0.4, 0.02]} color="#fbbf24" />
              </>
            );

          case BuildingType.Industrial:
            // Reactor / Mining
            if (variant < 50) {
              // Reactor
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={sphereGeo} position={[0, 0.3, 0]} scale={[0.4, 0.4, 0.4]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[-0.3, 0.3, -0.3]} scale={[0.1, 0.6, 0.1]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0.3, 0.3, -0.3]} scale={[0.1, 0.6, 0.1]} />
                  <Particles position={[0, 0.8, 0]} color="#f59e0b" />
                </>
              );
            } else {
              // Solar Array
              return (
                <>
                  <mesh {...commonProps} material={mainMat} geometry={boxGeo} position={[0, 0.1, 0]} scale={[0.5, 0.2, 0.5]} />
                  <mesh {...commonProps} material={accentMat} geometry={cylinderGeo} position={[0, 0.3, 0]} scale={[0.1, 0.4, 0.1]} />
                  <mesh {...commonProps} material={new THREE.MeshStandardMaterial({color: '#1e3a8a', metalness: 1, roughness: 0.2})} geometry={boxGeo} position={[0, 0.6, 0]} scale={[0.8, 0.05, 0.8]} rotation={[Math.PI/4, 0, 0]} />
                </>
              );
            }

          case BuildingType.Park:
            // Bio-Dome
            return (
              <group position={[0, -yOffset - 0.29, 0]}>
                <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                    <circleGeometry args={[0.45, 32]} />
                    <meshStandardMaterial color="#374151" />
                </mesh>
                
                {/* Plants inside */}
                <group position={[0, 0, 0]}>
                   <mesh geometry={coneGeo} material={new THREE.MeshStandardMaterial({color: '#15803d'})} position={[0.1, 0.2, 0.1]} scale={[0.15, 0.3, 0.15]} />
                   <mesh geometry={coneGeo} material={new THREE.MeshStandardMaterial({color: '#16a34a'})} position={[-0.1, 0.15, -0.1]} scale={[0.1, 0.2, 0.1]} />
                   <mesh geometry={sphereGeo} material={new THREE.MeshStandardMaterial({color: '#4ade80'})} position={[-0.2, 0.1, 0.2]} scale={0.1} />
                </group>

                {/* Glass Dome */}
                <mesh material={glassMat} geometry={domeGeo} position={[0, 0, 0]} scale={[0.4, 0.4, 0.4]} />
              </group>
            );
          case BuildingType.Road:
             return null;
          default:
            return null;
        }
      })()}
    </group>
  );
});

// --- 2. Dynamic Systems (Traffic, Colonists) ---

const roverColors = ['#94a3b8', '#e2e8f0', '#64748b'];

const TrafficSystem = ({ grid }: { grid: Grid }) => {
  const roadTiles = useMemo(() => {
    const roads: {x: number, y: number}[] = [];
    grid.forEach(row => row.forEach(tile => {
      if (tile.buildingType === BuildingType.Road) roads.push({x: tile.x, y: tile.y});
    }));
    return roads;
  }, [grid]);

  const carCount = Math.min(roadTiles.length, 20);
  const carsRef = useRef<THREE.InstancedMesh>(null);
  const carsState = useRef<Float32Array>(new Float32Array(0)); 
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(() => new Float32Array(0), []);

  useEffect(() => {
    if (roadTiles.length < 2) return;
    carsState.current = new Float32Array(carCount * 6);
    const newColors = new Float32Array(carCount * 3);

    for (let i = 0; i < carCount; i++) {
      const startNode = roadTiles[Math.floor(Math.random() * roadTiles.length)];
      carsState.current[i*6 + 0] = startNode.x;
      carsState.current[i*6 + 1] = startNode.y;
      carsState.current[i*6 + 2] = startNode.x;
      carsState.current[i*6 + 3] = startNode.y;
      carsState.current[i*6 + 4] = 1; 
      carsState.current[i*6 + 5] = getRandomRange(0.005, 0.015); // Slower rovers

      const color = new THREE.Color(roverColors[Math.floor(Math.random() * roverColors.length)]);
      newColors[i*3] = color.r; newColors[i*3+1] = color.g; newColors[i*3+2] = color.b;
    }

    if (carsRef.current) {
        carsRef.current.instanceColor = new THREE.InstancedBufferAttribute(newColors, 3);
    }
  }, [roadTiles, carCount]);

  useFrame(() => {
    if (!carsRef.current || roadTiles.length < 2 || carsState.current.length === 0) return;

    for (let i = 0; i < carCount; i++) {
      const idx = i * 6;
      let curX = carsState.current[idx];
      let curY = carsState.current[idx+1];
      let tarX = carsState.current[idx+2];
      let tarY = carsState.current[idx+3];
      let progress = carsState.current[idx+4];
      const speed = carsState.current[idx+5];

      progress += speed;

      if (progress >= 1) {
        curX = tarX;
        curY = tarY;
        progress = 0;
        
        const neighbors = roadTiles.filter(t => 
          (Math.abs(t.x - curX) === 1 && t.y === curY) || 
          (Math.abs(t.y - curY) === 1 && t.x === curX)
        );

        if (neighbors.length > 0) {
            const valid = neighbors.length > 1 
                ? neighbors.filter(n => Math.abs(n.x - carsState.current[idx]) > 0.1 || Math.abs(n.y - carsState.current[idx+1]) > 0.1)
                : neighbors;
            const next = valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : neighbors[0];
            tarX = next.x; tarY = next.y;
        } else {
            const rnd = roadTiles[Math.floor(Math.random() * roadTiles.length)];
            curX = rnd.x; curY = rnd.y; tarX = rnd.x; tarY = rnd.y;
        }
      }

      carsState.current[idx] = curX;
      carsState.current[idx+1] = curY;
      carsState.current[idx+2] = tarX;
      carsState.current[idx+3] = tarY;
      carsState.current[idx+4] = progress;

      const gx = MathUtils.lerp(curX, tarX, progress);
      const gy = MathUtils.lerp(curY, tarY, progress);

      const dx = tarX - curX;
      const dy = tarY - curY;
      const angle = Math.atan2(dy, dx);
      const [wx, _, wz] = gridToWorld(gx, gy); // Center of road for rovers

      // Rover suspension bob
      const bob = Math.sin(progress * 20) * 0.02;

      dummy.position.set(wx, -0.25 + 0.1 + bob, wz);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(0.4, 0.2, 0.3); 
      
      dummy.updateMatrix();
      carsRef.current.setMatrixAt(i, dummy.matrix);
    }
    carsRef.current.instanceMatrix.needsUpdate = true;
  });

  if (roadTiles.length < 2) return null;

  return (
    <instancedMesh ref={carsRef} args={[boxGeo, undefined, carCount]} castShadow>
      <meshStandardMaterial roughness={0.7} metalness={0.5} />
    </instancedMesh>
  );
};

const PopulationSystem = ({ population, grid }: { population: number, grid: Grid }) => {
    const agentCount = Math.min(Math.floor(population / 2), 200); 
    const meshRef = useRef<THREE.InstancedMesh>(null);
    
    const walkableTiles = useMemo(() => {
        const tiles: {x: number, y: number}[] = [];
        grid.forEach(row => row.forEach(tile => {
          if (tile.buildingType === BuildingType.Road || tile.buildingType === BuildingType.Park || tile.buildingType === BuildingType.None) {
            tiles.push({x: tile.x, y: tile.y});
          }
        }));
        return tiles;
    }, [grid]);
    
    const agentsState = useRef<Float32Array>(new Float32Array(0));
    const dummy = useMemo(() => new THREE.Object3D(), []);
    
    useEffect(() => {
        if (agentCount === 0 || walkableTiles.length === 0) return;
        agentsState.current = new Float32Array(agentCount * 6);
        
        for(let i=0; i<agentCount; i++) {
            const t = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            const x = t.x + getRandomRange(-0.4, 0.4);
            const y = t.y + getRandomRange(-0.4, 0.4);

            agentsState.current[i*6+0] = x;
            agentsState.current[i*6+1] = y;
            const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
            agentsState.current[i*6+2] = tt.x + getRandomRange(-0.4, 0.4);
            agentsState.current[i*6+3] = tt.y + getRandomRange(-0.4, 0.4);
            agentsState.current[i*6+4] = getRandomRange(0.002, 0.008); // Slow moon walk
            agentsState.current[i*6+5] = Math.random() * Math.PI * 2; 
        }
    }, [agentCount, walkableTiles]);

    useFrame((state) => {
        if (!meshRef.current || agentCount === 0 || agentsState.current.length === 0) return;
        const time = state.clock.elapsedTime;

        for(let i=0; i<agentCount; i++) {
            const idx = i*6;
            let x = agentsState.current[idx];
            let y = agentsState.current[idx+1];
            let tx = agentsState.current[idx+2];
            let ty = agentsState.current[idx+3];
            const speed = agentsState.current[idx+4];
            const animOffset = agentsState.current[idx+5];

            const dx = tx - x;
            const dy = ty - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 0.1) {
                if (walkableTiles.length > 0) {
                    const tt = walkableTiles[Math.floor(Math.random() * walkableTiles.length)];
                    tx = tt.x + getRandomRange(-0.4, 0.4);
                    ty = tt.y + getRandomRange(-0.4, 0.4);
                    agentsState.current[idx+2] = tx;
                    agentsState.current[idx+3] = ty;
                }
            } else {
                x += (dx/dist) * speed;
                y += (dy/dist) * speed;
                agentsState.current[idx] = x;
                agentsState.current[idx+1] = y;
            }

            const [wx, _, wz] = gridToWorld(x, y);

            // Moon gravity bounce (slower, higher)
            const bounce = Math.abs(Math.sin(time * 3 + animOffset)) * 0.1;
            const groundY = -0.35; 

            dummy.position.set(wx, groundY + 0.1 + bounce, wz);
            dummy.rotation.set(0, -Math.atan2(dy, dx), 0);
            dummy.scale.set(0.08, 0.2, 0.08);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (agentCount === 0) return null;

    return (
        <instancedMesh ref={meshRef} args={[boxGeo, undefined, agentCount]} castShadow>
            <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.5} />
        </instancedMesh>
    )
};

// --- 3. Main Map Component ---

const RoadMarkings = React.memo(({ x, y, grid, yOffset }: { x: number; y: number; grid: Grid; yOffset: number }) => {
  const lineMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9ca3af', emissive: '#9ca3af', emissiveIntensity: 0.2 }), []);
  const lineGeo = useMemo(() => new THREE.PlaneGeometry(0.2, 0.6), []);
  
  const hasUp = y > 0 && grid[y - 1][x].buildingType === BuildingType.Road;
  const hasDown = y < GRID_SIZE - 1 && grid[y + 1][x].buildingType === BuildingType.Road;
  const hasLeft = x > 0 && grid[y][x - 1].buildingType === BuildingType.Road;
  const hasRight = x < GRID_SIZE - 1 && grid[y][x + 1].buildingType === BuildingType.Road;
  
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, yOffset, 0]}>
        {/* Center Hub */}
        <mesh position={[0,0,0]} material={new THREE.MeshStandardMaterial({color: '#1f2937'})}>
            <circleGeometry args={[0.25, 16]} />
        </mesh>
        {/* Connections */}
        {hasUp && <mesh position={[0, 0.3, -0.01]} geometry={lineGeo} material={lineMaterial} />}
        {hasDown && <mesh position={[0, -0.3, -0.01]} geometry={lineGeo} material={lineMaterial} />}
        {hasLeft && <mesh position={[-0.3, 0, -0.01]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
        {hasRight && <mesh position={[0.3, 0, -0.01]} rotation={[0, 0, Math.PI / 2]} geometry={lineGeo} material={lineMaterial} />}
    </group>
  );
});

interface GroundTileProps {
    type: BuildingType;
    x: number;
    y: number;
    grid: Grid;
    onHover: (x: number, y: number) => void;
    onLeave: () => void;
    onClick: (x: number, y: number) => void;
}

const GroundTile = React.memo(({ type, x, y, grid, onHover, onLeave, onClick }: GroundTileProps) => {
  const [wx, _, wz] = gridToWorld(x, y);
  const hash = getHash(x, y);
  
  let color = '#374151';
  let topY = -0.3; 
  let thickness = 0.5;
  let roughness = 0.9;
  
  if (type === BuildingType.None) {
    // Moon Surface
    const v = hash;
    // Variations of grey
    color = v > 0.7 ? '#4b5563' : v > 0.3 ? '#374151' : '#1f2937';
    topY = -0.3 - v * 0.05; // Crater-like unevenness
  } else if (type === BuildingType.Road) {
    color = '#111827'; // Dark path
    topY = -0.29; 
    roughness = 0.4;
  } else {
    color = '#374151'; // Foundation
    topY = -0.28;
    roughness = 0.6;
  }

  const centerY = topY - thickness/2;

  return (
    <mesh 
        position={[wx, centerY, wz]} 
        receiveShadow castShadow
        onPointerEnter={(e) => { e.stopPropagation(); onHover(x, y); }}
        onPointerOut={(e) => { e.stopPropagation(); onLeave(); }}
        onPointerDown={(e) => {
            e.stopPropagation();
            if (e.button === 0) onClick(x, y);
        }}
    >
      <boxGeometry args={[1, thickness, 1]} />
      <meshStandardMaterial color={color} flatShading roughness={roughness} />
      {type === BuildingType.Road && <RoadMarkings x={x} y={y} grid={grid} yOffset={thickness / 2 + 0.001} />}
    </mesh>
  );
});

// Selection/Hover Cursor
const Cursor = ({ x, y, color }: { x: number, y: number, color: string }) => {
  const [wx, _, wz] = gridToWorld(x, y);
  return (
    <mesh position={[wx, -0.25, wz]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} depthTest={false} />
      <Outlines thickness={0.05} color="white" />
    </mesh>
  );
};

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredTile(null);
  }, []);

  const showPreview = hoveredTile && grid[hoveredTile.y][hoveredTile.x].buildingType === BuildingType.None && hoveredTool !== BuildingType.None;
  const previewColor = showPreview ? BUILDINGS[hoveredTool].color : 'white';
  const isBulldoze = hoveredTool === BuildingType.None;
  
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y) : [0,0,0];

  return (
    <div className="absolute inset-0 bg-black touch-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true }}>
        <OrthographicCamera makeDefault zoom={45} position={[20, 20, 20]} near={-100} far={200} />
        
        <MapControls 
          enableRotate={true}
          enableZoom={true}
          minZoom={20}
          maxZoom={120}
          maxPolarAngle={Math.PI / 2.2}
          minPolarAngle={0.1}
          target={[0,-0.5,0]}
        />

        {/* Space Environment */}
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
        <ambientLight intensity={0.2} color="#818cf8" /> {/* Cool ambient light */}
        <directionalLight
          castShadow
          position={[20, 30, 10]}
          intensity={2}
          color="#f8fafc" // Harsh white sun
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-15} shadow-camera-right={15}
          shadow-camera-top={15} shadow-camera-bottom={-15}
        >
        </directionalLight>

        <group>
          {grid.map((row, y) =>
            row.map((tile, x) => {
              const [wx, _, wz] = gridToWorld(x, y);
              return (
              <React.Fragment key={`${x}-${y}`}>
                <GroundTile 
                    type={tile.buildingType} 
                    x={x} y={y} 
                    grid={grid}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    onClick={onTileClick}
                />
                <group position={[wx, 0, wz]} raycast={() => null}>
                    {tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                      <ProceduralBuilding 
                        type={tile.buildingType} 
                        baseColor={BUILDINGS[tile.buildingType].color} 
                        x={x} y={y} 
                      />
                    )}
                </group>
              </React.Fragment>
            )})
          )}

          <group raycast={() => null}>
            <TrafficSystem grid={grid} />
            <PopulationSystem population={population} grid={grid} />

            {/* Placement Preview */}
            {showPreview && hoveredTile && (
              <group position={[previewPos[0], 0, previewPos[2]]}>
                <Float speed={3} rotationIntensity={0} floatIntensity={0.1} floatingRange={[0, 0.1]}>
                  <ProceduralBuilding 
                    type={hoveredTool} 
                    baseColor={previewColor} 
                    x={hoveredTile.x} 
                    y={hoveredTile.y} 
                    transparent 
                    opacity={0.7} 
                  />
                </Float>
              </group>
            )}

            {/* Highlight */}
            {hoveredTile && (
              <Cursor 
                x={hoveredTile.x} 
                y={hoveredTile.y} 
                color={isBulldoze ? '#ef4444' : (showPreview ? '#ffffff' : '#3b82f6')} 
              />
            )}
          </group>
        </group>
      </Canvas>
    </div>
  );
};

export default IsoMap;