// UPI-QRUPLOAD-1b — client-side QR decode from a File.
// Primary: BarcodeDetector (Chrome/Edge/Android WebView, zero-dep).
// Fallback: jsQR (Safari/Firefox, ~10KB).
// The image never leaves the browser — no upload, no network hop.

// ponytail: BarcodeDetector missing from default TS lib — cast via window.
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
};

export async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  // Primary: BarcodeDetector (Chrome 83+, Edge, Android WebView)
  const BD = (typeof window !== "undefined" && "BarcodeDetector" in window)
    ? (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
    : null;
  if (BD) {
    try {
      const detector = new BD({ formats: ["qr_code"] });
      const codes = await detector.detect(canvas);
      if (codes.length > 0) return codes[0].rawValue;
    } catch {
      // fall through to jsQR
    }
  }

  // Fallback: jsQR
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jsQR = (await import("jsqr")).default;
  const result = jsQR(imageData.data, canvas.width, canvas.height);
  return result?.data ?? null;
}
