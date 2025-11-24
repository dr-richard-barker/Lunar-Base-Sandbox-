
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements, extend } from '@react-three/fiber';
import { MapControls, Stars, Float, Outlines, OrthographicCamera, useTexture, MeshReflectorMaterial, Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { Grid, BuildingType } from '../types';
import { BUILDINGS } from '../constants';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {
      [elemName: string]: any;
    }
  }
}

// --- Terrain Material (Procedural Lunar Surface) ---
const LunarTerrain = ({ size, grid, mapSize }: { size: number, grid: Grid, mapSize: number }) => {
  const geometry = useMemo(() => new THREE.PlaneGeometry(size, size, mapSize, mapSize), [size, mapSize]);
  
  useEffect(() => {
     const pos = geometry.attributes.position;
     // Map grid height data to vertices
     // Note: Vertices are mapSize+1 x mapSize+1
     // We need to smooth or map exactly. For low poly look, we might want to construct custom geometry, 
     // but modifying plane is easier.
     
     // Reset
     for(let i=0; i<pos.count; i++){
         const x = pos.getX(i);
         const y = pos.getY(i);
         
         // Convert world pos to grid coords approximately
         // Plane is centered at 0, size=size
         const gx = Math.round((x + size/2) / (size/mapSize) * mapSize / size * (size/mapSize) - 0.5 + mapSize/2);
         const gy = Math.round((y + size/2) / (size/mapSize) * mapSize / size * (size/mapSize) - 0.5 + mapSize/2);

         let h = 0;
         // Lookup grid height
         // Boundary checks
         const safeX = Math.max(0, Math.min(mapSize-1, Math.floor((x + size/2) / size * mapSize)));
         const safeY = Math.max(0, Math.min(mapSize-1, Math.floor((y + size/2) / size * mapSize)));
         
         if (grid[safeY] && grid[safeY][safeX]) {
             h = grid[safeY][safeX].height * 0.5; // Scale height for visuals
         }
         
         // Add noise
         let z = Math.sin(x*0.5) * Math.cos(y*0.5) * 0.2;
         z += Math.random() * 0.05; 
         
         // Apply grid height
         pos.setZ(i, z + h);
     }
     geometry.computeVertexNormals();
     geometry.attributes.position.needsUpdate = true;
     geometry.computeBoundingBox();
     geometry.computeBoundingSphere();

  }, [geometry, grid, size, mapSize]);

  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.5, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial 
        color="#1e293b"
        roughness={0.9}
        metalness={0.1}
        flatShading={true}
      />
    </mesh>
  );
}

// --- Shared Geometries ---
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
const domeGeo = new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const sphereGeo = new THREE.SphereGeometry(1, 16, 16);
const torusGeo = new THREE.TorusGeometry(0.6, 0.2, 16, 32);
const treeTrunkGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.4, 6);
const treeFoliageGeo = new THREE.ConeGeometry(0.25, 0.5, 6);

// --- Materials ---
const materials = {
  ceramic: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2, metalness: 0.1 }),
  goldFoil: new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.3, metalness: 1.0, emissive: '#b45309', emissiveIntensity: 0.1 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7, metalness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.0, metalness: 0.9, opacity: 0.3, transparent: true }),
  solarBlue: new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.2, metalness: 0.5 }),
  neonCyan: new THREE.MeshStandardMaterial({ color: '#06b6d4', emissive: '#06b6d4', emissiveIntensity: 2, toneMapped: false }),
  neonRed: new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2, toneMapped: false }),
  neonGreen: new THREE.MeshStandardMaterial({ color: '#10b981', emissive: '#10b981', emissiveIntensity: 2, toneMapped: false }),
  neonPurple: new THREE.MeshStandardMaterial({ color: '#a855f7', emissive: '#a855f7', emissiveIntensity: 3, toneMapped: false }),
  neonOrange: new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#f97316', emissiveIntensity: 4, toneMapped: false }),
  biomass: new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.8, emissive: '#14532d', emissiveIntensity: 0.2 }),
  wood: new THREE.MeshStandardMaterial({ color: '#4a2c2a', roughness: 1.0 }),
  leaves: new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.8 }),
};

