"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import * as THREE from "three";
import { CHAKRAS, type Chakra } from "../chakras";

// spineY (0 base, 1 crown) -> world Y on the figure.
const Y_BASE = -2.0;
const Y_SPAN = 4.2;
const worldY = (spineY: number) => Y_BASE + spineY * Y_SPAN;

function litStart(index: number) {
  return (index / CHAKRAS.length) * 0.92;
}
const litAmount = (p: number, index: number) => {
  const s = litStart(index);
  return Math.min(1, Math.max(0, (p - s) / 0.07));
};

// One soft radial glow texture, reused (tinted per orb via sprite color).
function useGlowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.5)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
}

// A lotus-petal mandala + bija syllable, drawn white so the sprite tints it
// to the chakra colour. Petal count is the traditional number.
function makeSymbolTexture(chakra: Chakra) {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2.5;

  const ringR = 88;
  const n = Math.min(chakra.petals, 32);
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -ringR, 9, 22, 0, 0, Math.PI * 2); // petal pointing outward
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2); // inner ring
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 66px 'Nirmala UI', 'Noto Sans Devanagari', serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(chakra.bija, 0, 6);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function Orb3D({ chakra, index, progress, glow }: {
  chakra: Chakra; index: number; progress: MotionValue<number>; glow: THREE.Texture;
}) {
  const symbol = useMemo(() => makeSymbolTexture(chakra), [chakra]);
  const symSprite = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Sprite>(null);
  const light = useRef<THREE.PointLight>(null);
  const y = worldY(chakra.spineY);

  useFrame(() => {
    const lit = litAmount(progress.get(), index);
    if (symSprite.current) {
      const s = 0.42 + lit * 0.18;
      symSprite.current.scale.set(s, s, s);
      (symSprite.current.material as THREE.SpriteMaterial).opacity = lit;
    }
    if (halo.current) {
      const hs = 0.4 + lit * 1.3;
      halo.current.scale.set(hs, hs, hs);
      (halo.current.material as THREE.SpriteMaterial).opacity = lit * 0.7;
    }
    if (light.current) light.current.intensity = lit * 6;
  });

  return (
    <group position={[0, y, 0.85]}>
      <sprite ref={halo} scale={[0.4, 0.4, 0.4]}>
        <spriteMaterial map={glow} color={chakra.color} blending={THREE.AdditiveBlending} transparent depthWrite={false} opacity={0} />
      </sprite>
      <sprite ref={symSprite} scale={[0.42, 0.42, 0.42]}>
        <spriteMaterial map={symbol} color={chakra.color} blending={THREE.AdditiveBlending} transparent depthWrite={false} opacity={0} />
      </sprite>
      <pointLight ref={light} color={chakra.color} intensity={0} distance={4} decay={2} />
    </group>
  );
}

// One connected seated form, overlapping ellipsoids so there are no gaps.
function FigureMesh() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#06070c", roughness: 1, metalness: 0 }), []);
  const E = (key: string, pos: [number, number, number], scl: [number, number, number]) => (
    <mesh key={key} position={pos} scale={scl} material={mat}>
      <sphereGeometry args={[1, 32, 24]} />
    </mesh>
  );
  return (
    <group>
      {E("lap", [0, -1.6, 0], [2.0, 0.6, 1.25])}
      {E("kneeR", [1.25, -1.45, 0.55], [0.5, 0.4, 0.55])}
      {E("kneeL", [-1.25, -1.45, 0.55], [0.5, 0.4, 0.55])}
      {E("pelvis", [0, -0.95, 0], [0.95, 0.7, 0.85])}
      {E("belly", [0, -0.2, 0.05], [0.82, 0.85, 0.74])}
      {E("chest", [0, 0.6, 0], [0.92, 0.85, 0.72])}
      {E("shoulders", [0, 1.0, 0], [1.5, 0.5, 0.68])}
      {E("head", [0, 1.78, 0], [0.5, 0.56, 0.5])}
      <mesh position={[0, 1.32, 0]} material={mat}>
        <cylinderGeometry args={[0.22, 0.26, 0.4, 16]} />
      </mesh>
      <mesh position={[1.02, -0.2, 0.25]} rotation={[0.1, 0, 0.08]} material={mat}>
        <capsuleGeometry args={[0.2, 1.9, 8, 16]} />
      </mesh>
      <mesh position={[-1.02, -0.2, 0.25]} rotation={[0.1, 0, -0.08]} material={mat}>
        <capsuleGeometry args={[0.2, 1.9, 8, 16]} />
      </mesh>
    </group>
  );
}

function Scene({ progress }: { progress: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const glow = useGlowTexture();
  useFrame((state) => {
    if (group.current) {
      const t = state.clock.elapsedTime;
      group.current.rotation.y = Math.sin(t * 0.25) * 0.18;
      group.current.position.y = Math.sin(t * 0.6) * 0.04; // gentle breathing
    }
  });
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[3, 4, 5]} intensity={0.3} />
      <group ref={group}>
        <FigureMesh />
        {CHAKRAS.map((c, i) => (
          <Orb3D key={c.key} chakra={c} index={i} progress={progress} glow={glow} />
        ))}
      </group>
    </>
  );
}

function Panel({ chakra, index, progress }: { chakra: Chakra; index: number; progress: MotionValue<number> }) {
  const start = litStart(index);
  const opacity = useTransform(progress, [start - 0.07, start, start + 0.1, start + 0.17], [0, 1, 1, 0]);
  const y = useTransform(progress, [start - 0.07, start], [24, 0]);
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-0 flex flex-col justify-center">
      <div className="text-sm uppercase tracking-[0.3em] mb-3" style={{ color: chakra.color }}>
        {chakra.sanskrit}
      </div>
      <div className="text-4xl sm:text-5xl font-semibold text-white">{chakra.name}</div>
      <p className="mt-4 text-white/50 max-w-xs">{chakra.line}</p>
    </motion.div>
  );
}

export default function ChakraThree() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <main className="bg-black text-white">
      <Link href="/chakra" className="fixed top-5 left-5 z-20 text-sm text-white/40 hover:text-white/80 transition">
        ← back
      </Link>

      <div ref={ref} className="relative h-[700vh]">
        <div
          className="sticky top-0 h-screen overflow-hidden"
          style={{ background: "radial-gradient(120% 90% at 50% 55%, #15102b 0%, #0a0712 45%, #000 100%)" }}
        >
          <Canvas camera={{ position: [0, 0.2, 7], fov: 42 }} gl={{ alpha: true }} className="!absolute inset-0">
            <Scene progress={scrollYProgress} />
          </Canvas>

          {/* text overlay, right half */}
          <div className="pointer-events-none absolute inset-0 mx-auto max-w-5xl px-6 grid sm:grid-cols-2 items-center">
            <div />
            <div className="relative h-48">
              {CHAKRAS.map((c, i) => (
                <Panel key={c.key} chakra={c} index={i} progress={scrollYProgress} />
              ))}
            </div>
          </div>

          <motion.div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/30 text-xs tracking-widest"
            style={{ opacity: useTransform(scrollYProgress, [0, 0.05], [1, 0]) }}
          >
            scroll ↓ to rise
          </motion.div>
        </div>
      </div>
    </main>
  );
}

// ponytail: glow is faked with emissive + additive sprite halos + point lights —
// no @react-three/postprocessing. Add it for true bloom if the look needs more.
