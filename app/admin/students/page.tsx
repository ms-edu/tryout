"use client";
// app/admin/students/page.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import AdminSidebar from "@/components/AdminSidebar";
import * as XLSX from "xlsx";

interface Student {
  id: string; nis: string; full_name: string; class_name: string | null;
  is_active: boolean; academic_years: { name: string } | null;
}

interface AcademicYear { id: string; name: string; }

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    supabase.from("academic_years").select("id, name").order("name").then(({ data }) => {
      if (data) { setYears(data); if (data.length > 0) setSelectedYear(data[0].id); }
    });
  }, []);

  useEffect(() => { if (selectedYear) loadStudents(); }, [selectedYear]);

  const loadStudents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("students")
      .select("*, academic_years(name)")
      .eq("academic_year_id", selectedYear)
      .order("class_name", { ascending: true })
      .order("full_name");
    if (data) setStudents(data as Student[]);
    setLoading(false);
  };

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.nis.includes(search) ||
    (s.class_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedYear) return;

    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      // Get Supabase auth admin to create users
      let success = 0;
      for (const row of rows) {
        const nis = String(row.nis || row.NIS || "").trim();
        const fullName = String(row.nama || row.full_name || row.Nama || "").trim();
        const className = String(row.kelas || row.class_name || row.Kelas || "").trim();
        const pin = String(row.pin || row.PIN || nis).trim();

        if (!nis || !fullName) continue;
        try {
          // Create auth user via admin API (requires service role)
          const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
            email: `${nis}@cbt.local`,
            password: pin,
            email_confirm: true,
          });

          if (authErr) {
            // Skip if user already exists
            if (!authErr.message.includes("already")) console.error(authErr.message);
            continue;
          }

          // Create student record
          await supabase.from("students").upsert({
            id: authUser.user.id,
            academic_year_id: selectedYear,
            nis,
            full_name: fullName,
            class_name: className || null,
            is_active: true,
          }, { onConflict: "nis" });
          success++;
        } catch {}
      }

      alert(`Berhasil mengimpor ${success} siswa`);
      loadStudents();
    } catch (err: any) {
      alert("Gagal import: " + err.message);
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const downloadTemplate = () => {
    const template = [
      { nis: "1234567890", nama: "Ahmad Budi Santoso", kelas: "6A", pin: "123456" },
      { nis: "1234567891", nama: "Siti Rahayu", kelas: "6A", pin: "654321" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");
    XLSX.writeFile(wb, "template_siswa.xlsx");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("students").update({ is_active: !current }).eq("id", id);
    loadStudents();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Data Siswa</h1>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="px-3 py-2 text-sm border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">
              ⬇ Template
            </button>
            <label className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
              {importing ? "Mengimpor..." : "⬆ Import Excel"}
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} disabled={importing} />
            </label>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4 flex flex-wrap gap-3">
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <input type="text" placeholder="Cari nama, NIS, atau kelas..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
          <span className="text-sm text-gray-500 self-center">{filtered.length} siswa</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["NIS", "Nama", "Kelas", "Status", "Aksi"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Memuat data...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Tidak ada data siswa</td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{s.nis}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.class_name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {s.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(s.id, s.is_active)} className="text-xs text-gray-500 hover:text-gray-800 underline">
                        {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
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