const Pipe = ({ start, end }: { start: [number, number, number], end: [number, number, number] }) => {
    const len = new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end));
    const mid = new THREE.Vector3(...start).add(new THREE.Vector3(...end)).multiplyScalar(0.5);
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    
    return (
        <mesh geometry={pipeGeo} position={mid.toArray()} quaternion={quaternion} scale={[1, len, 1]} material={materials.goldFoil} castShadow />
    )
}

const Tree: React.FC<{ position: [number, number, number], scale?: number }> = ({ position, scale = 1 }) => (
    <group position={position} scale={scale}>
        <mesh geometry={treeTrunkGeo} material={materials.wood} position={[0, 0.2, 0]} castShadow />
        <mesh geometry={treeFoliageGeo} material={materials.leaves} position={[0, 0.5, 0]} castShadow />
        <mesh geometry={treeFoliageGeo} material={materials.leaves} position={[0, 0.8, 0]} scale={[0.8, 0.8, 0.8]} castShadow />
    </group>
);

// --- Procedural Building Components ---

interface ProceduralBuildingProps {
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
  variant: number;
}

const ProceduralBuilding = React.memo(({ type, x, y, width, height, variant }: ProceduralBuildingProps) => {
  const seed = x * 13 + y * 7 + variant; 
  const offsetX = (width - 1) / 2;
  const offsetZ = (height - 1) / 2;
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
     if (groupRef.current) {
        if (type === BuildingType.Industrial) {
             const drill = groupRef.current.getObjectByName('drill');
             if (drill) drill.rotation.y += 0.1;
        }
        if (type === BuildingType.FusionReactor) {
            const ring = groupRef.current.getObjectByName('fusionRing');
            if (ring) {
                ring.rotation.z += 0.02;
                ring.rotation.x += 0.01;
            }
        }
        if (type === BuildingType.ResearchLab) {
             const dish = groupRef.current.getObjectByName('radar');
             if (dish) {
                 dish.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.5;
                 dish.rotation.x = -0.5 + Math.cos(state.clock.elapsedTime * 0.3) * 0.2;
             }
        }
        if (type === BuildingType.Agriculture) {
            // Pulse grow lights
            const lights = groupRef.current.getObjectByName('growLights');
            if (lights) {
                lights.visible = Math.sin(state.clock.elapsedTime * 5) > 0;
            }
        }
     }
  });

  return (
    <group position={[offsetX, 0, offsetZ]} ref={groupRef}>
      {(() => {
        switch (type) {
          case BuildingType.SolarPanel:
            return (
                <group>
                    <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[0.1, 0.5, 0.1]} position={[0, 0.25, 0]} />
                    <mesh geometry={boxGeo} material={materials.solarBlue} scale={[0.9, 0.05, 0.9]} position={[0, 0.5, 0]} rotation={[0.2, 0, 0]} castShadow />
                    <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.95, 0.02, 0.95]} position={[0, 0.48, 0]} rotation={[0.2, 0, 0]} />
                </group>
            );

          case BuildingType.Residential:
            return (
              <group>
                <mesh geometry={cylinderGeo} material={materials.ceramic} scale={[0.3, 1.5, 0.3]} position={[0, 0.75, 0]} castShadow receiveShadow />
                {[0, 1, 2].map(i => (
                  <group key={i} rotation={[0, (seed + i) * 2, 0]} position={[0, 0.3 + i * 0.4, 0]}>
                     <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.8, 0.25, 0.4]} position={[0.3, 0, 0]} castShadow />
                     <mesh geometry={boxGeo} material={materials.darkMetal} scale={[0.7, 0.05, 0.3]} position={[0.3, -0.15, 0]} />
                     <mesh geometry={boxGeo} material={materials.neonCyan} scale={[0.1, 0.1, 0.05]} position={[0.6, 0, 0.2]} />
                  </group>
                ))}
                <mesh geometry={pipeGeo} material={materials.darkMetal} scale={[0.2, 0.8, 0.2]} position={[0, 1.6, 0]} />
                <mesh geometry={boxGeo} material={materials.neonRed} scale={[0.05, 0.05, 0.05]} position={[0, 2, 0]} />
              </group>
            );

          case BuildingType.Commercial:
            return (
              <group>
                 <mesh geometry={boxGeo} material={materials.darkMetal} scale={[0.8, 1.2, 0.8]} position={[0, 0.6, 0]} castShadow />
                 <mesh geometry={boxGeo} material={materials.goldFoil} scale={[0.9, 0.1, 0.9]} position={[0, 0.2, 0]} />
                 <mesh geometry={boxGeo} material={materials.goldFoil} scale={[0.9, 0.1, 0.9]} position={[0, 0.6, 0]} />
                 <mesh geometry={boxGeo} material={materials.goldFoil} scale={[0.9, 0.1, 0.9]} position={[0, 1.0, 0]} />
                 <mesh geometry={boxGeo} material={materials.neonCyan} scale={[0.6, 0.8, 0.05]} position={[0, 0.6, 0.4]} />
                 <mesh geometry={domeGeo} material={materials.ceramic} scale={[0.4, 0.2, 0.4]} position={[0, 1.2, 0]} rotation={[Math.PI, 0, 0]} />
              </group>
            );

          case BuildingType.ResearchLab:
             return (
                <group>
                    <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.8, 0.6, 0.8]} position={[0, 0.3, 0]} castShadow />
                    <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[0.3, 1.0, 0.3]} position={[-0.25, 0.5, -0.25]} />
                    
                    <group name="radar" position={[-0.25, 1.1, -0.25]}>
                        <mesh geometry={sphereGeo} material={materials.ceramic} scale={[0.3, 0.1, 0.3]} />
                        <mesh geometry={pipeGeo} material={materials.neonPurple} scale={[0.2, 0.4, 0.2]} position={[0, 0.1, 0]} />
                    </group>

                    <mesh geometry={pipeGeo} material={materials.goldFoil} scale={[0.1, 1, 0.1]} position={[0.3, 0.8, 0.3]} />
                    <mesh geometry={boxGeo} material={materials.neonPurple} scale={[0.05, 0.05, 0.05]} position={[0.3, 1.3, 0.3]} />
                </group>
             );

          case BuildingType.Industrial:
            return (
              <group>
                 <mesh geometry={boxGeo} material={materials.darkMetal} scale={[1.8, 0.2, 1.8]} position={[0, 0.1, 0]} castShadow />
                 <group position={[-0.5, 0, -0.5]}>
                    <mesh geometry={cylinderGeo} material={materials.goldFoil} scale={[0.4, 2, 0.4]} position={[0, 1, 0]} castShadow />
                    <mesh name="drill" geometry={cylinderGeo} material={materials.darkMetal} scale={[0.3, 2.5, 0.3]} position={[0, 0, 0]} />
                 </group>
                 <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.6, 0.8, 0.6]} position={[0.5, 0.4, 0.5]} castShadow />
                 <mesh geometry={sphereGeo} material={materials.goldFoil} scale={[0.3, 0.3, 0.3]} position={[0.5, 0.9, 0.5]} />
                 <Pipe start={[-0.5, 1.5, -0.5]} end={[0.5, 0.8, 0.5]} />
                 <mesh geometry={boxGeo} material={materials.neonRed} scale={[0.1, 0.1, 0.1]} position={[-0.5, 2, -0.5]} />
              </group>
            );

          case BuildingType.FusionReactor:
             return (
                 <group>
                     <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[1.4, 0.5, 1.4]} position={[0, 0.25, 0]} castShadow />
                     
                     <group name="fusionRing" position={[0, 1.0, 0]} rotation={[Math.PI/2, 0, 0]}>
                         <mesh geometry={torusGeo} material={materials.neonOrange} scale={[1.0, 1.0, 1.0]} />
                         <mesh geometry={torusGeo} material={materials.glass} scale={[1.1, 1.1, 1.1]} opacity={0.2} transparent />
                     </group>

                     {[0, 1, 2, 3].map(i => (
                         <mesh key={i} geometry={boxGeo} material={materials.ceramic} scale={[0.3, 1.5, 0.3]} position={[Math.sin(i*Math.PI/2)*1, 0.75, Math.cos(i*Math.PI/2)*1]} rotation={[0, i*Math.PI/2, 0]} />
                     ))}
                     
                     <mesh geometry={cylinderGeo} material={materials.neonOrange} scale={[0.2, 2.5, 0.2]} position={[0, 1, 0]} />
                 </group>
             );

          case BuildingType.Agriculture:
             return (
                <group>
                   {/* Base Platform */}
                   <mesh geometry={boxGeo} material={materials.darkMetal} scale={[0.9, 0.2, 0.9]} position={[0, 0.1, 0]} castShadow />
                   
                   {/* Glass Greenhouse */}
                   <mesh geometry={boxGeo} material={materials.glass} scale={[0.85, 0.8, 0.85]} position={[0, 0.6, 0]} />
                   
                   {/* Internal Racks */}
                   <group position={[0, 0.2, 0]}>
                       {[0, 1, 2].map(i => (
                           <group key={i} position={[0, i*0.25, 0]}>
                              {/* Shelf */}
                              <mesh geometry={boxGeo} material={materials.darkMetal} scale={[0.7, 0.02, 0.7]} />
                              {/* Plants */}
                              <mesh geometry={boxGeo} material={materials.biomass} scale={[0.6, 0.1, 0.6]} position={[0, 0.06, 0]} />
                              {/* Grow Lights */}
                              <mesh name="growLights" geometry={boxGeo} material={materials.neonPurple} scale={[0.7, 0.02, 0.05]} position={[0, 0.2, 0]} />
                              <mesh name="growLights" geometry={boxGeo} material={materials.neonPurple} scale={[0.05, 0.02, 0.7]} position={[0, 0.2, 0]} />
                           </group>
                       ))}
                   </group>

                   {/* External Pipes/Tanks */}
                   <mesh geometry={cylinderGeo} material={materials.ceramic} scale={[0.15, 0.8, 0.15]} position={[0.4, 0.4, 0.4]} />
                   <mesh geometry={sphereGeo} material={materials.ceramic} scale={[0.2, 0.2, 0.2]} position={[0.4, 0.9, 0.4]} />
                   
                   <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[0.1, 0.6, 0.1]} position={[-0.4, 0.3, -0.4]} />
                </group>
             );

          case BuildingType.Park:
            // Exo-Biome variants
            const treeCount = 3 + (variant % 3);
            return (
              <group>
                 {/* Base */}
                 <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[1.9, 0.2, 1.9]} position={[0, 0.1, 0]} castShadow />
                 
                 {/* Large Dome */}
                 <mesh geometry={domeGeo} material={materials.glass} scale={[1.8, 1.5, 1.8]} position={[0, 0.1, 0]} />
                 
                 {/* Structural Ribs */}
                 {[0, 1, 2, 3].map(i => (
                    <mesh key={i} geometry={boxGeo} material={materials.darkMetal} scale={[0.05, 1.6, 0.05]} position={[Math.sin(i*Math.PI/2)*1.7, 0.6, Math.cos(i*Math.PI/2)*1.7]} rotation={[0,0, Math.sin(i*Math.PI/2) * 0.4]} />
                 ))}

                 {/* Interior Nature */}
                 <group position={[0, 0.1, 0]}>
                    <mesh geometry={cylinderGeo} material={materials.biomass} scale={[1.7, 0.1, 1.7]} position={[0, 0.05, 0]} />
                    
                    {/* Trees */}
                    {Array.from({length: treeCount}).map((_, i) => {
                        const angle = (i / treeCount) * Math.PI * 2 + seed;
                        const dist = 0.3 + (seed % 0.5);
                        return <Tree key={i} position={[Math.cos(angle)*dist, 0, Math.sin(angle)*dist]} scale={0.6 + Math.random()*0.4} />
                    })}
                    
                    {/* Central Water/Feature */}
                    {variant % 2 === 0 ? (
                        <mesh geometry={cylinderGeo} material={materials.neonCyan} scale={[0.5, 0.05, 0.5]} position={[0, 0.06, 0]} />
                    ) : (
                        <mesh geometry={sphereGeo} material={materials.neonGreen} scale={[0.3, 0.3, 0.3]} position={[0, 0.2, 0]} />
                    )}
                 </group>
              </group>
            );
          
          default: return null;
        }
      })()}
    </group>
  );
});


