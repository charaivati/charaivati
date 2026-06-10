// components/brand/Wordmark.tsx
// The ONE canonical Charaivati wordmark. Every layout/header must render the
// logo through this component so the font/gradient stays identical everywhere.
import Link from "next/link";
import React from "react";

const SIZES = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-4xl sm:text-5xl",
} as const;

export default function Wordmark({
  size = "md",
  href,
  className = "",
}: {
  size?: keyof typeof SIZES;
  href?: string;
  className?: string;
}) {
  const mark = (
    <span
      className={`font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent ${SIZES[size]} ${className}`}
    >
      Charaivati
    </span>
  );
  if (!href) return mark;
  return (
    <Link href={href} className="no-underline">
      {mark}
    </Link>
  );
}
