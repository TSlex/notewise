"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSessionTimer(running: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const accumulatedRef = useRef(0);
  const activeSinceRef = useRef<number | null>(null);
  const runningRef = useRef(running);

  const readElapsed = useCallback(() => {
    if (activeSinceRef.current === null) return accumulatedRef.current;
    return (
      accumulatedRef.current +
      performance.now() -
      activeSinceRef.current
    );
  }, []);

  useEffect(() => {
    runningRef.current = running;
    if (running && activeSinceRef.current === null) {
      activeSinceRef.current = performance.now();
    }
    if (!running && activeSinceRef.current !== null) {
      accumulatedRef.current = readElapsed();
      activeSinceRef.current = null;
      setElapsedMs(accumulatedRef.current);
    }

    if (!running) return;
    const interval = window.setInterval(() => {
      setElapsedMs(readElapsed());
    }, 250);
    return () => window.clearInterval(interval);
  }, [readElapsed, running]);

  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    activeSinceRef.current = runningRef.current ? performance.now() : null;
    setElapsedMs(0);
  }, []);

  return { elapsedMs, readElapsed, reset };
}
