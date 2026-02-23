// supabase/functions/startAttempt/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { token } = await req.json();
    if (!token) throw new Error("Token is required");

    const now = new Date();

    // 1. Validate token & exam
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("token", token.toUpperCase())
      .single();

    if (examError || !exam) throw new Error("Token exam tidak valid");
    if (exam.status !== "active") throw new Error("Ujian belum aktif atau sudah ditutup");
    if (now < new Date(exam.start_time)) throw new Error("Ujian belum dimulai");
    if (now > new Date(exam.end_time)) throw new Error("Waktu ujian sudah berakhir");

    // 2. Validate student
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*")
      .eq("id", user.id)
      .single();

    if (studentError || !student) throw new Error("Data siswa tidak ditemukan");
    if (!student.is_active) throw new Error("Akun siswa tidak aktif");

    // 3. Check if already attempted
    const { data: existingAttempt } = await supabase
      .from("exam_attempts")
      .select("id, status, question_order, expires_at")
      .eq("exam_id", exam.id)
      .eq("student_id", user.id)
      .single();

    if (existingAttempt) {
      if (existingAttempt.status === "submitted") {
        throw new Error("Anda sudah menyelesaikan ujian ini");
      }
      if (existingAttempt.status === "expired") {
        throw new Error("Waktu ujian Anda sudah habis");
      }
      // Resume in-progress attempt
      if (existingAttempt.status === "in_progress") {
        if (new Date(existingAttempt.expires_at) < now) {
          // Auto expire
          await supabase.rpc("expire_timed_out_attempts");
          throw new Error("Waktu ujian Anda sudah habis");
        }

        // Return first unanswered question
        const { data: firstQuestion } = await getNextQuestion(
          supabase,
          existingAttempt.id,
          existingAttempt.question_order as string[],
          0
        );

        const answeredCount = await getAnsweredCount(supabase, existingAttempt.id);
        const remainingMs = new Date(existingAttempt.expires_at).getTime() - now.getTime();

        return new Response(
          JSON.stringify({
            success: true,
            attempt_id: existingAttempt.id,
            question: firstQuestion,
            current_index: answeredCount,
            total_questions: exam.total_questions,
            remaining_ms: remainingMs,
            resumed: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Get random questions for this attempt
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id")
      .eq("exam_id", exam.id)
      .limit(exam.total_questions);

    if (qError || !questions || questions.length === 0) {
      throw new Error("Soal belum tersedia");
    }

    if (questions.length < exam.total_questions) {
      throw new Error(`Soal kurang: tersedia ${questions.length}, dibutuhkan ${exam.total_questions}`);
    }

    // Shuffle using Fisher-Yates
    const questionIds = questions.map((q) => q.id);
    for (let i = questionIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionIds[i], questionIds[j]] = [questionIds[j], questionIds[i]];
    }

    // Take only needed questions
    const selectedIds = questionIds.slice(0, exam.total_questions);

    // 5. Create attempt
    const expiresAt = new Date(now.getTime() + exam.duration_minutes * 60 * 1000);

    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .insert({
        exam_id: exam.id,
        student_id: user.id,
        start_time: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "in_progress",
        question_order: selectedIds,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
        user_agent: req.headers.get("user-agent"),
      })
      .select()
      .single();

    if (attemptError) throw new Error("Gagal membuat sesi ujian: " + attemptError.message);

    // 6. Return first question (without correct answer)
    const firstQuestion = await getQuestionData(supabase, selectedIds[0], exam.id);

    return new Response(
      JSON.stringify({
        success: true,
        attempt_id: attempt.id,
        question: firstQuestion,
        current_index: 0,
        total_questions: exam.total_questions,
        remaining_ms: expiresAt.getTime() - now.getTime(),
        resumed: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getQuestionData(supabase: any, questionId: string, examId: string) {
  const { data: q } = await supabase
    .from("questions")
    .select("id, question_number, content, image_url, option_a, option_b, option_c, option_d, type, shuffle_options, points")
    .eq("id", questionId)
    .eq("exam_id", examId)
    .single();

  if (!q) return null;

  // Optionally shuffle options
  let options = [
    { key: "a", value: q.option_a },
    { key: "b", value: q.option_b },
    { key: "c", value: q.option_c },
    { key: "d", value: q.option_d },
  ];

  if (q.shuffle_options) {
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
  }

  // NEVER include correct_option in response
  return {
    id: q.id,
    question_number: q.question_number,
    content: q.content,
    image_url: q.image_url,
    type: q.type,
    options, // shuffled, no correct flag
  };
}

async function getNextQuestion(supabase: any, attemptId: string, questionOrder: string[], fallbackIndex: number) {
  const { data: answers } = await supabase
    .from("exam_answers")
    .select("question_id")
    .eq("attempt_id", attemptId);

  const answeredIds = new Set(answers?.map((a: any) => a.question_id) || []);
  const nextUnansweredId = questionOrder.find((id) => !answeredIds.has(id));

  if (!nextUnansweredId) return { data: null };

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("exam_id")
    .eq("id", attemptId)
    .single();

  const questionData = await getQuestionData(supabase, nextUnansweredId, attempt.exam_id);
  const index = questionOrder.indexOf(nextUnansweredId);

  return { data: { question: questionData, index } };
}

async function getAnsweredCount(supabase: any, attemptId: string): Promise<number> {
  const { count } = await supabase
    .from("exam_answers")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", attemptId);
  return count || 0;
}
