"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Typewriter from "./Typewriter";
import { LANGUAGES, getLang } from "../_constants/languages";

export type ArmPhase = "neutral" | "shrug" | "wave";

// ── Character pools ───────────────────────────────────────────────────────────
const CHARS = {
  devanagari: "अआइईउकखगघचछजझटडतदनपबमयरलवशषसह",
  arabic:     "ابتثجحخدذرزسشصطعغفقكلمنهوي",
  runic:      "ᚠᚢᚦᚨᚱᚲᚷᚹᚾᛁᛃᛇᛊᛏᛒᛖᛗᛚᛜᛞ",
  tamil:      "கசதநபமயரலவழளடணறன",
  glitch:     "░▒▓█▄▀■□●○◆◇★☆▲▼",
};
const ALL_CHARS = Object.values(CHARS).join("");

type CommPhase =
  | "devanagari" | "arabic" | "runic" | "tamil"
  | "all_flash" | "glitch" | "prompt_button" | "picker" | "reaction";

const PHASE_CHARS: Partial<Record<CommPhase, string>> = {
  devanagari: CHARS.devanagari,
  arabic:     CHARS.arabic,
  runic:      CHARS.runic,
  tamil:      CHARS.tamil,
  all_flash:  ALL_CHARS,
  glitch:     CHARS.glitch,
};

// Question marks from different scripts — cycle in the prompt button
const QM_CYCLE = ["？", "؟", "?", "ᛉ", "?", "？", "؟", "?"];

const TITLE_GLYPHS = ["ᚠ", "ॐ", "ع", "ழ", "Б", "∞", "△", "◈", "✦", "ক"];

interface Props {
  onLangSelected: (code: string) => void;
  onArmPhase: (p: ArmPhase) => void;
  alienScreenPosRef: React.MutableRefObject<{ x: number; y: number }>;
}

