// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4">
      <div className="text-center text-white">
        <div className="text-8xl font-bold text-blue-400 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Halaman Tidak Ditemukan</h1>
        <p className="text-blue-200 mb-8">Halaman yang Anda cari tidak tersedia.</p>
        <Link href="/login" className="px-6 py-3 bg-white text-blue-900 font-bold rounded-lg hover:bg-blue-50 transition-colors">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
