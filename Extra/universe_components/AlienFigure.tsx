// app/components/AlienFigure.tsx
'use client';
import * as THREE from 'three';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import React from 'react';

type Props = {
  position?: [number, number, number];
  mouthOpen?: number; // 0..1
  scale?: number;
};

export default function AlienFigure({ position = [0, -4.6, -18], mouthOpen = 0, scale = 1 }: Props) {
  const group = useRef<THREE.Group | null>(null);
  const mouthRef = useRef<THREE.Mesh | null>(null);

  // Stationary but subtle idle rotation on head only (very small)
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.12) * 0.03 * (1 / scale);
    if (mouthRef.current) {
      // scale mouth in Y to simulate opening
      mouthRef.current.scale.y = 0.12 + mouthOpen * 0.8;
    }
  });

  return (
    <group ref={group} position={position as any} scale={scale as any}>
      {/* Head */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[2.2, 48, 48]} />
        <meshStandardMaterial color="#7fe7b8" metalness={0.15} roughness={0.45} />
      </mesh>

      {/* Eyes: small dark lines (thin flattened planes) for better visibility */}
      <mesh position={[-0.7, 0.5, 1.8]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.6, 0.08]} />
        <meshBasicMaterial color="#071017" />
      </mesh>
      <mesh position={[0.7, 0.5, 1.8]}>
        <planeGeometry args={[0.6, 0.08]} />
        <meshBasicMaterial color="#071017" />
      </mesh>

      {/* Mouth: white thin rectangle that scales in Y */}
      <mesh ref={mouthRef} position={[0, -0.7, 1.95]}>
        <planeGeometry args={[1.2, 0.12]} />
        <meshBasicMaterial color="#fff" />
      </mesh>

      {/* Neck/body (small) */}
      <mesh position={[0, -2.25, 0]}>
        <cylinderGeometry args={[0.9, 1.1, 1.2, 20]} />
        <meshStandardMaterial color="#63cf9b" />
      </mesh>
    </group>
  );
}