export default function AlienComm({ onLangSelected, onArmPhase, alienScreenPosRef }: Props) {
  const [commLine, setCommLine]         = useState("");
  const [phase, setPhase]               = useState<CommPhase>("devanagari");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [titleGlyph, setTitleGlyph]     = useState(TITLE_GLYPHS[0]);
  const [reactionText, setReactionText] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [qmIndex, setQmIndex]           = useState(0);

  const phaseRef = useRef<CommPhase>("devanagari");
  phaseRef.current = phase;

  // Bubble outer wrapper — RAF loop writes left/top directly to avoid re-renders
  const bubbleRef = useRef<HTMLDivElement>(null);

  const rand = useCallback((chars: string, len = 14) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  []);

  // ── RAF: keep speech bubble pinned to the alien's projected screen pos ────
  useEffect(() => {
    let raf: number;
    const sync = () => {
      if (bubbleRef.current) {
        const { x, y } = alienScreenPosRef.current;
        // Only position once the canvas has projected at least one frame
        if (x > 0) {
          bubbleRef.current.style.left = `${x + 80}px`;
          bubbleRef.current.style.top  = `${y - 40}px`;
        }
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [alienScreenPosRef]);

  // ── Cycling comm text ─────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const pool = PHASE_CHARS[phaseRef.current];
      if (pool) setCommLine(rand(pool));
    }, 120);
    return () => clearInterval(iv);
  }, [rand]);

  // ── Phase timeline ────────────────────────────────────────────────────────
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    at(() => setPhase("arabic"),    1500);
    at(() => setPhase("runic"),     3000);
    at(() => setPhase("tamil"),     4500);
    at(() => setPhase("all_flash"), 6000);
    at(() => setPhase("glitch"),    7000);
    at(() => {
      onArmPhase("shrug");
      setPhase("prompt_button"); // show pulsing "?" button — user must click to open grid
    }, 7800);

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Question mark char cycling ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "prompt_button") return;
    const iv = setInterval(() => setQmIndex((i) => (i + 1) % QM_CYCLE.length), 400);
    return () => clearInterval(iv);
  }, [phase]);

  // ── Title glyph cycling → resolves to "?" once picker grid is open ────────
  useEffect(() => {
    if (!pickerVisible || selectedCode) return;
    let n = 0;
    const iv = setInterval(() => {
      n++;
      if (n > 16) { setTitleGlyph("?"); clearInterval(iv); return; }
      setTitleGlyph(TITLE_GLYPHS[Math.floor(Math.random() * TITLE_GLYPHS.length)]);
    }, 75);
    return () => clearInterval(iv);
  }, [pickerVisible, selectedCode]);

  function handleButtonClick() {
    setPhase("picker");
    setPickerVisible(true);
  }

  function handleSelect(code: string) {
    setSelectedCode(code);
    setPickerVisible(false);
    onArmPhase("wave");
    setPhase("reaction");
    setReactionText(getLang(code).greeting);
  }

  function handleReactionDone() {
    setTimeout(() => onLangSelected(selectedCode!), 1100);
  }

  const showBubble   = phase !== "picker";
  const showCommText = !!PHASE_CHARS[phase];
  const showButton   = phase === "prompt_button";
  const showReaction = phase === "reaction" && !!reactionText;

  // Bubble needs pointer events only when the button is visible
  const bubblePointer = showButton ? "auto" : "none";

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 40 }}>

      {/* ── Speech bubble — position tracked via RAF from alienScreenPosRef ──── */}
      <div ref={bubbleRef} style={{ position: "absolute", pointerEvents: bubblePointer }}>
        <AnimatePresence>
          {showBubble && (
            <motion.div
              key={phase === "reaction" ? "bubble-reaction" : "bubble-comm"}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.38 }}
              style={{
                position: "relative",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 12,
                padding: "10px 14px",
                maxWidth: 220,
                minWidth: 130,
                fontSize: 15,
                color: "#eaf2ff",
                backdropFilter: "blur(6px)",
                fontFamily: showCommText ? "monospace" : "system-ui, sans-serif",
                whiteSpace: showCommText ? "nowrap" : "normal",
                lineHeight: 1.55,
                boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
              }}
            >
              {/* Left-pointing triangle toward alien */}
              <div
                style={{
                  position: "absolute",
                  left: -8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 0,
                  height: 0,
                  borderTop: "7px solid transparent",
                  borderBottom: "7px solid transparent",
                  borderRight: "8px solid rgba(255,255,255,0.15)",
                }}
              />

              {/* Cycling script characters */}
              {showCommText && (
                <span style={{ letterSpacing: "0.08em", textShadow: "0 0 8px rgba(180,150,255,0.55)" }}>
                  {commLine}
                </span>
              )}

              {/* Pulsing "?" button — shown after alien gives up */}
              {showButton && (
                <div style={{ textAlign: "center" }}>
                  <motion.button
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    onClick={handleButtonClick}
                    style={{
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: 20,
                      padding: "8px 20px",
                      color: "#eaf2ff",
                      fontSize: 18,
                      cursor: "pointer",
                      fontFamily: "serif",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.6)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
                    }}
                  >
                    {QM_CYCLE[qmIndex]}
                  </motion.button>
                </div>
              )}

              {/* Greeting text via Typewriter — shown after language selection */}
              {showReaction && (
                <Typewriter
                  text={reactionText}
                  speed={42}
                  onComplete={handleReactionDone}
                  style={{ fontSize: 14 }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Holographic language picker — slides in from right after button click */}
      <AnimatePresence>
        {pickerVisible && (
          <motion.div
            key="picker"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{
              position: "absolute",
              right: "5%",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "auto",
            }}
          >
            {/* Scanlines */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                background:
                  "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(80,50,200,0.018) 3px,rgba(80,50,200,0.018) 4px)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            <motion.div
              animate={{
                boxShadow: [
                  "0 0 30px rgba(120,80,255,0.2), inset 0 0 30px rgba(80,50,200,0.05)",
                  "0 0 55px rgba(180,100,255,0.38), inset 0 0 40px rgba(100,60,220,0.1)",
                  "0 0 30px rgba(120,80,255,0.2), inset 0 0 30px rgba(80,50,200,0.05)",
                ],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "relative",
                background: "rgba(6,4,20,0.84)",
                backdropFilter: "blur(28px)",
                border: "1px solid rgba(140,90,255,0.3)",
                borderRadius: 20,
                padding: "22px 18px 24px",
                width: "clamp(280px, 44vw, 380px)",
                zIndex: 2,
              }}
            >
              {/* Resolving title glyph */}
              <div
                style={{
                  textAlign: "center",
                  marginBottom: 16,
                  fontSize: 26,
                  color: "rgba(200,170,255,0.82)",
                  fontFamily: "serif",
                  letterSpacing: "0.3em",
                  textShadow: "0 0 14px rgba(180,150,255,0.5)",
                  minHeight: 36,
                }}
              >
                {titleGlyph}
              </div>

              {/* Language grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(140,90,255,0.15)",
                      borderRadius: 11,
                      padding: "11px 6px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      color: "#fff",
                      fontFamily: "system-ui, sans-serif",
                      transition: "background 0.15s, border-color 0.15s, transform 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "rgba(140,90,255,0.16)";
                      el.style.borderColor = "rgba(200,160,255,0.45)";
                      el.style.transform = "scale(1.06)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = "rgba(255,255,255,0.04)";
                      el.style.borderColor = "rgba(140,90,255,0.15)";
                      el.style.transform = "scale(1)";
                    }}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{lang.flag}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 1.3 }}>
                      {lang.nativeName}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
