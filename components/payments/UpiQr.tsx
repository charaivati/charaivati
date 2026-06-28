"use client";

// UPI-QR-1 — client-side QR encoder for upi://pay intent strings.
// ponytail: qrcode dep is deliberate (payment string must not transit a third-party API)
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export default function UpiQr({ value, size = 180 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 });
  }, [value, size]);

  if (!value) return null;
  return <canvas ref={canvasRef} width={size} height={size} />;
}
