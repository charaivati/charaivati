"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRef, Suspense, useMemo, useEffect } from "react";
import AlienComm, { type ArmPhase } from "../_components/AlienComm";

// ═══════════════════════════════════════════════════════════════════════════════
// SHADERS — shared by all star and galaxy point clouds
// ═══════════════════════════════════════════════════════════════════════════════
const POINT_VERT = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vCol;
  void main() {
    vCol = color;
    vec4 mvp = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, size * 500.0 / -mvp.z);
    gl_Position = projectionMatrix * mvp;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vCol;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    float a = (1.0 - r * 0.65) * uOpacity;
    gl_FragColor = vec4(vCol, a);
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// TEXTURE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════
function createNebulaTexture(colorHex: string): THREE.CanvasTexture {
  const size = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const r2 = parseInt(colorHex.slice(1, 3), 16);
  const g2 = parseInt(colorHex.slice(3, 5), 16);
  const b2 = parseInt(colorHex.slice(5, 7), 16);
  const cx = size / 2, cy = size / 2, rad = size / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0,   `rgba(${r2},${g2},${b2},0.18)`);
  g.addColorStop(0.3, `rgba(${r2},${g2},${b2},0.08)`);
  g.addColorStop(0.6, `rgba(${r2},${g2},${b2},0.03)`);
  g.addColorStop(1,   `rgba(${r2},${g2},${b2},0.00)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
}

// Fix 3: warm ivory core (#fff8e7), reduced inner brightness
function createCoreGlowTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,   "rgba(255,248,231,0.95)");
  g.addColorStop(0.2, "rgba(255,235,200,0.45)");
  g.addColorStop(0.5, "rgba(255,215,170,0.12)");
  g.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

// Fix 5: ring-glow aura for alien rim effect
function createAuraTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 45, 128, 128, 128);
  g.addColorStop(0,   "rgba(136,102,255,0)");
  g.addColorStop(0.35,"rgba(136,102,255,0.18)");
  g.addColorStop(0.65,"rgba(136,102,255,0.22)");
  g.addColorStop(1,   "rgba(136,102,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAR-FIELD GEOMETRY BUILDER (Fix 1)
// ═══════════════════════════════════════════════════════════════════════════════
function buildStarGeom(
  count: number,
  rMin: number, rMax: number,
  szMin: number, szMax: number,
  color: string,
  color2?: string,   // optional per-point colour variation
): THREE.BufferGeometry {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sz  = new Float32Array(count);
  const c1 = new THREE.Color(color);
  const c2 = color2 ? new THREE.Color(color2) : null;
  const cT = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r     = rMin + Math.random() * (rMax - rMin);
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
    if (c2) cT.lerpColors(c1, c2, Math.random()); else cT.copy(c1);
    col[i * 3] = cT.r; col[i * 3 + 1] = cT.g; col[i * 3 + 2] = cT.b;
    sz[i] = szMin + Math.random() * (szMax - szMin);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color",    new THREE.BufferAttribute(col, 3));
  g.setAttribute("size",     new THREE.BufferAttribute(sz,  1));
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GALAXY GEOMETRY BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
type GType = "spiral-face" | "spiral-edge" | "elliptical";

interface GCfg {
  type: GType;
  pointCount: number;
  radius: number;
  color1: string;
  color2: string;
}

function buildGalaxyGeom(cfg: GCfg): THREE.BufferGeometry {
  const { type, pointCount, radius, color1, color2 } = cfg;
  const pos = new Float32Array(pointCount * 3);
  const col = new Float32Array(pointCount * 3);
  const sz  = new Float32Array(pointCount);
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);
  const cT = new THREE.Color();
  const coreN = Math.floor(pointCount * 0.28);
  const armN  = pointCount - coreN;
  const yScale = type === "spiral-edge" ? 0.04 : 0.08;

  for (let i = 0; i < coreN; i++) {
    const r = Math.pow(Math.random(), 1.8) * radius * 0.18;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3]     = r * Math.cos(a);
    pos[i * 3 + 1] = (Math.random() - 0.5) * radius * yScale * 0.4;
    pos[i * 3 + 2] = r * Math.sin(a);
    cT.copy(c1);
    col[i * 3] = cT.r; col[i * 3 + 1] = cT.g; col[i * 3 + 2] = cT.b;
    sz[i] = 0.55 + Math.random() * 0.45;
  }

  if (type === "elliptical") {
    for (let i = 0; i < armN; i++) {
      const u1  = Math.max(1e-6, Math.random());
      const r   = Math.min(Math.sqrt(-2 * Math.log(u1)) * (radius / 3), radius * 0.98);
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const ii = (coreN + i) * 3;
      pos[ii]     = r * Math.sin(phi) * Math.cos(theta);
      pos[ii + 1] = r * Math.cos(phi) * 0.7;
      pos[ii + 2] = r * Math.sin(phi) * Math.sin(theta);
      cT.lerpColors(c1, c2, Math.min(r / radius * 2.2, 1));
      col[ii] = cT.r; col[ii + 1] = cT.g; col[ii + 2] = cT.b;
      sz[coreN + i] = 0.3 + Math.random() * 0.4;
    }
  } else {
    const numArms = 3;
    for (let i = 0; i < armN; i++) {
      const ai = i % numArms;
      const ao = (ai / numArms) * Math.PI * 2;
      const t  = Math.pow(Math.random(), 0.65);
      const r  = t * radius;
      const angle  = (r / radius) * Math.PI * 2.8 + ao;
      const spread = (0.04 + t * 0.11) * radius;
      const x = r * Math.cos(angle) + (Math.random() - 0.5) * spread;
      const z = r * Math.sin(angle) + (Math.random() - 0.5) * spread;
      const y = (Math.random() - 0.5) * radius * yScale;
      const ii = (coreN + i) * 3;
      pos[ii] = x; pos[ii + 1] = y; pos[ii + 2] = z;
      cT.lerpColors(c1, c2, Math.min(Math.sqrt(x * x + z * z) / radius * 1.5, 1));
      col[ii] = cT.r; col[ii + 1] = cT.g; col[ii + 2] = cT.b;
      sz[coreN + i] = 0.3 + Math.random() * 0.5;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("color",    new THREE.BufferAttribute(col, 3));
  geom.setAttribute("size",     new THREE.BufferAttribute(sz,  1));
  return geom;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GALAXY PLACEMENT CONFIGS (Fix 2: redistributed; Fix 3: MW arm color)
// ═══════════════════════════════════════════════════════════════════════════════
interface GPlacem extends GCfg {
  position: [number, number, number];
  speed: number;
  tilt: number;
  isMilkyWay?: boolean;
}

const GALAXY_DEFS: GPlacem[] = [
  { isMilkyWay: true,
    type: "spiral-face", pointCount: 1200, radius: 28,
    color1: "#fff4cc", color2: "#88aadd",           // Fix 3: arm color
    position: [0, 8, -80],         speed: 0.0004, tilt: 0.2  },
  { type: "spiral-face", pointCount: 800,  radius: 18,
    color1: "#ffaa66", color2: "#ff6688",
    position: [-140, 45, -190],    speed: 0.0006, tilt: 1.1  },
  { type: "spiral-edge", pointCount: 700,  radius: 22,
    color1: "#ffffff", color2: "#aaddff",
    position: [170, -35, -170],    speed: 0.0008, tilt: 0.0  },
  { type: "elliptical",  pointCount: 600,  radius: 14,
    color1: "#ffddaa", color2: "#ffaa44",
    position: [-90, -70, -240],    speed: 0.0003, tilt: 0.5  },
  { type: "spiral-face", pointCount: 750,  radius: 16,
    color1: "#ccaaff", color2: "#6644ff",
    position: [210, 75, -290],     speed: 0.0007, tilt: 0.8  },
  { type: "spiral-edge", pointCount: 650,  radius: 20,
    color1: "#aaffcc", color2: "#44ffaa",
    position: [-180, 15, -340],    speed: 0.0005, tilt: 0.05 },
  { type: "elliptical",  pointCount: 500,  radius: 10,
    color1: "#ffffff", color2: "#ddccff",
    position: [60, 110, -380],     speed: 0.001,  tilt: 0.3  },
  { type: "spiral-face", pointCount: 700,  radius: 15,
    color1: "#ffcc88", color2: "#ff8844",
    position: [-130, -90, -310],   speed: 0.0006, tilt: 1.4  },
  { type: "spiral-edge", pointCount: 550,  radius: 12,
    color1: "#ccddff", color2: "#8899ff",
    position: [150, -110, -260],   speed: 0.0009, tilt: 0.02 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Fix 1 — Layer A: ultra-distant, static (NOT inside UniverseGroup)
function StaticStarField() {
  const geom = useMemo(() => buildStarGeom(5000, 600, 1200, 0.2, 0.4, "#aabbdd"), []);
  return (
    <points geometry={geom}>
      <shaderMaterial uniforms={{ uOpacity: { value: 0.20 } }}
        vertexShader={POINT_VERT} fragmentShader={POINT_FRAG}
        depthWrite={false} transparent />
    </points>
  );
}

// 4 nebula clouds — opacity baked into texture, material opacity=1.0
function NebulaClouds() {
  const textures = useMemo(
    () => ["#2255aa", "#882255", "#aa6622", "#1a3355"].map(createNebulaTexture),
    []
  );
  // [x, y, z, scaleX, scaleY] — scales halved, Z pushed back vs previous version
  const NEBULAS: [number, number, number, number, number][] = [
    [ -60,  20, -220,  60,  50],
    [  80, -30, -280,  45,  40],
    [ -20, -50, -320,  50,  45],
    [ 100, -10, -240,  55,  48],
  ];
  return (
    <>
      {NEBULAS.map(([x, y, z, sx, sy], i) => (
        <sprite key={i} position={[x, y, z]} scale={[sx, sy, 1]}>
          <spriteMaterial
            map={textures[i]}
            blending={THREE.AdditiveBlending}
            transparent
            opacity={1.0}
            depthWrite={false}
            depthTest={false}
          />
        </sprite>
      ))}
    </>
  );
}

function GalaxyMesh({ cfg, pulseRef }: {
  cfg: GPlacem;
  pulseRef: React.MutableRefObject<number>;
}) {
  const geom        = useMemo(() => buildGalaxyGeom(cfg), []); // eslint-disable-line
  const coreGlowTex = useMemo(() => cfg.isMilkyWay ? createCoreGlowTexture() : null, [cfg.isMilkyWay]);
  const groupRef    = useRef<THREE.Group>(null);
  const lastPulse   = useRef(0);
  const pulseStart  = useRef<number | null>(null);
  const rotX = cfg.type === "spiral-edge" ? Math.PI / 2 + cfg.tilt : cfg.tilt;
  // Fix 3: Milky Way arm opacity capped at 0.75
  const ptOpacity = cfg.isMilkyWay ? 0.75 : 0.9;

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += cfg.speed;
    if (cfg.isMilkyWay) {
      if (pulseRef.current > lastPulse.current) {
        lastPulse.current = pulseRef.current;
        pulseStart.current = clock.getElapsedTime();
      }
      if (pulseStart.current !== null) {
        const t = clock.getElapsedTime() - pulseStart.current;
        if (t < 0.8) {
          g.scale.setScalar(1 + 0.15 * Math.sin((t / 0.8) * Math.PI));
        } else {
          g.scale.setScalar(1);
          pulseStart.current = null;
        }
      }
    }
  });

  return (
    <group ref={groupRef} position={cfg.position} rotation={[rotX, 0, 0]}>
      <points geometry={geom}>
        <shaderMaterial uniforms={{ uOpacity: { value: ptOpacity } }}
          vertexShader={POINT_VERT} fragmentShader={POINT_FRAG}
          blending={THREE.AdditiveBlending} depthWrite={false} transparent />
      </points>
      {/* Fix 3: core sprite — warm ivory, 30% smaller, opacity 0.55 */}
      {cfg.isMilkyWay && coreGlowTex && (
        <sprite scale={[5.6, 5.6, 1]}>
          <spriteMaterial map={coreGlowTex} blending={THREE.AdditiveBlending}
            transparent opacity={0.55} depthWrite={false} />
        </sprite>
      )}
    </group>
  );
}

// Fix 1 — Layer C wrapper: extra micro-rotation on top of UniverseGroup
function StarLayerCWrapper({ geom }: { geom: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y += 0.00004; });
  return (
    <group ref={ref}>
      <points geometry={geom}>
        <shaderMaterial uniforms={{ uOpacity: { value: 0.40 } }}
          vertexShader={POINT_VERT} fragmentShader={POINT_FRAG}
          depthWrite={false} transparent />
      </points>
    </group>
  );
}

function UniverseGroup({ pulseRef }: { pulseRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);

  // Fix 1: Layers B and C built once
  const starBGeom = useMemo(() => buildStarGeom(3000, 0, 600, 0.3, 0.6, "#ccd4ee"),          []);
  const starCGeom = useMemo(() => buildStarGeom(1500, 0, 300, 0.5, 1.2, "#eef0ff", "#dde8ff"), []);

  useFrame(() => { if (groupRef.current) groupRef.current.rotation.y += 0.00008; });

  return (
    <group ref={groupRef} rotation={[0.05, 0, 0]}>
      {/* Fix 1: Layer B — inherits universe group rotation */}
      <points geometry={starBGeom}>
        <shaderMaterial uniforms={{ uOpacity: { value: 0.30 } }}
          vertexShader={POINT_VERT} fragmentShader={POINT_FRAG}
          depthWrite={false} transparent />
      </points>
      {/* Fix 1: Layer C — slightly faster rotation */}
      <StarLayerCWrapper geom={starCGeom} />

      {GALAXY_DEFS.map((cfg, i) => (
        <GalaxyMesh key={i} cfg={cfg} pulseRef={pulseRef} />
      ))}
      <NebulaClouds />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALIEN FIGURE (Fix 5: proper 3D geometry, new material, rim glow aura)
// Rebuilt at ~8 world-unit height. Camera at (0,0,0), alien at z=-60.
// All animation logic (arm phase lerp, float, projection) preserved exactly.
// ═══════════════════════════════════════════════════════════════════════════════
const ALIEN_MAT_PROPS = {
  color: "#9988cc",
  emissive: new THREE.Color("#332244"),
  emissiveIntensity: 0.3,
  roughness: 0.7,
  metalness: 0.1,
  depthTest: true,
  depthWrite: true,
} as const;

const _wp = new THREE.Vector3();

interface AlienProps {
  armPhaseRef: React.RefObject<ArmPhase>;
  alienScreenPosRef: React.MutableRefObject<{ x: number; y: number }>;
}

function AlienMesh({ armPhaseRef, alienScreenPosRef }: AlienProps) {
  const outerRef = useRef<THREE.Group>(null);
  const rootRef  = useRef<THREE.Group>(null);
  const leftRef  = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  const lz = useRef( Math.PI * 0.28);
  const rz = useRef(-Math.PI * 0.28);
  const auraTex = useMemo(() => createAuraTexture(), []);

  useEffect(() => {
    if (outerRef.current) {
      outerRef.current.renderOrder = 999;
      outerRef.current.traverse((obj) => { obj.renderOrder = 999; });
    }
    console.log("[AlienMesh] mounted at world position:", -10, -4, -60);
  }, []);

  useFrame(({ clock, camera, size }) => {
    const t = clock.getElapsedTime();

    // Float
    if (rootRef.current) rootRef.current.position.y = Math.sin(t * 0.65) * 0.9;

    // Fix 5: subtler emissive pulse (0.15 – 0.45 range)
    const pulse = 0.30 + 0.15 * Math.sin(t * 1.4);
    rootRef.current?.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat.emissive) mat.emissiveIntensity = pulse;
      }
    });

    // Arm lerp — identical logic to before
    let targetL: number, targetR: number;
    switch (armPhaseRef.current) {
      case "shrug": targetL =  Math.PI * 0.06; targetR = -Math.PI * 0.06; break;
      case "wave":  targetL =  Math.PI * 0.52; targetR = -Math.PI * 0.52; break;
      default:      targetL =  Math.PI * 0.28; targetR = -Math.PI * 0.28;
    }
    lz.current += (targetL - lz.current) * 0.06;
    rz.current += (targetR - rz.current) * 0.06;
    if (leftRef.current)  leftRef.current.rotation.z  = lz.current;
    if (rightRef.current) rightRef.current.rotation.z = rz.current;

    // Project alien chest to screen
    if (rootRef.current) {
      rootRef.current.getWorldPosition(_wp);
      _wp.y += 2.5; // offset to chest height in new proportions
      _wp.project(camera);
      alienScreenPosRef.current = {
        x: (_wp.x *  0.5 + 0.5) * size.width,
        y: (_wp.y * -0.5 + 0.5) * size.height,
      };
    }
  });

  return (
    <group ref={outerRef} position={[-10, -4, -60]}>
      <group ref={rootRef}>
        {/* Rim glow aura — rendered first so meshes paint over it */}
        <sprite position={[0, 2.2, -0.6]} scale={[6, 13, 1]}>
          <spriteMaterial map={auraTex} blending={THREE.AdditiveBlending}
            transparent opacity={0.15} depthWrite={false} depthTest={false} />
        </sprite>

        {/* Head */}
        <mesh renderOrder={999} position={[0, 5.0, 0]}>
          <sphereGeometry args={[1.1, 12, 12]} />
          <meshStandardMaterial {...ALIEN_MAT_PROPS} />
        </mesh>

        {/* Neck */}
        <mesh renderOrder={999} position={[0, 4.1, 0]}>
          <cylinderGeometry args={[0.35, 0.42, 0.85, 8]} />
          <meshStandardMaterial {...ALIEN_MAT_PROPS} />
        </mesh>

        {/* Body */}
        <mesh renderOrder={999} position={[0, 2.1, 0]}>
          <cylinderGeometry args={[1.1, 0.9, 2.9, 8]} />
          <meshStandardMaterial {...ALIEN_MAT_PROPS} />
        </mesh>

        {/* Left arm */}
        <group ref={leftRef} position={[-1.3, 3.25, 0]}>
          <mesh renderOrder={999} position={[0, -1.2, 0]}>
            <cylinderGeometry args={[0.29, 0.23, 2.4, 6]} />
            <meshStandardMaterial {...ALIEN_MAT_PROPS} />
          </mesh>
        </group>

        {/* Right arm */}
        <group ref={rightRef} position={[1.3, 3.25, 0]}>
          <mesh renderOrder={999} position={[0, -1.2, 0]}>
            <cylinderGeometry args={[0.29, 0.23, 2.4, 6]} />
            <meshStandardMaterial {...ALIEN_MAT_PROPS} />
          </mesh>
        </group>

        {/* Left leg */}
        <group position={[-0.4, 0.5, 0]} rotation={[0, 0, -0.12]}>
          <mesh renderOrder={999} position={[0, -1.05, 0]}>
            <cylinderGeometry args={[0.35, 0.28, 2.1, 6]} />
            <meshStandardMaterial {...ALIEN_MAT_PROPS} />
          </mesh>
        </group>

        {/* Right leg */}
        <group position={[0.4, 0.5, 0]} rotation={[0, 0, 0.12]}>
          <mesh renderOrder={999} position={[0, -1.05, 0]}>
            <cylinderGeometry args={[0.35, 0.28, 2.1, 6]} />
            <meshStandardMaterial {...ALIEN_MAT_PROPS} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENE + EXPORT
// ═══════════════════════════════════════════════════════════════════════════════
interface SceneProps {
  armPhaseRef: React.RefObject<ArmPhase>;
  alienScreenPosRef: React.MutableRefObject<{ x: number; y: number }>;
  pulseRef: React.MutableRefObject<number>;
}

function GalaxyScene({ armPhaseRef, alienScreenPosRef, pulseRef }: SceneProps) {
  return (
    <>
      {/* Fix 7: purple-tinted ambient so alien shadow side isn't pitch black */}
      <ambientLight color="#221133" intensity={0.4} />
      {/* Fix 1: Layer A — static, not inside rotating group */}
      <StaticStarField />
      <UniverseGroup pulseRef={pulseRef} />
      <AlienMesh armPhaseRef={armPhaseRef} alienScreenPosRef={alienScreenPosRef} />
    </>
  );
}

interface Props {
  onLangSelected: (code: string) => void;
}

export default function UniverseScene({ onLangSelected }: Props) {
  const armPhaseRef       = useRef<ArmPhase>("neutral");
  const alienScreenPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const milkyWayPulseRef  = useRef(0);

  function handleLangSelected(code: string) {
    milkyWayPulseRef.current++;
    setTimeout(() => onLangSelected(code), 900);
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        camera={{ position: [0, 0, 0], fov: 75, near: 0.1, far: 1200 }}
        gl={{ antialias: true }}
        onCreated={({ gl }) => gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))}
      >
        <Suspense fallback={null}>
          <GalaxyScene
            armPhaseRef={armPhaseRef}
            alienScreenPosRef={alienScreenPosRef}
            pulseRef={milkyWayPulseRef}
          />
        </Suspense>
      </Canvas>

      <AlienComm
        onLangSelected={handleLangSelected}
        onArmPhase={(p) => { armPhaseRef.current = p; }}
        alienScreenPosRef={alienScreenPosRef}
      />
    </div>
  );
}
