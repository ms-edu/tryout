"use client";
// components/ExamLayout.tsx
// Wrapper component untuk halaman ujian, berisi logika keamanan dan struktur layout

import { useEffect, ReactNode } from "react";
import { useExamStore, useAuthStore } from "@/lib/examStore";
import Timer from "./Timer";

interface ExamLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  footer: ReactNode;
  onExpire: () => void;
}

export default function ExamLayout({ children, sidebar, footer, onExpire }: ExamLayoutProps) {
  const { remainingMs, isOnline } = useExamStore();
  const { studentData } = useAuthStore();

  // Disable right-click
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockContextMenu);
    return () => document.removeEventListener("contextmenu", blockContextMenu);
  }, []);

  // Disable keyboard shortcuts
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      const blocked = [
        e.key === "F12",
        e.key === "F5" && !e.ctrlKey,
        e.ctrlKey && ["u", "s", "p", "a"].includes(e.key.toLowerCase()),
        e.ctrlKey && e.shiftKey && ["i", "j", "c", "k"].includes(e.key.toLowerCase()),
        e.ctrlKey && e.key.toLowerCase() === "c", // block copy
        e.ctrlKey && e.key.toLowerCase() === "v", // block paste
      ];
      if (blocked.some(Boolean)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", blockKeys, true);
    return () => document.removeEventListener("keydown", blockKeys, true);
  }, []);

  // Disable text selection
  useEffect(() => {
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    return () => {
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, []);

  // Warn on tab switch / window blur (optional: could auto-submit)
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Could log tab switches for suspicious activity
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col select-none">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-2 flex items-center justify-between shadow-md z-20 flex-shrink-0" style={{ height: "56px" }}>
        {/* Left: Student info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-blue-200 text-xs leading-none">Peserta</div>
            <div className="font-semibold text-sm truncate">{studentData?.full_name || "—"}</div>
          </div>
          {studentData?.class_name && (
            <div className="text-blue-300 text-sm hidden sm:block">| Kelas {studentData.class_name}</div>
          )}
        </div>

        {/* Center: Title */}
        <div className="hidden md:block text-center">
          <div className="text-sm font-bold tracking-wide">TRYOUT SD/MI</div>
          <div className="text-blue-300 text-xs">Computer Based Test</div>
        </div>

        {/* Right: Status + Timer */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Online/offline indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${
            isOnline ? "bg-green-600/80" : "bg-red-600/80"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green-300 animate-pulse" : "bg-red-300"}`} />
            <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Timer */}
          {remainingMs > 0 && <Timer onExpire={onExpire} />}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main question area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Right sidebar: navigation grid */}
        <aside className="w-52 bg-white border-l border-gray-200 overflow-y-auto p-3 flex-shrink-0 hidden lg:block">
          {sidebar}
        </aside>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 flex-shrink-0 shadow-sm" style={{ height: "60px" }}>
        {footer}
      </footer>
    </div>
  );
}
