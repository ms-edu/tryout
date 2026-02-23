"use client";
// app/admin/ranking/page.tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getRanking, exportResults, exportDetailedAnswers } from "@/lib/api";
import AdminSidebar from "@/components/AdminSidebar";
import * as XLSX from "xlsx";

interface RankingRow {
  rank: number; attempt_id: string; nis: string; full_name: string;
  class_name: string; score: number; total_correct: number;
  total_answered: number; status: string; finish_time: string;
}

interface Exam { id: string; title: string; status: string; }

export default function RankingPage() {
  const searchParams = useSearchParams();
  const initialExam = searchParams.get("exam") || "";

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState(initialExam);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("exams").select("id, title, status").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) { setExams(data); if (!initialExam && data.length > 0) setSelectedExam(data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (selectedExam) loadRanking();
  }, [selectedExam]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedExam) return;
    const channel = supabase
      .channel("ranking-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts", filter: `exam_id=eq.${selectedExam}` }, () => loadRanking())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedExam]);

  const loadRanking = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const result = await getRanking(selectedExam, 1, 500);
      setRanking(result.ranking || []);
      setStats(result.stats);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    const data = await exportResults(selectedExam);
    if (!data) return;
    const rows = data.map((r: any) => ({
      Rank: r.rank, NIS: r.nis, Nama: r.full_name, Kelas: r.class_name || "-",
      Nilai: r.score?.toFixed(2) || "0", Benar: r.total_correct,
      Dijawab: r.total_answered, Status: r.status,
      Selesai: r.finish_time ? new Date(r.finish_time).toLocaleString("id-ID") : "-",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ranking");
    XLSX.writeFile(wb, `ranking_${selectedExam}.xlsx`);
  };

  const exportDetailed = async () => {
    const data = await exportDetailedAnswers(selectedExam);
    if (!data) return;
    const rows = data.flatMap((attempt: any) =>
      (attempt.exam_answers || []).map((ans: any) => ({
        NIS: attempt.students?.nis, Nama: attempt.students?.full_name,
        Kelas: attempt.students?.class_name || "-",
        Question_ID: ans.question_id, Pilihan: ans.selected_option || "-",
        Benar: ans.is_correct ? "Ya" : "Tidak",
        Nilai_Akhir: attempt.score?.toFixed(2) || "0",
      }))
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detail Jawaban");
    XLSX.writeFile(wb, `detail_${selectedExam}.xlsx`);
  };

  const rankColor = (rank: number) => {
    if (rank === 1) return "bg-yellow-400 text-yellow-900";
    if (rank === 2) return "bg-gray-300 text-gray-800";
    if (rank === 3) return "bg-amber-600 text-white";
    return "bg-gray-100 text-gray-600";
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Ranking Peserta</h1>
          <div className="flex gap-2">
            <button onClick={exportToCSV} className="px-3 py-2 text-sm border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">⬇ Export Ranking</button>
            <button onClick={exportDetailed} className="px-3 py-2 text-sm border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">⬇ Export Detail</button>
            <button onClick={loadRanking} className="px-3 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800">🔄 Refresh</button>
          </div>
        </div>

        {/* Exam selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Aktif", val: stats.total_active, color: "text-blue-600" },
              { label: "Submit", val: stats.total_submitted, color: "text-green-600" },
              { label: "Expired", val: stats.total_expired, color: "text-red-500" },
              { label: "Rata-rata", val: stats.avg_score != null ? stats.avg_score.toFixed(1) : "—", color: "text-purple-600" },
              { label: "Tertinggi", val: stats.max_score != null ? stats.max_score.toFixed(0) : "—", color: "text-yellow-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Ranking table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Realtime · {ranking.length} peserta selesai</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Memuat ranking...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Rank", "NIS", "Nama", "Kelas", "Nilai", "Benar", "Waktu Selesai"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ranking.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada peserta yang selesai</td></tr>
                  ) : ranking.map((row) => (
                    <tr key={row.attempt_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${rankColor(row.rank)}`}>
                          {row.rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-600">{row.nis}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{row.full_name}</td>
                      <td className="px-4 py-3 text-gray-500">{row.class_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-base ${row.score >= 70 ? "text-green-600" : row.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                          {row.score?.toFixed(0) || "0"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{row.total_correct} benar</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {row.finish_time ? new Date(row.finish_time).toLocaleString("id-ID") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
