"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense } from "react";
import LocationPrompt from "../_components/LocationPrompt";

function Globe() {
  const texture = useLoader(THREE.TextureLoader, "/Textures/2k_earth.jpg");
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.04;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[3, 64, 64]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.0} />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[3.2, 32, 32]} />
      <meshBasicMaterial color="#3366cc" transparent opacity={0.07} side={THREE.BackSide} />
    </mesh>
  );
}

function GlobeScene() {
  return (
    <>
      <Globe />
      <Atmosphere />
      <Stars radius={160} depth={60} count={1500} factor={4} saturation={0} fade speed={0.04} />
    </>
  );
}

interface Props {
  onLocationConfirmed: (
    country: string,
    countryName: string,
    coords: { lat: number; lng: number } | null
  ) => void;
}

export default function EarthScene({ onLocationConfirmed }: Props) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 1.5, 9], fov: 50 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        }}
      >
        <ambientLight intensity={0.18} />
        <directionalLight position={[10, 5, 5]} intensity={1.3} color="#fff8e0" />
        <Suspense fallback={null}>
          <GlobeScene />
        </Suspense>
      </Canvas>

      <LocationPrompt onConfirm={onLocationConfirmed} />
    </div>
  );
}
