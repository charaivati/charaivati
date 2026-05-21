"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  text: string;
  speed?: number;
  onComplete?: () => void;
  style?: React.CSSProperties;
}

export default function Typewriter({ text, speed = 42, onComplete, style }: Props) {
  const [index, setIndex] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Reset and retype whenever text changes
  useEffect(() => {
    setIndex(0);
    if (!text) return;
    let i = 0;
    const iv = setInterval(() => {
      i += 1;
      setIndex(i);
      if (i >= text.length) {
        clearInterval(iv);
        setTimeout(() => onCompleteRef.current?.(), 0);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  // Blinking cursor
  useEffect(() => {
    const iv = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(iv);
  }, []);

  const done = index >= text.length;

  return (
    <span style={style}>
      {text.slice(0, index)}
      <span
        style={{
          display: "inline-block",
          width: 2,
          height: "0.9em",
          background: "currentColor",
          marginLeft: 2,
          verticalAlign: "middle",
          opacity: done ? 0 : cursorOn ? 1 : 0,
          transition: "opacity 0.05s",
        }}
      />
    </span>
  );
}
