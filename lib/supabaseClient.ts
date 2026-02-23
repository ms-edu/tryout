// lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Database = {
  public: {
    Tables: {
      academic_years: {
        Row: { id: string; name: string; is_active: boolean; created_at: string; updated_at: string };
        Insert: { name: string; is_active?: boolean };
        Update: { name?: string; is_active?: boolean };
      };
      students: {
        Row: { id: string; academic_year_id: string; nis: string; full_name: string; class_name: string | null; is_active: boolean; created_at: string };
        Insert: { academic_year_id: string; nis: string; full_name: string; class_name?: string; is_active?: boolean };
        Update: { full_name?: string; class_name?: string; is_active?: boolean };
      };
      exams: {
        Row: { id: string; academic_year_id: string; title: string; token: string; duration_minutes: number; total_questions: number; start_time: string; end_time: string; status: "draft" | "active" | "closed"; created_at: string };
        Insert: { academic_year_id: string; title: string; token: string; duration_minutes: number; total_questions?: number; start_time: string; end_time: string; status?: string };
        Update: { title?: string; duration_minutes?: number; start_time?: string; end_time?: string; status?: string };
      };
      questions: {
        Row: { id: string; exam_id: string; question_number: number; content: string; image_url: string | null; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; type: string; shuffle_options: boolean };
        Insert: { exam_id: string; question_number: number; content: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; type?: string; shuffle_options?: boolean; image_url?: string };
        Update: { content?: string; option_a?: string; option_b?: string; option_c?: string; option_d?: string; correct_option?: string; type?: string };
      };
      exam_attempts: {
        Row: { id: string; exam_id: string; student_id: string; start_time: string; finish_time: string | null; expires_at: string; score: number | null; total_correct: number; total_answered: number; status: string };
      };
      exam_answers: {
        Row: { id: string; attempt_id: string; question_id: string; selected_option: string | null; is_correct: boolean | null };
      };
    };
  };
};