// --- Droids & Traffic ---

const Droid: React.FC<{ position: [number, number, number] }> = ({ position }) => {
    const group = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(group.current) {
            group.current.position.y = position[1] + 0.25 + Math.sin(state.clock.elapsedTime * 10) * 0.02;
        }
    })
    return (
        <group ref={group} position={position} scale={0.3}>
            <mesh geometry={cylinderGeo} material={materials.ceramic} scale={[0.5, 0.6, 0.5]} position={[0, 0.3, 0]} castShadow />
            <mesh geometry={domeGeo} material={materials.darkMetal} scale={[0.5, 0.5, 0.5]} position={[0, 0.6, 0]} />
            <mesh geometry={boxGeo} material={materials.neonCyan} scale={[0.1, 0.1, 0.1]} position={[0, 0.7, 0.2]} />
            <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.2, 0.7, 0.3]} position={[-0.35, 0.3, 0]} />
            <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.2, 0.7, 0.3]} position={[0.35, 0.3, 0]} />
        </group>
    )
}

const PopulationSystem = React.memo(({ population, grid, mapSize }: { population: number, grid: Grid, mapSize: number }) => {
   const droids = useMemo(() => {
       const arr = [];
       const count = Math.min(population / 5, 30);
       for(let i=0; i<count; i++) {
           const x = Math.floor(Math.random() * mapSize);
           const y = Math.floor(Math.random() * mapSize);
           if (grid[y] && grid[y][x] && grid[y][x].buildingType !== BuildingType.None) {
               const tile = grid[y][x];
               const [wx, _, wz] = [x - mapSize/2 + 0.5, 0, y - mapSize/2 + 0.5];
               const h = tile.height * 0.5;
               arr.push(<Droid key={i} position={[wx + (Math.random()-0.5)*0.5, h, wz + (Math.random()-0.5)*0.5]} />);
           }
       }
       return arr;
   }, [population, grid, mapSize]);

   return <group>{droids}</group>;
});

