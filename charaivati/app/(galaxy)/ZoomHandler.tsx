import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";

export function useZoomState(threshold = 4) {
  const { camera } = useThree();
  const [zoomedIn, setZoomedIn] = useState(false);

  useEffect(() => {
    const checkZoom = () => {
      setZoomedIn(camera.position.z < threshold);
    };
    checkZoom();

    const onFrame = () => checkZoom();
    const id = requestAnimationFrame(onFrame);

    return () => cancelAnimationFrame(id);
  }, [camera, threshold]);

  return zoomedIn;
}
