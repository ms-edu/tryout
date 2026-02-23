// lib/api.ts
import { supabase } from "./supabaseClient";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function callEdgeFunction(name: string, body: Record<string, unknown>, method = "POST") {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Terjadi kesalahan server");
  }
  return data;
}

// ---- EXAM / STUDENT ----

export async function startAttempt(token: string) {
  return callEdgeFunction("startAttempt", { token });
}

export async function submitAnswer(
  attemptId: string,
  questionId: string,
  selectedOption: string | null
) {
  return callEdgeFunction("submitAnswer", {
    attempt_id: attemptId,
    question_id: questionId,
    selected_option: selectedOption,
  });
}

export async function finishAttempt(attemptId: string) {
  return callEdgeFunction("finishAttempt", { attempt_id: attemptId });
}

export async function getQuestionByIndex(attemptId: string, index: number) {
  return callEdgeFunction("getQuestion", { attempt_id: attemptId, index });
}

// ---- ADMIN ----

export async function getRanking(examId: string, page = 1, limit = 50) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/getRanking?exam_id=${examId}&page=${page}&limit=${limit}`,
    {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    }
  );
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Gagal mengambil ranking");
  return data;
}

export async function loginStudent(nis: string, pin?: string) {
  // Students login with NIS as email: nis@cbt.local
  const email = `${nis}@cbt.local`;
  const password = pin || nis; // fallback: NIS as password if no PIN

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("NIS atau PIN salah");
  return data;
}

export async function loginAdmin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Email atau password salah");

  // Verify it's an admin
  const { data: admin } = await supabase
    .from("admins")
    .select("id, role, full_name")
    .eq("id", data.user.id)
    .single();

  if (!admin) {
    await supabase.auth.signOut();
    throw new Error("Akun tidak memiliki akses admin");
  }

  return { ...data, admin };
}

export async function logout() {
  await supabase.auth.signOut();
}

// ---- QUESTION MANAGEMENT ----

export async function getQuestions(examId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("exam_id", examId)
    .order("question_number");
  if (error) throw error;
  return data;
}

export async function createQuestion(question: {
  exam_id: string;
  question_number: number;
  content: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  type?: string;
  shuffle_options?: boolean;
  image_url?: string;
}) {
  const { data, error } = await supabase.from("questions").insert(question).select().single();
  if (error) throw error;
  return data;
}

export async function updateQuestion(id: string, updates: Partial<{
  content: string; option_a: string; option_b: string; option_c: string;
  option_d: string; correct_option: string; type: string; shuffle_options: boolean;
}>) {
  const { data, error } = await supabase.from("questions").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteQuestion(id: string) {
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw error;
}

// ---- EXAM MANAGEMENT ----

export async function getExams(academicYearId?: string) {
  let query = supabase.from("exams").select("*, academic_years(name)").order("created_at", { ascending: false });
  if (academicYearId) query = query.eq("academic_year_id", academicYearId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createExam(exam: {
  academic_year_id: string;
  title: string;
  duration_minutes: number;
  total_questions: number;
  start_time: string;
  end_time: string;
  description?: string;
}) {
  const token = generateToken();
  const { data, error } = await supabase
    .from("exams")
    .insert({ ...exam, token, status: "draft" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExamStatus(id: string, status: "draft" | "active" | "closed") {
  const { data, error } = await supabase.from("exams").update({ status }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export function generateToken(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ---- EXPORT ----

export async function exportResults(examId: string) {
  const { data, error } = await supabase
    .from("exam_ranking")
    .select("*")
    .eq("exam_id", examId)
    .order("rank");
  if (error) throw error;
  return data;
}

export async function exportDetailedAnswers(examId: string) {
  const { data, error } = await supabase
    .from("exam_attempts")
    .select(`
      *,
      students(nis, full_name, class_name),
      exam_answers(question_id, selected_option, is_correct, answered_at)
    `)
    .eq("exam_id", examId)
    .order("score", { ascending: false });
  if (error) throw error;
  return data;
}
