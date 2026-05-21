"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense, useMemo } from "react";

const CITY_LIGHTS = [
  [0.0,  0.3],  // Delhi
  [0.18, 0.55], // Kolkata
  [-0.25, 0.25],// Mumbai
  [-0.05, 0.6], // Dhaka area
  [0.08, 0.55], // Patna
  [-0.1, 0.0],  // Hyderabad
  [-0.18, -0.15],// Bangalore
  [-0.05, -0.1],// Chennai
  [0.28, 0.45], // Guwahati (Assam)
  [-0.3, 0.4],  // Ahmedabad
  [0.12, 0.15], // Bhopal
  [-0.22, 0.52],// Surat area
];

function CityDot({ pos }: { pos: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 0.7 + 0.3 * Math.sin(clock.getElapsedTime() * 1.5 + phase);
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[0.04, 8, 8]} />
      <meshBasicMaterial color="#ffe577" toneMapped={false} />
    </mesh>
  );
}

function LandMass() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.005;
    }
  });

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#0d1b3e";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "#1e3a6e";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo((i / 12) * 512, 0);
      ctx.lineTo((i / 12) * 512, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i / 12) * 512);
      ctx.lineTo(512, (i / 12) * 512);
      ctx.stroke();
    }

    const indiaShape = [
      [256, 80], [290, 90], [330, 110], [360, 140], [370, 180],
      [380, 230], [360, 270], [340, 310], [310, 340], [280, 370],
      [260, 420], [256, 450], [252, 420], [230, 370], [200, 340],
      [170, 310], [150, 270], [130, 230], [140, 180], [150, 140],
      [190, 110], [230, 90],
    ];

    ctx.beginPath();
    ctx.moveTo(indiaShape[0][0], indiaShape[0][1]);
    for (let i = 1; i < indiaShape.length; i++) {
      ctx.lineTo(indiaShape[i][0], indiaShape[i][1]);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(130, 80, 380, 450);
    grad.addColorStop(0, "#2a5c3e");
    grad.addColorStop(0.4, "#4a8c5e");
    grad.addColorStop(0.7, "#3a7050");
    grad.addColorStop(1, "#1a4530");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(100,200,130,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[3, 48, 48]} />
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function CityLights() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.005;
  });

  const positions = useMemo<[number, number, number][]>(() => {
    return CITY_LIGHTS.map(([u, v]) => {
      const phi = (0.5 - v * 0.45 - 0.05) * Math.PI;
      const theta = u * Math.PI + Math.PI * 0.5;
      const r = 3.06;
      return [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      ];
    });
  }, []);

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => (
        <CityDot key={i} pos={pos} />
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      <LandMass />
      <CityLights />
      <mesh>
        <sphereGeometry args={[3.14, 32, 32]} />
        <meshBasicMaterial color="#224488" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
      <Stars radius={160} depth={50} count={1200} factor={4} saturation={0} fade speed={0.04} />
      <Sparkles count={40} size={0.6} scale={30} color="#ffdd88" speed={0.04} />
    </>
  );
}

export default function NationScene() {
  return (
    <Canvas camera={{ position: [0, 1, 9], fov: 50 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.08} />
      <directionalLight position={[8, 4, 5]} intensity={1.0} color="#fff0d0" />
      <pointLight position={[0, 0, 6]} intensity={0.4} color="#ffe577" distance={20} />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  );
}
