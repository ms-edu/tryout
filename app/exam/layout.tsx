// app/exam/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ujian Berlangsung | CBT SD/MI",
  robots: { index: false, follow: false },
};

export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Prevent caching of exam pages */}
      <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
      <meta httpEquiv="Pragma" content="no-cache" />
      <meta httpEquiv="Expires" content="0" />
      {children}
    </>
  );
}