// --- Main Map ---

const gridToWorld = (x: number, y: number, mapSize: number, height: number = 0) => [x - mapSize / 2 + 0.5, height * 0.5, y - mapSize / 2 + 0.5] as [number, number, number];

interface IsoMapProps {
  grid: Grid;
  onTileClick: (x: number, y: number) => void;
  hoveredTool: BuildingType;
  population: number;
  mapSize: number;
}

const IsoMap: React.FC<IsoMapProps> = ({ grid, onTileClick, hoveredTool, population, mapSize }) => {
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const handleHover = useCallback((x: number, y: number) => {
    setHoveredTile({ x, y });
  }, []);

  const toolConfig = BUILDINGS[hoveredTool];
  let previewHeight = 0;
  if (hoveredTile && grid[hoveredTile.y] && grid[hoveredTile.y][hoveredTile.x]) {
      previewHeight = grid[hoveredTile.y][hoveredTile.x].height;
  }
  
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y, mapSize, previewHeight) : [0,0,0];
  
  const previewOffsetX = (toolConfig.width - 1) / 2;
  const previewOffsetZ = (toolConfig.height - 1) / 2;

  let isValid = false;
  if (hoveredTile) {
    isValid = true;
    if (hoveredTool !== BuildingType.None) {
        if (hoveredTile.x + toolConfig.width > mapSize || hoveredTile.y + toolConfig.height > mapSize) isValid = false;
        else {
            // Check occupancy AND height uniformity
            const baseHeight = grid[hoveredTile.y][hoveredTile.x].height;
            for(let i=0; i<toolConfig.width; i++) {
                for(let j=0; j<toolConfig.height; j++) {
                    const tile = grid[hoveredTile.y + j][hoveredTile.x + i];
                    if (tile.buildingType !== BuildingType.None) isValid = false;
                    if (tile.height !== baseHeight) isValid = false;
                }
            }
        }
    }
  }

  return (
    <div className="absolute inset-0 bg-black touch-none">
      <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}>
        <OrthographicCamera makeDefault zoom={mapSize === 32 ? 25 : 35} position={[30, 30, 30]} near={-100} far={200} />
        <MapControls minZoom={10} maxZoom={100} maxPolarAngle={Math.PI / 2.1} target={[0,-1,0]} />

        <color attach="background" args={['#050505']} />
        <Stars radius={150} depth={50} count={8000} factor={4} saturation={0} fade speed={0.1} />
        <fog attach="fog" args={['#050505', 40, 100]} />

        <ambientLight intensity={0.1} color="#475569" />
        <directionalLight
          castShadow
          position={[50, 80, 20]}
          intensity={3}
          color="#e2e8f0"
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0001}
        >
          <orthographicCamera attach="shadow-camera" args={[-50, 50, 50, -50]} />
        </directionalLight>

        <pointLight position={[0, 10, 0]} intensity={0.5} color="#3b82f6" distance={50} decay={2} />

        <group>
          <LunarTerrain size={mapSize + 10} grid={grid} mapSize={mapSize} />
          
          {grid.map((row, y) =>
            row.map((tile, x) => {
              const [wx, wy, wz] = gridToWorld(x, y, mapSize, tile.height);
              const isOwner = (tile.ownerX === x && tile.ownerY === y) || (tile.ownerX === undefined && tile.buildingType !== BuildingType.None);

              return (
                <React.Fragment key={`${x}-${y}`}>
                    <mesh 
                        position={[wx, wy - 0.25, wz]} 
                        rotation={[-Math.PI/2, 0, 0]}
                        onPointerEnter={(e) => { e.stopPropagation(); handleHover(x, y); }}
                        onPointerDown={(e) => { e.stopPropagation(); onTileClick(x, y); }}
                    >
                        <planeGeometry args={[1, 1]} />
                        <meshBasicMaterial transparent opacity={0} />
                        <Outlines thickness={0.01} color="#334155" />
                    </mesh>

                    {isOwner && tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                         <group position={[wx, wy - 0.3, wz]}>
                             <ProceduralBuilding 
                                type={tile.buildingType} 
                                x={x} y={y} 
                                width={BUILDINGS[tile.buildingType].width} 
                                height={BUILDINGS[tile.buildingType].height}
                                variant={tile.variant || 0}
                             />
                         </group>
                    )}

                    {tile.buildingType === BuildingType.Road && (
                         <group position={[wx, wy - 0.28, wz]}>
                              <mesh receiveShadow>
                                  <boxGeometry args={[1, 0.05, 1]} />
                                  <meshStandardMaterial color="#334155" roughness={0.8} />
                              </mesh>
                         </group>
                    )}
                </React.Fragment>
              )
            })
          )}
            
          <PopulationSystem population={population} grid={grid} mapSize={mapSize} />

          {hoveredTile && (
             <group position={[previewPos[0], previewPos[1], previewPos[2]]}>
                 <mesh 
                    position={[previewOffsetX, -0.2, previewOffsetZ]} 
                    rotation={[-Math.PI/2, 0, 0]}
                 >
                     <planeGeometry args={[toolConfig.width, toolConfig.height]} />
                     <meshBasicMaterial color={isValid ? "#3b82f6" : "#ef4444"} transparent opacity={0.3} />
                     <Outlines thickness={0.05} color={isValid ? "#60a5fa" : "#f87171"} />
                 </mesh>

                 {hoveredTool !== BuildingType.None && isValid && (
                    <group position={[0, -0.3, 0]}>
                         <Float speed={2} rotationIntensity={0} floatIntensity={0.2}>
                            <group opacity={0.5}>
                                <ProceduralBuilding 
                                    type={hoveredTool} 
                                    x={hoveredTile.x} 
                                    y={hoveredTile.y} 
                                    width={toolConfig.width} 
                                    height={toolConfig.height}
                                    variant={0}
                                />
                            </group>
                         </Float>
                    </group>
                 )}
             </group>
          )}
        </group>
      </Canvas>
    </div>
  );
};

export default IsoMap;