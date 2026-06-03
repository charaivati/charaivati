"use client";
import { useState, useEffect } from "react";

export default function StatusMessages({
  messages,
  intervalMs = 1500,
}: {
  messages: string[];
  intervalMs?: number;
}) {
  const [index, setIndex]     = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % messages.length);
        setVisible(true);
      }, 200);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [messages, intervalMs]);

  return (
    <p style={{
      transition: "opacity 0.2s ease",
      opacity: visible ? 1 : 0,
      fontSize: 14,
      color: "#6B7280",
      margin: 0,
      minHeight: "1.4em",
    }}>
      {messages[index] ?? ""}
    </p>
  );
}
