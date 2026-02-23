// supabase/functions/submitAnswer/index.ts
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { attempt_id, question_id, selected_option } = await req.json();

    if (!attempt_id || !question_id) throw new Error("attempt_id dan question_id wajib diisi");
    if (selected_option && !["a", "b", "c", "d"].includes(selected_option)) {
      throw new Error("Pilihan jawaban tidak valid");
    }

    const now = new Date();

    // 1. Validate attempt ownership and status
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("*, exams!inner(status, end_time)")
      .eq("id", attempt_id)
      .eq("student_id", user.id)
      .single();

    if (attemptError || !attempt) throw new Error("Sesi ujian tidak ditemukan");
    if (attempt.status !== "in_progress") throw new Error("Sesi ujian sudah selesai");
    if (new Date(attempt.expires_at) < now) {
      // Auto-expire
      await expireAttempt(supabase, attempt_id);
      throw new Error("Waktu ujian Anda sudah habis");
    }
    if (attempt.exams.status !== "active") throw new Error("Ujian sudah ditutup");
    if (new Date(attempt.exams.end_time) < now) throw new Error("Waktu ujian sudah berakhir");

    // 2. Validate question belongs to this attempt
    const questionOrder: string[] = attempt.question_order || [];
    if (!questionOrder.includes(question_id)) {
      throw new Error("Soal tidak ditemukan dalam sesi ujian ini");
    }

    // 3. Get correct answer (server-side only)
    const { data: question, error: qError } = await supabase
      .from("questions")
      .select("id, correct_option")
      .eq("id", question_id)
      .single();

    if (qError || !question) throw new Error("Soal tidak ditemukan");

    const isCorrect = selected_option ? selected_option === question.correct_option : false;

    // 4. Upsert answer
    const { error: answerError } = await supabase
      .from("exam_answers")
      .upsert({
        attempt_id,
        question_id,
        selected_option: selected_option || null,
        is_correct: isCorrect,
        answered_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: "attempt_id,question_id" });

    if (answerError) throw new Error("Gagal menyimpan jawaban: " + answerError.message);

    // 5. Get answered status for all questions
    const { data: allAnswers } = await supabase
      .from("exam_answers")
      .select("question_id, selected_option, is_correct")
      .eq("attempt_id", attempt_id);

    const answeredMap = new Map(allAnswers?.map((a: any) => [a.question_id, a]) || []);
    const totalAnswered = [...answeredMap.values()].filter((a: any) => a.selected_option).length;

    // 6. Find next question index
    const currentIndex = questionOrder.indexOf(question_id);
    const nextIndex = currentIndex + 1;

    let nextQuestion = null;
    if (nextIndex < questionOrder.length) {
      const nextQuestionId = questionOrder[nextIndex];
      nextQuestion = await getQuestionData(supabase, nextQuestionId, attempt.exam_id);
    }

    // 7. Build answered status grid
    const answerGrid = questionOrder.map((qId, idx) => {
      const ans = answeredMap.get(qId);
      return {
        index: idx,
        question_id: qId,
        answered: !!(ans && ans.selected_option),
      };
    });

    // 8. Update attempt totals
    const totalCorrect = [...answeredMap.values()].filter((a: any) => a.is_correct).length;
    await supabase
      .from("exam_attempts")
      .update({ total_answered: totalAnswered, total_correct: totalCorrect })
      .eq("id", attempt_id);

    return new Response(
      JSON.stringify({
        success: true,
        is_correct: null, // NEVER expose to student
        next_question: nextQuestion,
        next_index: nextIndex < questionOrder.length ? nextIndex : null,
        total_answered: totalAnswered,
        total_questions: questionOrder.length,
        answer_grid: answerGrid,
        remaining_ms: new Date(attempt.expires_at).getTime() - now.getTime(),
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
    .select("id, question_number, content, image_url, option_a, option_b, option_c, option_d, type, shuffle_options")
    .eq("id", questionId)
    .eq("exam_id", examId)
    .single();

  if (!q) return null;

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

  return {
    id: q.id,
    question_number: q.question_number,
    content: q.content,
    image_url: q.image_url,
    type: q.type,
    options,
  };
}

async function expireAttempt(supabase: any, attemptId: string) {
  const { data: answers } = await supabase
    .from("exam_answers")
    .select("is_correct")
    .eq("attempt_id", attemptId);

  const correct = answers?.filter((a: any) => a.is_correct).length || 0;
  const total = answers?.length || 0;
  const score = total > 0 ? Math.round((correct / 50) * 100 * 100) / 100 : 0;

  await supabase
    .from("exam_attempts")
    .update({
      status: "expired",
      finish_time: new Date().toISOString(),
      score,
      total_correct: correct,
      total_answered: total,
    })
    .eq("id", attemptId);
}
