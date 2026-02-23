"use client";
// app/admin/dashboard/page.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminSidebar from "@/components/AdminSidebar";

interface DashboardStats {
  exam_id: string;
  title: string;
  status: string;
  total_attempts: number;
  total_submitted: number;
  total_active: number;
  total_expired: number;
  avg_score: number | null;
  max_score: number | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    const { data } = await supabase.from("exam_stats").select("*").order("exam_id");
    if (data) setStats(data as DashboardStats[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();

    // Realtime subscription
    const channel = supabase
      .channel("dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalActive = stats.reduce((s, e) => s + (e.total_active || 0), 0);
  const totalSubmitted = stats.reduce((s, e) => s + (e.total_submitted || 0), 0);
  const totalAll = stats.reduce((s, e) => s + (e.total_attempts || 0), 0);

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Peserta Aktif", value: totalActive, color: "blue", icon: "👥" },
            { label: "Sudah Submit", value: totalSubmitted, color: "green", icon: "✅" },
            { label: "Total Peserta", value: totalAll, color: "purple", icon: "📊" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
                </div>
                <span className="text-3xl">{card.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Per-exam breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-700">Status Per Ujian</h2>
            <div className="flex items-center gap-2 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Realtime
            </div>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat data...</div>
          ) : stats.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Belum ada data ujian</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Ujian", "Status", "Aktif", "Submit", "Expired", "Avg Score", "Max"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.map((exam) => (
                    <tr key={exam.exam_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{exam.title}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          exam.status === "active" ? "bg-green-100 text-green-700" :
                          exam.status === "closed" ? "bg-gray-100 text-gray-600" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {exam.status === "active" ? "Aktif" : exam.status === "closed" ? "Ditutup" : "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-600 font-semibold">{exam.total_active || 0}</td>
                      <td className="px-4 py-3 text-green-600 font-semibold">{exam.total_submitted || 0}</td>
                      <td className="px-4 py-3 text-red-500">{exam.total_expired || 0}</td>
                      <td className="px-4 py-3">{exam.avg_score != null ? exam.avg_score.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 font-semibold">{exam.max_score != null ? exam.max_score.toFixed(0) : "—"}</td>
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
