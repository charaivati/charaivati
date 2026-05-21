"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { useRef, Suspense, useMemo } from "react";
import { motion } from "framer-motion";
import { getLang } from "../_constants/languages";

const STAR_COUNT = 450;

function WarpField() {
  const linesRef = useRef<THREE.LineSegments>(null);

  // Build geometry with mutable Float32Array
  const { geometry, angles, radii } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 6);
    const angles = Float32Array.from({ length: STAR_COUNT }, () => Math.random() * Math.PI * 2);
    const radii = Float32Array.from({ length: STAR_COUNT }, () => Math.random() * 22);

    for (let i = 0; i < STAR_COUNT; i++) {
      const a = angles[i], r = radii[i];
      positions[i * 6 + 0] = Math.cos(a) * r;
      positions[i * 6 + 1] = Math.sin(a) * r;
      positions[i * 6 + 2] = 0;
      positions[i * 6 + 3] = Math.cos(a) * Math.max(r - r * 0.3, 0);
      positions[i * 6 + 4] = Math.sin(a) * Math.max(r - r * 0.3, 0);
      positions[i * 6 + 5] = 0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { geometry, angles, radii };
  }, []);

  useFrame((_, delta) => {
    const speed = 20 * delta;
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < STAR_COUNT; i++) {
      radii[i] += speed;
      if (radii[i] > 32) radii[i] = 0.1 + Math.random() * 0.8;

      const a = angles[i];
      const r = radii[i];
      const rt = Math.max(r - Math.max(r * 0.35, 1.2), 0);

      arr[i * 6 + 0] = Math.cos(a) * r;
      arr[i * 6 + 1] = Math.sin(a) * r;
      arr[i * 6 + 3] = Math.cos(a) * rt;
      arr[i * 6 + 4] = Math.sin(a) * rt;
    }
    attr.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#eaf2ff" transparent opacity={0.7} />
    </lineSegments>
  );
}

function CentralGlow() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.scale.setScalar(1 + 0.15 * Math.sin(t * 2.2));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.6, 16, 16]} />
      <meshBasicMaterial color="#f5c842" transparent opacity={0.55} toneMapped={false} />
    </mesh>
  );
}

interface Props {
  lang: string;
}

export default function TravelScene({ lang }: Props) {
  const langData = getLang(lang);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 9], fov: 78 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        }}
      >
        <Suspense fallback={null}>
          <WarpField />
          <CentralGlow />
          <Stars radius={200} depth={60} count={400} factor={3} saturation={0} fade speed={0.02} />
        </Suspense>
      </Canvas>

      {/* Poetic label */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 3, times: [0, 0.2, 0.75, 1] }}
        style={{
          position: "absolute",
          bottom: 110,
          left: 0,
          right: 0,
          textAlign: "center",
          pointerEvents: "none",
          zIndex: 10,
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: 17,
          color: "rgba(245,200,66,0.7)",
          letterSpacing: "0.04em",
          textShadow: "0 0 30px rgba(245,200,66,0.3)",
        }}
      >
        {langData.labels.travel}
      </motion.div>
    </div>
  );
}
