import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

export function GalaxyCore() {
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (coreRef.current) {
      coreRef.current.rotation.y += 0.002;
    }
  });

  return (
    <mesh ref={coreRef}>
      <sphereGeometry args={[1.5, 64, 64]} />
      <meshStandardMaterial emissive="white" emissiveIntensity={5} color="black" />
    </mesh>
  );
}
