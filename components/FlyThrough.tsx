"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type FlyThroughProps = {
  start?: boolean;
  selectedLang?: string | null;
  onDone?: () => void;
};

export default function FlyThrough({ start = false, selectedLang = null, onDone }: FlyThroughProps) {
  const router = useRouter();
  const runningRef = useRef(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // Prevent multiple executions
    if (!start || runningRef.current) return;
    
    runningRef.current = true;
    console.log("Starting fly-through sequence with language:", selectedLang);

    // Clear any existing timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];

    const executeSequence = async () => {
      try {
        // Step 1: Navigate to universe (wait 3 seconds)
        console.log("Step 1: Navigating to universe...");
        router.push(`/universe?lang=${encodeURIComponent(selectedLang || 'English')}&flythrough=true`);
        
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 3000);
          timersRef.current.push(timer);
        });

        // Step 2: Navigate to solar-system (wait 3 seconds)
        console.log("Step 2: Navigating to solar-system...");
        router.push(`/solar-system?lang=${encodeURIComponent(selectedLang || 'English')}&flythrough=true`);
        
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 3000);
          timersRef.current.push(timer);
        });

        // Step 3: Navigate to earth (final destination)
        console.log("Step 3: Navigating to earth...");
        router.push(`/earth?lang=${encodeURIComponent(selectedLang || 'English')}`);

        // Complete the sequence
        console.log("Fly-through sequence completed");
        runningRef.current = false;
        onDone && onDone();

      } catch (error) {
        console.error("Error in fly-through sequence:", error);
        runningRef.current = false;
        onDone && onDone();
      }
    };

    executeSequence();

    // Cleanup function
    return () => {
      console.log("Cleaning up fly-through component");
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current = [];
      runningRef.current = false;
    };
  }, [start]); // Only depend on start, not on selectedLang or other props

  // Don't render anything - just handle navigation
  return null;
}
