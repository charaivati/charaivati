'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Sphere } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function SolarSystem() {
  const earthRef = useRef();
  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group>
      {/* Sun */}
      <Sphere args={[5, 64, 64]} position={[0, 0, 0]}>
        <meshBasicMaterial attach="material" color="yellow" />
      </Sphere>

      {/* Earth */}
      <Sphere ref={earthRef} args={[1, 64, 64]} position={[20, 0, 0]}>
        <meshStandardMaterial
          map={new THREE.TextureLoader().load("/earth_texture.jpg")}
          bumpMap={new THREE.TextureLoader().load("/earth_bump.jpg")}
          bumpScale={0.05}
        />
      </Sphere>
    </group>
  );
}

function CameraController() {
  const { camera } = useThree();
  const target = new THREE.Vector3(20, 0, 0);
  useFrame(() => {
    camera.lookAt(target);
  });
  return null;
}

export default function GalaxyZoom() {
  return (
    <div className="w-screen h-screen">
      <Canvas camera={{ position: [100, 20, 100], fov: 60 }}>
        <Stars radius={300} depth={60} count={10000} factor={7} saturation={0} fade />
        <ambientLight intensity={0.3} />
        <pointLight position={[0, 0, 0]} intensity={2} />

        <SolarSystem />
        <CameraController />
      </Canvas>
    </div>
  );
}
// Hi changing the file
