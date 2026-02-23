// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format milliseconds to HH:MM:SS
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Format date to Indonesian locale
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Generate random token
export function generateExamToken(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Score to grade
export function scoreToGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: "A", color: "text-green-600" };
  if (score >= 80) return { grade: "B", color: "text-blue-600" };
  if (score >= 70) return { grade: "C", color: "text-yellow-600" };
  if (score >= 60) return { grade: "D", color: "text-orange-600" };
  return { grade: "E", color: "text-red-600" };
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

// Deep clone object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Check if window is available (SSR safe)
export const isBrowser = typeof window !== "undefined";

// Register service worker
export async function registerSW(): Promise<void> {
  if (!isBrowser || !("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.warn("SW registration failed:", err);
  }
}

// Register background sync
export async function registerBackgroundSync(tag: string): Promise<void> {
  if (!isBrowser || !("serviceWorker" in navigator) || !("SyncManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register(tag);
  } catch (err) {
    console.warn("Background sync registration failed:", err);
  }
}

// Export array to CSV string
export function arrayToCSV(data: Record<string, any>[]): string {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = String(row[h] ?? "");
      return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}

// Download string as file
export function downloadFile(content: string, filename: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
