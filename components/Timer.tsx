"use client";
// components/Timer.tsx
import { useEffect, useRef, useCallback } from "react";
import { useExamStore } from "@/lib/examStore";

interface TimerProps {
  onExpire: () => void;
}

export default function Timer({ onExpire }: TimerProps) {
  const remainingMs = useExamStore((s) => s.remainingMs);
  const setRemainingMs = useExamStore((s) => s.setRemainingMs);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const expiredRef = useRef(false);

  const tick = useCallback(() => {
    setRemainingMs(Math.max(0, remainingMs - 1000));
    if (remainingMs <= 1000 && !expiredRef.current) {
      expiredRef.current = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      onExpire();
    }
  }, [remainingMs, setRemainingMs, onExpire]);

  useEffect(() => {
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tick]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isWarning = totalSeconds <= 600; // 10 minutes
  const isDanger = totalSeconds <= 120; // 2 minutes

  const pad = (n: number) => n.toString().padStart(2, "0");
  const timerClass = isDanger ? "timer-danger" : isWarning ? "timer-warning" : "timer-normal";

  return (
    <div className={`flex items-center gap-2 ${timerClass}`}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-lg font-bold tracking-wider">
        {hours > 0 ? `${pad(hours)}:` : ""}{pad(minutes)}:{pad(seconds)}
      </span>
    </div>
  );
}
