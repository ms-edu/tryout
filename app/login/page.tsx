"use client";
// app/login/page.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginStudent } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/lib/examStore";

const schema = z.object({
  nis: z.string().min(5, "NIS minimal 5 karakter").max(20, "NIS terlalu panjang"),
  pin: z.string().optional(),
  token: z.string().min(6, "Token minimal 6 karakter").toUpperCase(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    try {
      const authData = await loginStudent(data.nis, data.pin);

      // Get student profile
      const { data: student, error: sErr } = await supabase
        .from("students")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (sErr || !student) throw new Error("Data siswa tidak ditemukan");

      setAuth(authData.user, "student", student);

      // Store token in session (not localStorage)
      sessionStorage.setItem("exam_token", data.token);
      router.push("/exam");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg">
            <svg className="w-12 h-12 text-blue-800" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 2.18L19.73 9 12 12.82 4.27 9 12 5.18zM3 10.68l9 4.91 9-4.91V17H3v-6.32z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">TRYOUT SD/MI</h1>
          <p className="text-blue-200 mt-1">Computer Based Test System</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Login Peserta</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NIS (Nomor Induk Siswa)</label>
              <input
                {...register("nis")}
                type="text"
                inputMode="numeric"
                placeholder="Masukkan NIS Anda"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                autoComplete="off"
              />
              {errors.nis && <p className="text-red-500 text-sm mt-1">{errors.nis.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN (opsional)</label>
              <input
                {...register("pin")}
                type="password"
                placeholder="Masukkan PIN jika ada"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token Ujian</label>
              <input
                {...register("token")}
                type="text"
                placeholder="Masukkan token dari pengawas"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-mono tracking-widest uppercase"
                autoComplete="off"
                maxLength={10}
              />
              {errors.token && <p className="text-red-500 text-sm mt-1">{errors.token.message}</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold rounded-lg transition-colors text-lg mt-2"
            >
              {loading ? "Memverifikasi..." : "Mulai Ujian"}
            </button>
          </form>
        </div>

        <p className="text-center text-blue-200 text-sm mt-6">
          Hubungi pengawas jika mengalami kendala
        </p>
      </div>
    </main>
  );
}
