"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense } from "react";
import { motion } from "framer-motion";
import { getLang } from "../_constants/languages";

function DriftParticles() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.01;
  });
  return (
    <group ref={ref}>
      <Sparkles count={65} size={1.0} scale={18} color="#f5c842" speed={0.025} opacity={0.18} />
    </group>
  );
}

interface Props {
  countryName: string;
  lang: string;
}

export default function LandmassScene({ countryName, lang }: Props) {
  const langData = getLang(lang);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#050508",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Three.js background particles */}
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        }}
      >
        <Suspense fallback={null}>
          <DriftParticles />
          <Stars radius={100} depth={50} count={700} factor={4} saturation={0} fade speed={0.03} />
        </Suspense>
      </Canvas>

      {/* Radial glow behind text */}
      <div
        style={{
          position: "absolute",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(245,200,66,0.07) 0%, transparent 68%)",
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative",
          zIndex: 10,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: "clamp(36px, 9vw, 58px)",
            fontWeight: 200,
            color: "#eaf2ff",
            letterSpacing: "0.06em",
            fontFamily: "Georgia, 'Times New Roman', serif",
            textShadow: "0 0 40px rgba(245,200,66,0.18)",
            marginBottom: 22,
          }}
        >
          {countryName}
        </div>
        <div
          style={{
            fontSize: 14,
            fontStyle: "italic",
            color: "rgba(245,200,66,0.58)",
            fontFamily: "Georgia, 'Times New Roman', serif",
            letterSpacing: "0.03em",
          }}
        >
          {langData.labels.landmass}
        </div>
      </motion.div>
    </div>
  );
}
