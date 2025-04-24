import { GalaxyCore } from "./GalaxyCore";
import { SolarSystem } from "./SolarSystem";
import { useZoomState } from "./ZoomHandler";

export default function Galaxy() {
  const zoomedIn = useZoomState();

  return (
    <>
      <GalaxyCore />
      <SolarSystem visible={zoomedIn} />
    </>
  );
}
