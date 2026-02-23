// supabase/functions/finishAttempt/index.ts
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

    const { attempt_id } = await req.json();
    if (!attempt_id) throw new Error("attempt_id wajib diisi");

    const now = new Date();

    // 1. Validate attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("*, exams!inner(total_questions, status)")
      .eq("id", attempt_id)
      .eq("student_id", user.id)
      .single();

    if (attemptError || !attempt) throw new Error("Sesi ujian tidak ditemukan");

    if (attempt.status === "submitted") {
      // Already submitted, return saved score
      return new Response(
        JSON.stringify({
          success: true,
          score: attempt.score,
          total_correct: attempt.total_correct,
          total_questions: attempt.exams.total_questions,
          already_submitted: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (attempt.status === "expired") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Sesi ujian sudah berakhir karena waktu habis",
          score: attempt.score,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (attempt.status !== "in_progress") {
      throw new Error("Sesi ujian tidak dapat diselesaikan");
    }

    // 2. Calculate final score SERVER-SIDE
    const { data: answers, error: answersError } = await supabase
      .from("exam_answers")
      .select("is_correct, selected_option, question_id")
      .eq("attempt_id", attempt_id);

    if (answersError) throw new Error("Gagal mengambil data jawaban");

    const totalQuestions = attempt.exams.total_questions;
    const totalAnswered = answers?.filter((a) => a.selected_option).length || 0;
    const totalCorrect = answers?.filter((a) => a.is_correct).length || 0;

    // Score = (correct / total_questions) * 100
    const score = Math.round((totalCorrect / totalQuestions) * 100 * 100) / 100;

    // 3. Update attempt to submitted (LOCKED)
    const { error: updateError } = await supabase
      .from("exam_attempts")
      .update({
        status: "submitted",
        finish_time: now.toISOString(),
        score,
        total_correct: totalCorrect,
        total_answered: totalAnswered,
      })
      .eq("id", attempt_id)
      .eq("status", "in_progress"); // Double-check: only update if still in_progress

    if (updateError) throw new Error("Gagal menyimpan hasil ujian: " + updateError.message);

    return new Response(
      JSON.stringify({
        success: true,
        score,
        total_correct: totalCorrect,
        total_answered: totalAnswered,
        total_questions: totalQuestions,
        finish_time: now.toISOString(),
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
