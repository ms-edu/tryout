// supabase/functions/getRanking/index.ts
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

    // Only admins can access ranking
    const { data: admin } = await supabase
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .eq("is_active", true)
      .single();

    if (!admin) throw new Error("Akses ditolak. Admin only.");

    const url = new URL(req.url);
    const examId = url.searchParams.get("exam_id");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    if (!examId) throw new Error("exam_id wajib diisi");

    // Expire timed-out attempts first
    await supabase.rpc("expire_timed_out_attempts");

    // Get ranking from view
    const { data: ranking, error: rankError, count } = await supabase
      .from("exam_ranking")
      .select("*", { count: "exact" })
      .eq("exam_id", examId)
      .order("rank", { ascending: true })
      .range(offset, offset + limit - 1);

    if (rankError) throw new Error("Gagal mengambil ranking: " + rankError.message);

    // Get exam stats
    const { data: stats } = await supabase
      .from("exam_stats")
      .select("*")
      .eq("exam_id", examId)
      .single();

    // Get active (in_progress) count
    const { count: activeCount } = await supabase
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", examId)
      .eq("status", "in_progress");

    return new Response(
      JSON.stringify({
        success: true,
        ranking: ranking || [],
        stats: {
          ...stats,
          total_active: activeCount || 0,
        },
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
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
