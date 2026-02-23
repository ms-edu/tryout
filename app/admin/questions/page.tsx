"use client";
// app/admin/questions/page.tsx
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getQuestions, createQuestion, updateQuestion, deleteQuestion } from "@/lib/api";
import AdminSidebar from "@/components/AdminSidebar";
import * as XLSX from "xlsx";

interface Question {
  id: string; exam_id: string; question_number: number; content: string;
  image_url: string | null; option_a: string; option_b: string; option_c: string;
  option_d: string; correct_option: string; type: string; shuffle_options: boolean;
}

interface Exam { id: string; title: string; status: string; }

export default function QuestionsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [form, setForm] = useState({ content: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", type: "literasi", shuffle_options: true });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("exams").select("id, title, status").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) { setExams(data); if (data.length > 0) setSelectedExam(data[0].id); }
    });
  }, []);

  useEffect(() => {
    if (selectedExam) loadQuestions();
  }, [selectedExam]);

  const loadQuestions = async () => {
    if (!selectedExam) return;
    const data = await getQuestions(selectedExam);
    setQuestions(data || []);
  };

  const handleSubmit = async () => {
    if (!selectedExam || !form.content) return;
    setLoading(true);
    try {
      if (editingQ) {
        await updateQuestion(editingQ.id, form);
      } else {
        const nextNum = Math.max(0, ...questions.map((q) => q.question_number)) + 1;
        await createQuestion({ exam_id: selectedExam, question_number: nextNum, ...form });
      }
      setShowForm(false);
      setEditingQ(null);
      setForm({ content: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "a", type: "literasi", shuffle_options: true });
      loadQuestions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus soal ini?")) return;
    await deleteQuestion(id);
    loadQuestions();
  };

  const handleEdit = (q: Question) => {
    setEditingQ(q);
    setForm({ content: q.content, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, type: q.type, shuffle_options: q.shuffle_options });
    setShowForm(true);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExam) return;

    setImportLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      let successCount = 0;
      let startNum = Math.max(0, ...questions.map((q) => q.question_number)) + 1;

      for (const row of rows) {
        if (!row.content && !row.soal) continue;
        try {
          await createQuestion({
            exam_id: selectedExam,
            question_number: startNum++,
            content: row.content || row.soal || "",
            option_a: row.option_a || row.a || "",
            option_b: row.option_b || row.b || "",
            option_c: row.option_c || row.c || "",
            option_d: row.option_d || row.d || "",
            correct_option: (row.correct_option || row.kunci || "a").toLowerCase(),
            type: row.type || row.tipe || "literasi",
            shuffle_options: row.shuffle_options !== false,
          });
          successCount++;
        } catch {}
      }

      alert(`Berhasil mengimpor ${successCount} soal`);
      loadQuestions();
    } catch (err: any) {
      alert("Gagal import: " + err.message);
    } finally {
      setImportLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const template = [
      { soal: "Contoh soal literasi: Bacalah teks berikut...", a: "Pilihan A", b: "Pilihan B", c: "Pilihan C", d: "Pilihan D", kunci: "a", tipe: "literasi" },
      { soal: "Contoh soal numerasi: Berapa hasil dari 2 + 3?", a: "4", b: "5", c: "6", d: "7", kunci: "b", tipe: "numerasi" },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Soal");
    XLSX.writeFile(wb, "template_soal.xlsx");
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Kelola Soal</h1>
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              ⬇ Template Excel
            </button>
            <label className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer">
              {importLoading ? "Mengimpor..." : "⬆ Import Excel"}
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} disabled={!selectedExam || importLoading} />
            </label>
            <button onClick={() => { setEditingQ(null); setShowForm(!showForm); }} className="px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800">
              + Tambah Soal
            </button>
          </div>
        </div>

        {/* Exam selector */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Ujian</label>
          <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.status})</option>)}
          </select>
          {selectedExam && <p className="text-sm text-gray-500 mt-1">{questions.length} soal tersedia</p>}
        </div>

        {/* Add/edit form */}
        {showForm && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="font-bold text-gray-700 mb-4">{editingQ ? "Edit Soal" : "Tambah Soal Baru"}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pertanyaan</label>
                <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tulis soal di sini..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {["a", "b", "c", "d"].map((opt) => (
                  <div key={opt}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilihan {opt.toUpperCase()}</label>
                    <input value={(form as any)[`option_${opt}`]} onChange={(e) => setForm({ ...form, [`option_${opt}`]: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kunci Jawaban</label>
                  <select value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {["a", "b", "c", "d"].map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="literasi">Literasi</option>
                    <option value="numerasi">Numerasi</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 disabled:opacity-50">
                  {loading ? "Menyimpan..." : (editingQ ? "Update" : "Simpan")}
                </button>
                <button onClick={() => { setShowForm(false); setEditingQ(null); }} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Batal</button>
              </div>
            </div>
          </div>
        )}

        {/* Questions list */}
        <div className="space-y-3">
          {questions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-400 shadow-sm border border-gray-100">Belum ada soal. Tambahkan soal atau import dari Excel.</div>
          ) : questions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">#{q.question_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${q.type === "numerasi" ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700"}`}>{q.type}</span>
                    <span className="text-xs text-gray-400">Kunci: <strong>{q.correct_option.toUpperCase()}</strong></span>
                  </div>
                  <p className="text-gray-800 text-sm mb-2 line-clamp-2">{q.content}</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                    <span>A: {q.option_a}</span>
                    <span>B: {q.option_b}</span>
                    <span>C: {q.option_c}</span>
                    <span>D: {q.option_d}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(q)} className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200">Edit</button>
                  <button onClick={() => handleDelete(q.id)} className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200">Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
