// app/unified/page.tsx
"use client";

import React, { Suspense, useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Sparkles, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** CameraController now safely casts camera to PerspectiveCamera before using .fov */
function CameraController({ stage }: { stage: "universe" | "milkyway" | "solar" | "earth" }) {
  const { camera } = useThree();
  // cast to perspective camera when adjusting fov
  const pCam = camera as THREE.PerspectiveCamera;
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const presets = useMemo(
    () => ({
      universe: { pos: new THREE.Vector3(0, 0, 30), lookAt: new THREE.Vector3(0, 0, 0), fov: 60 },
      milkyway: { pos: new THREE.Vector3(0, 0, 12), lookAt: new THREE.Vector3(0, 0, -1), fov: 50 },
      solar: { pos: new THREE.Vector3(0, 0, 6), lookAt: new THREE.Vector3(0, 0, -2), fov: 40 },
      earth: { pos: new THREE.Vector3(0, 0, 1.8), lookAt: new THREE.Vector3(0, 0, 0), fov: 30 },
    }),
    []
  );

  useFrame(() => {
    const p = presets[stage];
    camera.position.lerp(p.pos, 0.06);

    // Only adjust fov on PerspectiveCamera
    if (typeof pCam.fov === "number") {
      pCam.fov += (p.fov - pCam.fov) * 0.08;
      pCam.updateProjectionMatrix();
    }

    target.current.lerp(p.lookAt, 0.06);
    camera.lookAt(target.current);
  });

  return null;
}

function GalaxyCore() {
  const ref = useRef<THREE.Group | null>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.02;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[3.0, 48, 48]} />
        <meshStandardMaterial color="#222244" emissive="#112233" roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.2]}>
        <ringGeometry args={[4.2, 8.5, 128]} />
        <meshBasicMaterial color="#00111a" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      <Sparkles count={80} scale={80} size={0.8} color="#88aaff" speed={0.05} />
    </group>
  );
}

type PlanetDef = { name: string; r: number; d: number; speed: number; color: string };

function SolarSystem({ epochRef }: { epochRef: React.MutableRefObject<number> }) {
  const planets: PlanetDef[] = [
    { name: "Mercury", r: 0.25, d: 4.0, speed: 0.06, color: "#999999" },
    { name: "Venus", r: 0.35, d: 5.6, speed: 0.04, color: "#d9b38c" },
    { name: "Earth", r: 0.38, d: 7.4, speed: 0.03, color: "#4a90e2" },
    { name: "Mars", r: 0.32, d: 9.0, speed: 0.025, color: "#d14b3a" },
    { name: "Jupiter", r: 0.95, d: 11.0, speed: 0.015, color: "#cfa16d" },
    { name: "Saturn", r: 0.85, d: 13.5, speed: 0.012, color: "#e0c79a" },
    { name: "Uranus", r: 0.6, d: 15.8, speed: 0.009, color: "#8ad6d6" },
    { name: "Neptune", r: 0.6, d: 17.8, speed: 0.007, color: "#355fbd" },
  ];

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1.6, 32, 32]} />
        <meshBasicMaterial color="#ffcc66" />
      </mesh>

      {planets.map((p, i) => (
        <mesh rotation={[Math.PI / 2, 0, 0]} key={"orbit-" + i}>
          <ringGeometry args={[p.d - 0.02, p.d + 0.02, 128]} />
          <meshBasicMaterial color="rgba(255,255,255,0.03)" side={THREE.DoubleSide} transparent />
        </mesh>
      ))}

      {planets.map((p) => (
        <Planet key={p.name} def={p} epochRef={epochRef} />
      ))}
    </group>
  );
}

function Planet({ def, epochRef }: { def: PlanetDef; epochRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame(() => {
    if (!ref.current) return;
    const epoch = epochRef.current;
    const ang = epoch * def.speed + (hashName(def.name) % (Math.PI * 2));
    ref.current.position.x = def.d * Math.cos(ang);
    ref.current.position.z = def.d * Math.sin(ang);
    ref.current.rotation.y += 0.005 + def.speed * 0.1;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[def.r, 32, 32]} />
      <meshStandardMaterial color={def.color} />
    </mesh>
  );
}

function hashName(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0) / 4294967296 * Math.PI * 2;
}

function EarthDetail() {
  const ref = useRef<THREE.Mesh | null>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.003;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[1.2, 64, 64]} />
        <meshStandardMaterial color="#2a6fb8" metalness={0.05} roughness={0.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.24, 64, 64]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

/** epochRef updated every frame by EpochTicker and consumed by SolarSystem/Planet */
function EpochTicker({ epochRef }: { epochRef: React.MutableRefObject<number> }) {
  useFrame(({ clock }) => {
    epochRef.current = clock.getElapsedTime();
  });
  return null;
}

export default function UnifiedPage(): React.ReactElement {
  const [stage, setStage] = useState<"universe" | "milkyway" | "solar" | "earth">("universe");
  const epochRef = useRef<number>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage("milkyway"), 2000);
    const t2 = setTimeout(() => setStage("solar"), 5200);
    const t3 = setTimeout(() => setStage("earth"), 8800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "black" }}>
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <pointLight position={[10, 10, 10]} intensity={1.0} />

          <Stars radius={200} depth={50} count={3000} factor={6} saturation={0} fade speed={0.2} />
          <GalaxyCore />

          {stage !== "universe" && (
            <group position={[0, 0, -0.8]}>
              <mesh>
                <sphereGeometry args={[2.2, 32, 32]} />
                <meshStandardMaterial color="#10172a" emissive="#051427" />
              </mesh>
            </group>
          )}

          <group position={[0, 0, -2]}>
            <SolarSystem epochRef={epochRef} />
          </group>

          {stage === "earth" && (
            <group position={[0, 0, -2]}>
              <EarthDetail />
            </group>
          )}

          <CameraController stage={stage} />
          <OrbitControls enableZoom enablePan={false} maxPolarAngle={Math.PI / 2} />
          <EpochTicker epochRef={epochRef} />
        </Suspense>
      </Canvas>

      <div style={{ position: "absolute", top: 18, right: 18, zIndex: 20 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setStage("universe")}>Universe</button>
          <button onClick={() => setStage("milkyway")}>MilkyWay</button>
          <button onClick={() => setStage("solar")}>Solar</button>
          <button onClick={() => setStage("earth")}>Earth</button>
        </div>
      </div>
    </div>
  );
}
