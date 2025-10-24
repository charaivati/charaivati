// app/components/AudioSynth.tsx
'use client';
import { useEffect, useRef } from 'react';

type Props = {
  playKey?: number;
  onTime?: (t: number) => void;
  onEnded?: () => void;
  duration?: number; // seconds
};

export default function AudioSynth({ playKey = 0, onTime, onEnded, duration = 4.5 }: Props) {
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);

  useEffect(() => {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      // no web audio available
      if (onEnded) setTimeout(() => onEnded(), duration * 1000);
      return;
    }

    const ctx = new AudioContextClass();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // Create bursts (shorter, denser for 4-5s clip)
    function makeBurst(time: number, dur: number, baseFreq: number) {
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const env = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      mod.type = 'sine';
      mod.frequency.value = 70 + Math.random() * 90;
      modGain.gain.value = 40 + Math.random() * 100;
      mod.connect(modGain);

      osc.type = Math.random() > 0.5 ? 'sawtooth' : 'square';
      osc.frequency.value = baseFreq + (Math.random() - 0.5) * 30;
      modGain.connect(osc.frequency);

      filter.type = 'bandpass';
      filter.frequency.value = 400 + Math.random() * 2000;
      filter.Q.value = 6 + Math.random() * 6;

      osc.connect(filter);
      filter.connect(env);
      env.connect(master);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(1.0, time + Math.min(0.02, dur * 0.2));
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.start(time);
      mod.start(time);
      osc.stop(time + dur + 0.02);
      mod.stop(time + dur + 0.02);
    }

    function makeNoiseBurst(time: number, dur: number) {
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (0.6 * Math.exp(-i / (bufferSize * 0.6)));
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 700;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start(time);
      src.stop(time + dur + 0.02);
    }

    const now = ctx.currentTime + 0.04;
    startAtRef.current = now;
    let cursor = now;
    const total = Math.max(1.5, duration);

    while (cursor < now + total - 0.05) {
      const burstDur = 0.08 + Math.random() * 0.28;
      const baseFreq = 180 + Math.random() * 600;
      makeBurst(cursor, burstDur, baseFreq);
      if (Math.random() > 0.5) makeNoiseBurst(cursor + burstDur * 0.25, 0.04 + Math.random() * 0.12);
      cursor += burstDur * (0.7 + Math.random() * 0.9);
    }

    // schedule ended callback
    const stopTime = now + total + 0.05;
    const stopper = setTimeout(() => {
      try { onEnded && onEnded(); } catch {}
    }, Math.max(0, (stopTime - ctx.currentTime) * 1000));

    // polling for onTime
    function tick() {
      const s = ctxRef.current ? (ctxRef.current.currentTime - (startAtRef.current ?? 0)) : 0;
      if (onTime) onTime(Math.max(0, s));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      clearTimeout(stopper);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { ctx.close(); } catch {}
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]); // restart when playKey changes

  return null;
}
