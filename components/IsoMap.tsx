
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, ThreeElements, extend } from '@react-three/fiber';
import { MapControls, Stars, Float, Outlines, OrthographicCamera, useTexture, MeshReflectorMaterial } from '@react-three/drei';
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
const LunarTerrain = ({ size }: { size: number }) => {
  const geometry = useMemo(() => new THREE.PlaneGeometry(size, size, 128, 128), [size]);
  
  // Generate heightmap
  useEffect(() => {
     const pos = geometry.attributes.position;
     for(let i=0; i<pos.count; i++){
         const x = pos.getX(i);
         const y = pos.getY(i);
         // Simple crater-like noise
         let z = Math.sin(x*0.5) * Math.cos(y*0.5) * 0.2;
         z += Math.random() * 0.05; // Dust
         
         // Large crater attempt
         const dist = Math.sqrt(x*x + y*y);
         if (dist < 5) z -= (5 - dist) * 0.2;
         
         pos.setZ(i, z);
     }
     geometry.computeVertexNormals();
  }, [geometry]);

  return (
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.5, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial 
        color="#1e293b"
        roughness={0.9}
        metalness={0.1}
        flatShading={false}
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

// --- Materials ---
// "NASA Punk": Gold foil, white ceramic, dark metal, neon lights.
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

// --- Procedural Building Components ---

interface ProceduralBuildingProps {
  type: BuildingType;
  x: number;
  y: number;
  width: number;
  height: number;
}

const ProceduralBuilding = React.memo(({ type, x, y, width, height }: ProceduralBuildingProps) => {
  const seed = x * 13 + y * 7; // Simple deterministic seed
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
                    {/* Main Building */}
                    <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.8, 0.6, 0.8]} position={[0, 0.3, 0]} castShadow />
                    <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[0.3, 1.0, 0.3]} position={[-0.25, 0.5, -0.25]} />
                    
                    {/* Radar Dish */}
                    <group name="radar" position={[-0.25, 1.1, -0.25]}>
                        <mesh geometry={sphereGeo} material={materials.ceramic} scale={[0.3, 0.1, 0.3]} />
                        <mesh geometry={pipeGeo} material={materials.neonPurple} scale={[0.2, 0.4, 0.2]} position={[0, 0.1, 0]} />
                    </group>

                    {/* Antenna Array */}
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
                     {/* Core Containment */}
                     <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[1.4, 0.5, 1.4]} position={[0, 0.25, 0]} castShadow />
                     
                     {/* Glowing Torus */}
                     <group name="fusionRing" position={[0, 1.0, 0]} rotation={[Math.PI/2, 0, 0]}>
                         <mesh geometry={torusGeo} material={materials.neonOrange} scale={[1.0, 1.0, 1.0]} />
                         <mesh geometry={torusGeo} material={materials.glass} scale={[1.1, 1.1, 1.1]} opacity={0.2} transparent />
                     </group>

                     {/* Stabilizers */}
                     {[0, 1, 2, 3].map(i => (
                         <mesh key={i} geometry={boxGeo} material={materials.ceramic} scale={[0.3, 1.5, 0.3]} position={[Math.sin(i*Math.PI/2)*1, 0.75, Math.cos(i*Math.PI/2)*1]} rotation={[0, i*Math.PI/2, 0]} />
                     ))}
                     
                     {/* Central Beam */}
                     <mesh geometry={cylinderGeo} material={materials.neonOrange} scale={[0.2, 2.5, 0.2]} position={[0, 1, 0]} />
                 </group>
             );

          case BuildingType.Agriculture:
             return (
                <group>
                   <mesh geometry={boxGeo} material={materials.ceramic} scale={[0.9, 0.4, 0.9]} position={[0, 0.2, 0]} castShadow />
                   <mesh geometry={boxGeo} material={materials.glass} scale={[0.8, 0.6, 0.8]} position={[0, 0.7, 0]} />
                   {[0, 1, 2].map(i => (
                       <group key={i} position={[0, 0.5 + i*0.15, 0]}>
                          <mesh geometry={boxGeo} material={materials.biomass} scale={[0.7, 0.05, 0.7]} />
                          <mesh geometry={boxGeo} material={materials.neonPurple} scale={[0.7, 0.02, 0.05]} position={[0, 0.08, 0]} />
                       </group>
                   ))}
                   <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[0.1, 0.5, 0.1]} position={[0.3, 1, 0.3]} />
                   <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[0.1, 0.3, 0.1]} position={[-0.3, 1, -0.3]} />
                </group>
             );

          case BuildingType.Park:
            return (
              <group>
                 <mesh geometry={cylinderGeo} material={materials.darkMetal} scale={[1.9, 0.2, 1.9]} position={[0, 0.1, 0]} castShadow />
                 <mesh geometry={domeGeo} material={materials.glass} scale={[1.7, 1.4, 1.7]} position={[0, 0.1, 0]} />
                 {[0, 1, 2, 3].map(i => (
                    <mesh key={i} geometry={boxGeo} material={materials.darkMetal} scale={[0.1, 1.4, 0.1]} position={[Math.sin(i*Math.PI/2)*1.6, 0.6, Math.cos(i*Math.PI/2)*1.6]} rotation={[0,0, Math.sin(i*Math.PI/2) * 0.5]} />
                 ))}
                 <group position={[0, 0.1, 0]}>
                    <mesh geometry={cylinderGeo} material={materials.biomass} scale={[0.4, 1.2, 0.4]} position={[0, 0.6, 0]} />
                    <mesh geometry={sphereGeo} material={materials.biomass} scale={[0.9, 0.6, 0.9]} position={[0, 1.2, 0]} />
                    <mesh geometry={sphereGeo} material={materials.neonGreen} scale={[0.2, 0.2, 0.2]} position={[0.5, 1.0, 0.5]} />
                    <mesh geometry={sphereGeo} material={materials.neonGreen} scale={[0.2, 0.2, 0.2]} position={[-0.4, 1.3, -0.2]} />
                 </group>
                 <mesh geometry={cylinderGeo} material={materials.neonCyan} scale={[1.2, 0.05, 1.2]} position={[0, 0.21, 0]} />
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
            group.current.position.y = -0.25 + Math.sin(state.clock.elapsedTime * 10) * 0.02;
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
           if (grid[y][x].buildingType !== BuildingType.None) {
               const [wx, _, wz] = [x - mapSize/2 + 0.5, 0, y - mapSize/2 + 0.5];
               arr.push(<Droid key={i} position={[wx + (Math.random()-0.5)*0.5, 0, wz + (Math.random()-0.5)*0.5]} />);
           }
       }
       return arr;
   }, [population, grid, mapSize]);

   return <group>{droids}</group>;
});

