// supabase/functions/getQuestion/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Unauthorized");

    const { attempt_id, index } = await req.json();

    // Validate attempt
    const { data: attempt } = await supabase
      .from("exam_attempts")
      .select("*, exams!inner(status, end_time)")
      .eq("id", attempt_id)
      .eq("student_id", user.id)
      .single();

    if (!attempt) throw new Error("Attempt tidak ditemukan");
    if (attempt.status !== "in_progress") throw new Error("Ujian sudah selesai");
    if (new Date(attempt.expires_at) < new Date()) throw new Error("Waktu habis");

    const questionOrder: string[] = attempt.question_order || [];
    if (index < 0 || index >= questionOrder.length) throw new Error("Index soal tidak valid");

    const questionId = questionOrder[index];

    // Get question (without correct answer)
    const { data: q } = await supabase
      .from("questions")
      .select("id, question_number, content, image_url, option_a, option_b, option_c, option_d, type, shuffle_options")
      .eq("id", questionId)
      .single();

    if (!q) throw new Error("Soal tidak ditemukan");

    let options = [
      { key: "a", value: q.option_a },
      { key: "b", value: q.option_b },
      { key: "c", value: q.option_c },
      { key: "d", value: q.option_d },
    ];

    // Get current answer for this question if any
    const { data: existingAnswer } = await supabase
      .from("exam_answers")
      .select("selected_option")
      .eq("attempt_id", attempt_id)
      .eq("question_id", questionId)
      .single();

    // Get full answer grid
    const { data: allAnswers } = await supabase
      .from("exam_answers")
      .select("question_id, selected_option")
      .eq("attempt_id", attempt_id);

    const answeredMap = new Map(allAnswers?.map((a: any) => [a.question_id, a.selected_option]) || []);
    const totalAnswered = [...answeredMap.values()].filter(Boolean).length;

    const answerGrid = questionOrder.map((qId, idx) => ({
      index: idx,
      question_id: qId,
      answered: !!(answeredMap.get(qId)),
    }));

    const remainingMs = new Date(attempt.expires_at).getTime() - Date.now();

    return new Response(
      JSON.stringify({
        success: true,
        question: {
          id: q.id,
          question_number: q.question_number,
          content: q.content,
          image_url: q.image_url,
          type: q.type,
          options,
        },
        current_answer: existingAnswer?.selected_option || null,
        current_index: index,
        answer_grid: answerGrid,
        total_answered: totalAnswered,
        total_questions: questionOrder.length,
        remaining_ms: remainingMs,
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
