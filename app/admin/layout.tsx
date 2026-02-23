// app/admin/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel | CBT SD/MI",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Route protection is handled in middleware.ts
  // This layout just wraps admin pages
  return <>{children}</>;
}
