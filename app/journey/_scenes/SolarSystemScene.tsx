"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense } from "react";

const PLANETS = [
  { radius: 0.28, distance: 5.5, speed: 1.4, color: "#a0a0a0", tilt: 0 },
  { radius: 0.5,  distance: 8,   speed: 1.0, color: "#e8cfa0", tilt: 0.05 },
  { radius: 0.55, distance: 11,  speed: 0.7, color: "#4fa3d8", tilt: 0.08 },
  { radius: 0.3,  distance: 14,  speed: 0.5, color: "#c07040", tilt: 0.03 },
  { radius: 1.2,  distance: 20,  speed: 0.3, color: "#c8a870", tilt: 0.02 },
];

function OrbitRing({ radius }: { radius: number }) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return (
    <line geometry={geom}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.07} />
    </line>
  );
}

function Planet({ radius, distance, speed, color, tilt }: typeof PLANETS[0]) {
  const ref = useRef<THREE.Group>(null);
  const angle = useRef(Math.random() * Math.PI * 2);

  useFrame((_, delta) => {
    angle.current += speed * delta * 0.25;
    if (ref.current) {
      ref.current.position.set(
        Math.cos(angle.current) * distance,
        Math.sin(tilt * angle.current) * 0.4,
        Math.sin(angle.current) * distance
      );
      ref.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
      </mesh>
    </group>
  );
}

function Sun() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.06;
  });
  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial color="#ffe066" toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0, 0]} intensity={3} color="#fff5c0" distance={120} />
    </>
  );
}

function Scene() {
  return (
    <>
      <Sun />
      {PLANETS.map((p, i) => (
        <group key={i}>
          <OrbitRing radius={p.distance} />
          <Planet {...p} />
        </group>
      ))}
      <Stars radius={200} depth={60} count={2000} factor={5} saturation={0} fade speed={0.04} />
    </>
  );
}

export default function SolarSystemScene() {
  return (
    <Canvas camera={{ position: [0, 22, 30], fov: 55 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.06} />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
