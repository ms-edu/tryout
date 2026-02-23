"use client";
// app/admin/exams/page.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { createExam, updateExamStatus, generateToken } from "@/lib/api";
import AdminSidebar from "@/components/AdminSidebar";
import { useForm } from "react-hook-form";

interface Exam {
  id: string; title: string; token: string; duration_minutes: number;
  total_questions: number; start_time: string; end_time: string;
  status: "draft" | "active" | "closed"; academic_years: { name: string } | null;
}

interface AcademicYear { id: string; name: string; }

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{
    academic_year_id: string; title: string; duration_minutes: number;
    total_questions: number; start_time: string; end_time: string; description?: string;
  }>();

  const fetchData = async () => {
    const [{ data: examData }, { data: yearData }] = await Promise.all([
      supabase.from("exams").select("*, academic_years(name)").order("created_at", { ascending: false }),
      supabase.from("academic_years").select("id, name").order("name"),
    ]);
    if (examData) setExams(examData as Exam[]);
    if (yearData) setYears(yearData);
  };

  useEffect(() => { fetchData(); }, []);

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await createExam({ ...data, duration_minutes: Number(data.duration_minutes), total_questions: Number(data.total_questions) });
      reset();
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: "draft" | "active" | "closed") => {
    try {
      await updateExamStatus(id, status);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const statusLabel = (s: string) => ({ draft: "Draft", active: "Aktif", closed: "Ditutup" }[s] || s);
  const statusColor = (s: string) => ({ draft: "bg-yellow-100 text-yellow-700", active: "bg-green-100 text-green-700", closed: "bg-gray-100 text-gray-600" }[s] || "");

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Kelola Ujian</h1>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800">
            + Buat Ujian
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="font-bold text-gray-700 mb-4">Buat Ujian Baru</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Akademik</label>
                <select {...register("academic_year_id", { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Pilih --</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Ujian</label>
                <input {...register("title", { required: true })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tryout Semester 1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (menit)</label>
                <input {...register("duration_minutes", { required: true })} type="number" defaultValue={90} min={10} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal</label>
                <input {...register("total_questions", { required: true })} type="number" defaultValue={50} min={1} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mulai</label>
                <input {...register("start_time", { required: true })} type="datetime-local" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selesai</label>
                <input {...register("end_time", { required: true })} type="datetime-local" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50">
                  {loading ? "Menyimpan..." : "Buat Ujian"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Batal</button>
              </div>
            </form>
          </div>
        )}

        {/* Exams table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Ujian", "Token", "Durasi", "Waktu", "Status", "Aksi"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {exams.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Belum ada ujian</td></tr>
                ) : exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{exam.title}</div>
                      <div className="text-xs text-gray-400">{exam.academic_years?.name} · {exam.total_questions} soal</div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => copyToken(exam.token)} className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors">
                        {copiedToken === exam.token ? "✓ Disalin!" : exam.token}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{exam.duration_minutes} mnt</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{new Date(exam.start_time).toLocaleString("id-ID")}</div>
                      <div>{new Date(exam.end_time).toLocaleString("id-ID")}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(exam.status)}`}>
                        {statusLabel(exam.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {exam.status === "draft" && (
                          <button onClick={() => handleStatusChange(exam.id, "active")} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Aktifkan</button>
                        )}
                        {exam.status === "active" && (
                          <button onClick={() => handleStatusChange(exam.id, "closed")} className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">Tutup</button>
                        )}
                        {exam.status === "closed" && (
                          <a href={`/admin/ranking?exam=${exam.id}`} className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Ranking</a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
