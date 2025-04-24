'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, OrbitControls, Sparkles, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, Suspense } from 'react';

function Galaxy() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Gentle rotation of the entire galaxy
      groupRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central glowing core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial color="#ffaa88" toneMapped={false} />
        <pointLight color="#ffaa88" intensity={50} distance={20} />
      </mesh>

      {/* Spiral arms */}
      {[...Array(4)].map((_, i) => (
        <Stars
          key={i}
          radius={50 + i * 20}
          depth={10}
          count={500}
          factor={8}
          saturation={0}
          fade
          speed={0.5}
          rotation={[0, 0, (i * Math.PI) / 2]}
        />
      ))}

      {/* Background starfield */}
      <Stars
        radius={200}
        depth={100}
        count={5000}
        factor={6}
        saturation={0}
        fade
        speed={0.2}
      />

      {/* Floating cosmic sparkles */}
      <Sparkles
        count={200}
        size={2}
        scale={100}
        color="#88aaff"
        speed={0.1}
      />
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