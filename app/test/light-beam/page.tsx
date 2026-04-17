"use client";
import { useEffect, useRef } from "react";

// Simple seeded pseudo-random so gap patterns stay stable per ray (not re-randomised each frame)
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function LightBeamPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // ── Ray config ────────────────────────────────────────────────────
    // How many side rays per side
    const NUM_RAYS = 14;

    // For each ray index (0 = innermost, NUM_RAYS-1 = outermost):
    //   x_offset(y) = maxOffset[i] * pow(y/H, EXPONENT)
    // EXPONENT > 1 gives exponential-looking spread (starts close to centre, fans out)
    const EXPONENT = 1.7;

    // Build per-ray gap sequences once (seeded so they're stable across frames)
    type GapEntry = { start: number; end: number }; // in normalised 0-1 y
    const rayGaps: GapEntry[][] = [];
    for (let ri = 0; ri < NUM_RAYS; ri++) {
      const rng = seededRand(ri * 317 + 42);
      const gaps: GapEntry[] = [];
      // outer rays get more gaps
      const density = 0.3 + (ri / NUM_RAYS) * 0.45;
      let y = rng() * 0.1;
      while (y < 1) {
        const segLen = 0.04 + rng() * 0.12 * (1 - ri / NUM_RAYS); // shorter segs for outer
        const gapLen = density * (0.02 + rng() * 0.06);
        gaps.push({ start: y, end: y + segLen });
        y += segLen + gapLen;
      }
      rayGaps.push(gaps);
    }

    let tick = 0;

    function drawSideRays(W: number, H: number, cx: number, pulse: number) {
      // Each side separately so we can mirror cleanly
      for (const side of [-1, 1]) {
        for (let ri = 0; ri < NUM_RAYS; ri++) {
          // Outermost ray reaches ~46% of half-width; innermost ~3%
          const tFraction = (ri + 1) / NUM_RAYS;
          const maxOffset = W * 0.03 + W * 0.43 * Math.pow(tFraction, 1.1);

          // Brightness: inner rays are bright, outer ones fade
          const brightness = Math.pow(1 - tFraction * 0.85, 1.4);
          // Outer rays also fade faster vertically
          const vertFade = 0.65 + (1 - tFraction) * 0.35; // how far down they reach

          // Animate gaps scrolling downward: shift gap pattern by tick
          const scrollSpeed = 0.0012 + ri * 0.00008; // inner moves slightly faster
          const scrollOffset = (tick * scrollSpeed) % 1;

          const gaps = rayGaps[ri];

          ctx.save();
          ctx.lineWidth = Math.max(0.5, 1.8 - tFraction * 1.2);
          ctx.shadowBlur = 6 - tFraction * 4;
          ctx.shadowColor = "rgba(180,170,255,0.6)";

          // Walk down the ray in small steps, drawing segments based on gap table
          const STEP = 3;
          let drawing = false;
          let pathStarted = false;

          ctx.beginPath();

          for (let py = 0; py < H; py += STEP) {
            const tY = py / H;

            // Vertical fade — outer rays vanish before bottom
            if (tY > vertFade) {
              if (pathStarted) { ctx.stroke(); ctx.beginPath(); pathStarted = false; }
              break;
            }

            // Determine visibility from scrolled gap table
            const scrolledT = (tY + scrollOffset) % 1;
            let visible = false;
            for (const g of gaps) {
              if (scrolledT >= g.start && scrolledT <= g.end) { visible = true; break; }
            }

            const x = cx + side * maxOffset * Math.pow(tY, EXPONENT);

            // Brightness along the ray: fade top-in and fade toward end
            const topFade = Math.min(1, tY / 0.05);
            const bottomFade = Math.max(0, 1 - tY / vertFade);
            const alpha = brightness * topFade * bottomFade * pulse * (visible ? 1 : 0);

            if (alpha < 0.01) {
              if (pathStarted) { ctx.stroke(); ctx.beginPath(); pathStarted = false; }
              drawing = false;
              continue;
            }

            // Colour: inner = white-blue, outer = deeper purple
            const r = Math.round(180 + (1 - tFraction) * 75);
            const g2 = Math.round(170 + (1 - tFraction) * 85);
            const b = 255;
            ctx.strokeStyle = `rgba(${r},${g2},${b},${alpha.toFixed(3)})`;

            if (!drawing) {
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(x, py);
              pathStarted = true;
            } else {
              ctx.lineTo(x, py);
            }
            drawing = visible;
          }
          if (pathStarted) ctx.stroke();
          ctx.restore();
        }
      }
    }

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const cx = W / 2;

      ctx.clearRect(0, 0, W, H);

      // ── Background ───────────────────────────────────────────────
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "rgba(2, 1, 12, 1)");
      bg.addColorStop(0.5, "rgba(5, 3, 22, 1)");
      bg.addColorStop(1, "rgba(2, 1, 10, 1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Wide fan glow behind all rays ────────────────────────────
      const fanGrad = ctx.createRadialGradient(cx, 0, 0, cx, H * 0.5, W * 0.6);
      fanGrad.addColorStop(0, "rgba(100, 80, 220, 0.22)");
      fanGrad.addColorStop(0.35, "rgba(70, 55, 180, 0.1)");
      fanGrad.addColorStop(0.7, "rgba(40, 30, 120, 0.04)");
      fanGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fanGrad;
      ctx.fillRect(0, 0, W, H);

      // ── Pulse ────────────────────────────────────────────────────
      const pulse = 0.82 + 0.18 * Math.sin(tick * 0.018);
      const fastPulse = 0.93 + 0.07 * Math.sin(tick * 0.09);

      // ── Side rays (drawn BEFORE centre so centre sits on top) ────
      drawSideRays(W, H, cx, pulse * fastPulse);

      // ── Centre beam body ─────────────────────────────────────────
      const beamW = 7;
      const beamGrad = ctx.createLinearGradient(0, 0, 0, H);
      beamGrad.addColorStop(0,    `rgba(255,255,255,${0.95 * pulse * fastPulse})`);
      beamGrad.addColorStop(0.12, `rgba(210,220,255,${0.88 * pulse})`);
      beamGrad.addColorStop(0.4,  `rgba(150,160,255,${0.65 * pulse})`);
      beamGrad.addColorStop(0.72, `rgba(100, 90,220,${0.35 * pulse})`);
      beamGrad.addColorStop(1,    "rgba(50,40,140,0)");

      ctx.save();
      ctx.shadowColor = `rgba(200,190,255,${0.95 * pulse})`;
      ctx.shadowBlur = 22;
      ctx.fillStyle = beamGrad;
      ctx.fillRect(cx - beamW / 2, 0, beamW, H);
      ctx.restore();

      // ── Centre core (sharp white inner line) ─────────────────────
      const coreGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
      coreGrad.addColorStop(0,   `rgba(255,255,255,${pulse * fastPulse})`);
      coreGrad.addColorStop(0.35,`rgba(245,245,255,${0.92 * pulse})`);
      coreGrad.addColorStop(0.75,`rgba(210,210,255,${0.5  * pulse})`);
      coreGrad.addColorStop(1,   "rgba(180,180,255,0)");

      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = coreGrad;
      ctx.fillRect(cx - 1.5, 0, 3, H * 0.7);
      ctx.restore();

      // ── Flowing highlight streaks along centre ───────────────────
      for (let i = 0; i < 6; i++) {
        const offset = (tick * 2.2 + i * (H / 6)) % H;
        const sa = (0.12 + 0.06 * Math.sin(tick * 0.04 + i)) * pulse;
        const sg = ctx.createLinearGradient(0, offset - 50, 0, offset + 50);
        sg.addColorStop(0, "rgba(230,235,255,0)");
        sg.addColorStop(0.5, `rgba(230,235,255,${sa})`);
        sg.addColorStop(1, "rgba(230,235,255,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(cx - 2, offset - 50, 4, 100);
      }

      // ── Ground haze / impact glow ─────────────────────────────────
      const hazeY = H * 0.74;
      const haze = ctx.createRadialGradient(cx, hazeY, 0, cx, hazeY, W * 0.42);
      haze.addColorStop(0,   `rgba(110,100,210,${0.24 * pulse})`);
      haze.addColorStop(0.3, `rgba( 75, 65,170,${0.12 * pulse})`);
      haze.addColorStop(0.7, `rgba( 40, 30,110, 0.05)`);
      haze.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, hazeY - W * 0.42, W, W * 0.84);

      // ── Floor glow ───────────────────────────────────────────────
      const floor = ctx.createRadialGradient(cx, H, 0, cx, H, W * 0.32);
      floor.addColorStop(0,   `rgba(90, 80,190,${0.2 * pulse})`);
      floor.addColorStop(0.5, `rgba(55, 45,140, 0.08)`);
      floor.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = floor;
      ctx.fillRect(0, H * 0.62, W, H * 0.38);

      tick++;
      animFrame = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}
