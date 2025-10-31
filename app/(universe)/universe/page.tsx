//app/universe
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Sparkles, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense } from "react";

function Galaxy() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.02;
  });

  const layerSpeeds = [0.02, -0.015, 0.01, -0.008];

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2.2, 32, 32]} />
        {/* Basic material so it's visible without fancy lighting */}
        <meshBasicMaterial color="#ffb07a" toneMapped={false} />
      </mesh>

      {[...Array(4)].map((_, i) => {
        const radius = 30 + i * 18;
        const depth = 10 + i * 6;
        const count = 400;
        return <LayeredStars key={i} radius={radius} depth={depth} count={count} factor={6 + i} speed={layerSpeeds[i]} rotationZ={(i * Math.PI) / 6} />;
      })}

      {/* background stars */}
      <Stars radius={160} depth={80} count={2000} factor={6} saturation={0} fade={true} speed={0.08} />
      <Sparkles count={120} size={1.2} scale={60} color="#88aaff" speed={0.08} />
    </group>
  );
}

function LayeredStars({ radius, depth, count, factor, speed, rotationZ }: any) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = rotationZ + clock.getElapsedTime() * speed;
  });
  return (
    <group ref={ref}>
      <Stars radius={radius} depth={depth} count={count} factor={factor} saturation={0} fade={true} speed={0.2} />
    </group>
  );
}

export default function UniversePage() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000000", touchAction: "manipulation" }}>
      {/* Canvas */}
      <Canvas camera={{ position: [0, 0, 80], fov: 60 }} gl={{ antialias: true }}>
        <ambientLight intensity={0.18} />
        <pointLight position={[10, 10, 10]} intensity={1.0} />

        <Suspense fallback={null}>
          <Galaxy />
        </Suspense>

        <OrbitControls enableZoom enablePan={false} minDistance={20} maxDistance={200} autoRotate autoRotateSpeed={0.16} />
      </Canvas>

      {/* HTML overlay title (no remote fonts, no drei Text) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 20,
          pointerEvents: "none", // so mouse controls still hit canvas
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "#eaf2ff",
            fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
            textShadow: "0 2px 20px rgba(0,0,0,0.9)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 1.2 }}>Cosmic Explorer</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>Science • Spirituality • Simulation</div>
        </div>
      </div>
    </div>
  );
}
