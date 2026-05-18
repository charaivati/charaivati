import { useRef, useCallback } from "react";

type PositionCallback = (lat: number, lng: number, accuracy: number) => void;
type ErrorCallback = (msg: string) => void;

export function useGeolocation() {
  const watchIdRef = useRef<string | number | null>(null);

  const startWatch = useCallback(async (
    onPosition: PositionCallback,
    onError: ErrorCallback
  ) => {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");

      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted") {
        onError("Location permission denied");
        return;
      }

      watchIdRef.current = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (pos, err) => {
          if (err) { onError(err.message); return; }
          if (pos) {
            onPosition(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy ?? 0
            );
          }
        }
      );
    } catch {
      if (!navigator.geolocation) {
        onError("Geolocation not supported");
        return;
      }
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => onPosition(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy
        ),
        (err) => onError(err.message),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  }, []);

  const stopWatch = useCallback(async () => {
    if (watchIdRef.current === null) return;
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      await Geolocation.clearWatch({ id: watchIdRef.current as string });
    } catch {
      if (typeof watchIdRef.current === "number") {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    }
    watchIdRef.current = null;
  }, []);

  return { startWatch, stopWatch };
}
