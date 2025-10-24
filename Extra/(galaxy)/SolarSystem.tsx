import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export function SolarSystem({ visible }: { visible: boolean }) {
  const sunRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.01;
    }
  });

  if (!visible) return null;

  return (
    <group scale={0.2} position={[0, 0, 0]}>
      <mesh ref={sunRef}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial emissive="yellow" color="orange" />
      </mesh>
      {/* Add more planets here */}
    </group>
  );
}