// --- Main Map ---

const gridToWorld = (x: number, y: number, mapSize: number) => [x - mapSize / 2 + 0.5, 0, y - mapSize / 2 + 0.5] as [number, number, number];

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
  const previewPos = hoveredTile ? gridToWorld(hoveredTile.x, hoveredTile.y, mapSize) : [0,0,0];
  
  const previewOffsetX = (toolConfig.width - 1) / 2;
  const previewOffsetZ = (toolConfig.height - 1) / 2;

  let isValid = false;
  if (hoveredTile) {
    isValid = true;
    if (hoveredTool !== BuildingType.None) {
        if (hoveredTile.x + toolConfig.width > mapSize || hoveredTile.y + toolConfig.height > mapSize) isValid = false;
        else {
            for(let i=0; i<toolConfig.width; i++) {
                for(let j=0; j<toolConfig.height; j++) {
                    if (grid[hoveredTile.y + j][hoveredTile.x + i].buildingType !== BuildingType.None) isValid = false;
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
          <LunarTerrain size={mapSize + 10} />
          
          {grid.map((row, y) =>
            row.map((tile, x) => {
              const [wx, _, wz] = gridToWorld(x, y, mapSize);
              const isOwner = (tile.ownerX === x && tile.ownerY === y) || (tile.ownerX === undefined && tile.buildingType !== BuildingType.None);

              return (
                <React.Fragment key={`${x}-${y}`}>
                    <mesh 
                        position={[wx, -0.25, wz]} 
                        rotation={[-Math.PI/2, 0, 0]}
                        onPointerEnter={(e) => { e.stopPropagation(); handleHover(x, y); }}
                        onPointerDown={(e) => { e.stopPropagation(); onTileClick(x, y); }}
                    >
                        <planeGeometry args={[1, 1]} />
                        <meshBasicMaterial transparent opacity={0} />
                        <Outlines thickness={0.01} color="#334155" />
                    </mesh>

                    {isOwner && tile.buildingType !== BuildingType.None && tile.buildingType !== BuildingType.Road && (
                         <group position={[wx, -0.3, wz]}>
                             <ProceduralBuilding 
                                type={tile.buildingType} 
                                x={x} y={y} 
                                width={BUILDINGS[tile.buildingType].width} 
                                height={BUILDINGS[tile.buildingType].height} 
                             />
                         </group>
                    )}

                    {tile.buildingType === BuildingType.Road && (
                         <group position={[wx, -0.28, wz]}>
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
             <group position={[previewPos[0], 0, previewPos[2]]}>
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
                                <ProceduralBuilding type={hoveredTool} x={hoveredTile.x} y={hoveredTile.y} width={toolConfig.width} height={toolConfig.height} />
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
