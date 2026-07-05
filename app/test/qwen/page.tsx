"use client";

import { Canvas } from "@react-three/fiber";
import { Stars, OrbitControls, Text } from "@react-three/drei";

export default function UniverseSimulation() {
  return (
    <Canvas style={{ height: "100vh", width: "100vw" }}>
      <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={-0.2} />
      <Stars />
      <Text
        position={[0, 5, -15]}
        fontSize={3}
        color="#ffffff"
        outlineColor="#000000"
        outlineWidth={0.01}
      >
        Universe Simulation
      </Text>
    </Canvas>
  );
}
