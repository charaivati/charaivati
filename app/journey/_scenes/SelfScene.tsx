"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { getLang } from "../_constants/languages";
import SelfUI from "../_components/SelfUI";
import BackNav from "../_components/BackNav";

function InwardParticles() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.022;
  });
  return (
    <group ref={ref}>
      <Sparkles count={70} size={0.9} scale={22} color="#cc99ff" speed={0.04} opacity={0.5} />
    </group>
  );
}

// Subtle mandala rings so the background isn't completely bare
function Ring({ radius, color, phase }: { radius: number; color: string; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.rotation.z = clock.getElapsedTime() * 0.09 + phase;
  });
  const count = Math.round(radius * 5);
  return (
    <group ref={ref}>
      {Array.from({ length: count }).map((_, i) => {
        const a = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]}>
            <sphereGeometry args={[0.04, 6, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

interface Props {
  lang: string;
}

export default function SelfScene({ lang }: Props) {
  const langData = getLang(lang);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Three.js canvas */}
      <Canvas
        camera={{ position: [0, 0, 12], fov: 55 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        }}
      >
        <ambientLight intensity={0.04} />
        <Suspense fallback={null}>
          <InwardParticles />
          <Ring radius={2.8} color="#9966ff" phase={0} />
          <Ring radius={4.5} color="#6644cc" phase={Math.PI / 5} />
          <Stars radius={140} depth={50} count={900} factor={4} saturation={0} fade speed={0.03} />
        </Suspense>
      </Canvas>

      {/* Shadow figure — HTML overlay centered on canvas */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {/* "You" label above */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)",
            marginBottom: 18,
          }}
        >
          {langData.labels.you}
        </motion.div>

        {/* Breathing silhouette */}
        <motion.div
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            filter: "drop-shadow(0 0 18px rgba(245,200,66,0.38)) drop-shadow(0 0 6px rgba(200,160,255,0.3))",
          }}
        >
          <svg
            viewBox="0 0 120 180"
            width={110}
            height={165}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Head */}
            <circle cx="60" cy="28" r="17" fill="#111122" />
            <circle cx="60" cy="28" r="19" fill="none" stroke="rgba(245,200,66,0.22)" strokeWidth="1" />
            {/* Torso */}
            <ellipse cx="60" cy="88" rx="28" ry="34" fill="#111122" />
            {/* Lotus base / crossed legs */}
            <ellipse cx="60" cy="130" rx="48" ry="18" fill="#111122" />
            {/* Rim glow lines */}
            <ellipse cx="60" cy="88" rx="30" ry="36" fill="none" stroke="rgba(200,160,255,0.14)" strokeWidth="1" />
            <ellipse cx="60" cy="130" rx="50" ry="20" fill="none" stroke="rgba(245,200,66,0.12)" strokeWidth="0.8" />
          </svg>
        </motion.div>

        {/* "Self" label below */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7 }}
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: 14,
            color: "rgba(245,200,66,0.45)",
            letterSpacing: "0.18em",
            marginTop: 20,
          }}
        >
          {langData.labels.selfWord}
        </motion.div>
      </div>

      {/* SelfUI cards + BackNav */}
      <SelfUI />
      <BackNav />
    </div>
  );
}
