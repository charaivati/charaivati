'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useMemo, Suspense } from 'react';

function TwinklingStars({ count = 1000, radius = 200 }) {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.random() * radius;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pos.set([x, y, z], i * 3);
    }
    return pos;
  }, [count, radius]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ref.current) {
      const material = ref.current.material as THREE.PointsMaterial;
      material.opacity = 0.5 + 0.5 * Math.sin(t * 2);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.7}
        color="#ffffff"
        transparent
        opacity={1}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function TwinklingSpheres({ count = 100, radius = 50, spread = 10, color = 0x88aaff, size = 0.5 }) {
  const refs = useRef<THREE.Mesh[]>([]);

  const positions = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const r = radius + Math.random() * spread;
      const x = Math.cos(angle) * r;
      const y = (Math.random() - 0.5) * spread;
      const z = Math.sin(angle) * r;
      return new THREE.Vector3(x, y, z);
    });
  }, [count, radius, spread]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((mesh, i) => {
      const flicker = (Math.sin(t * 4 + i) + 1) / 2;
      if (mesh?.material) {
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * flicker;
      }
    });
  });

  return (
    <>
      {positions.map((pos, i) => (
        <mesh
          key={i}
          position={pos}
          ref={(el) => (refs.current[i] = el!)}
        >
          <sphereGeometry args={[size, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

function Galaxy() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glowing Core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#ffaa88" toneMapped={false} />
        <pointLight color="#ffaa88" intensity={50} distance={20} />
      </mesh>

      {/* Spiral Arms with Twinkling Spheres */}
      {[...Array(4)].map((_, i) => (
        <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <TwinklingSpheres count={100} radius={30 + i * 10} spread={10} size={1} color={0x88aaff} />
        </group>
      ))}

      {/* Background Starfield */}
      <TwinklingStars count={3000} radius={200} />

      {/* Sparkles */}
      <Sparkles count={150} size={2} scale={100} color="#88aaff" speed={0.2} />
    </group>
  );
}

function FloatingTitle() {
  return (
    <Text
      position={[0, 10, -30]}
      fontSize={4}
      color="#ffffff"
      anchorX="center"
      anchorY="middle"
      font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
    >
      Cosmic Explorer
      <meshBasicMaterial toneMapped={false} color="#88aaff" />
    </Text>
  );
}

export default function BeautifulSpace() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas camera={{ position: [0, 0, 30], fov: 60 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} intensity={1} />

          <Galaxy />
          <FloatingTitle />

          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={20}
            maxDistance={100}
            autoRotate
            autoRotateSpeed={0.5}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
