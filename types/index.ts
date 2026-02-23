// types/index.ts

export interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  academic_year_id: string;
  nis: string;
  full_name: string;
  class_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Admin {
  id: string;
  email: string;
  full_name: string;
  role: "superadmin" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface Exam {
  id: string;
  academic_year_id: string;
  title: string;
  description: string | null;
  token: string;
  duration_minutes: number;
  total_questions: number;
  start_time: string;
  end_time: string;
  status: "draft" | "active" | "closed";
  shuffle_questions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  academic_years?: Pick<AcademicYear, "name">;
}

export interface Question {
  id: string;
  exam_id: string;
  question_number: number;
  content: string;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  type: "literasi" | "numerasi";
  shuffle_options: boolean;
  points: number;
  created_at: string;
  updated_at: string;
}

// Safe version sent to student (no correct_option)
export interface QuestionSafe {
  id: string;
  question_number: number;
  content: string;
  image_url: string | null;
  type: "literasi" | "numerasi";
  options: Array<{ key: string; value: string }>;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  start_time: string;
  finish_time: string | null;
  expires_at: string;
  score: number | null;
  total_correct: number;
  total_answered: number;
  status: "in_progress" | "submitted" | "expired" | "disqualified";
  question_order: string[];
  ip_address: string | null;
  created_at: string;
}

export interface ExamAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: "a" | "b" | "c" | "d" | null;
  is_correct: boolean | null;
  answered_at: string;
}

export interface RankingRow {
  exam_id: string;
  attempt_id: string;
  nis: string;
  full_name: string;
  class_name: string | null;
  score: number;
  total_correct: number;
  total_answered: number;
  status: string;
  start_time: string;
  finish_time: string | null;
  rank: number;
}

export interface ExamStats {
  exam_id: string;
  title: string;
  status: string;
  total_attempts: number;
  total_submitted: number;
  total_active: number;
  total_expired: number;
  avg_score: number | null;
  max_score: number | null;
  min_score: number | null;
}

export interface AnswerGridItem {
  index: number;
  question_id: string;
  answered: boolean;
  flagged?: boolean;
}

// Edge function response types
export interface StartAttemptResponse {
  success: boolean;
  attempt_id: string;
  question: QuestionSafe;
  current_index: number;
  total_questions: number;
  remaining_ms: number;
  resumed: boolean;
  answer_grid?: AnswerGridItem[];
}

export interface SubmitAnswerResponse {
  success: boolean;
  next_question: QuestionSafe | null;
  next_index: number | null;
  total_answered: number;
  total_questions: number;
  answer_grid: AnswerGridItem[];
  remaining_ms: number;
}

export interface FinishAttemptResponse {
  success: boolean;
  score: number;
  total_correct: number;
  total_answered: number;
  total_questions: number;
  finish_time: string;
  already_submitted?: boolean;
}
