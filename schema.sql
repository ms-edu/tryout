-- ============================================================
-- TRYOUT SD/MI ENTERPRISE CBT SYSTEM
-- Complete Database Schema with RLS
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Academic Years
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL, -- e.g. "2024/2025"
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admins
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  nis VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  class_name VARCHAR(50),
  pin_hash TEXT, -- optional PIN for access
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exams
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  token VARCHAR(20) UNIQUE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90,
  total_questions INTEGER NOT NULL DEFAULT 50,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  shuffle_questions BOOLEAN DEFAULT true,
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Questions
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  type VARCHAR(20) DEFAULT 'literasi' CHECK (type IN ('literasi', 'numerasi')),
  shuffle_options BOOLEAN DEFAULT true,
  points INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, question_number)
);

-- Exam Attempts
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  finish_time TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- start_time + duration
  score NUMERIC(5,2),
  total_correct INTEGER DEFAULT 0,
  total_answered INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired', 'disqualified')),
  question_order UUID[], -- shuffled question IDs for this attempt
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id) -- 1 attempt per student per exam
);

-- Exam Answers
CREATE TABLE exam_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  selected_option CHAR(1) CHECK (selected_option IN ('a','b','c','d')),
  is_correct BOOLEAN, -- computed server-side
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_students_academic_year ON students(academic_year_id);
CREATE INDEX idx_students_nis ON students(nis);
CREATE INDEX idx_exams_academic_year ON exams(academic_year_id);
CREATE INDEX idx_exams_token ON exams(token);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_questions_exam ON questions(exam_id);
CREATE INDEX idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_attempts_student ON exam_attempts(student_id);
CREATE INDEX idx_attempts_status ON exam_attempts(status);
CREATE INDEX idx_answers_attempt ON exam_answers(attempt_id);
CREATE INDEX idx_answers_question ON exam_answers(question_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_academic_years_updated BEFORE UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_admins_updated BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_exams_updated BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_questions_updated BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_attempts_updated BEFORE UPDATE ON exam_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_answers_updated BEFORE UPDATE ON exam_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins
    WHERE id = auth.uid()
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: check if current user is student
CREATE OR REPLACE FUNCTION current_student_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ACADEMIC YEARS POLICIES
CREATE POLICY "admins_all_academic_years" ON academic_years
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "students_read_academic_years" ON academic_years
  FOR SELECT TO authenticated
  USING (true);

-- ADMINS POLICIES
CREATE POLICY "admins_read_own" ON admins
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "superadmin_all_admins" ON admins
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid() AND role = 'superadmin'));

-- STUDENTS POLICIES
CREATE POLICY "admins_all_students" ON students
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "students_read_own" ON students
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- EXAMS POLICIES
CREATE POLICY "admins_all_exams" ON exams
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "students_read_active_exams" ON exams
  FOR SELECT TO authenticated
  USING (status = 'active' AND NOW() BETWEEN start_time AND end_time);

-- QUESTIONS POLICIES (NEVER expose to students directly)
CREATE POLICY "admins_all_questions" ON questions
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Students CANNOT directly query questions table
-- Questions are served only via Edge Functions

-- EXAM ATTEMPTS POLICIES
CREATE POLICY "admins_all_attempts" ON exam_attempts
  FOR ALL TO authenticated
  USING (is_admin());

CREATE POLICY "students_read_own_attempt" ON exam_attempts
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "students_insert_own_attempt" ON exam_attempts
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "students_update_own_attempt" ON exam_attempts
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'in_progress');

-- EXAM ANSWERS POLICIES
CREATE POLICY "admins_all_answers" ON exam_answers
  FOR ALL TO authenticated
  USING (is_admin());

CREATE POLICY "students_read_own_answers" ON exam_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_attempts
      WHERE id = attempt_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "students_insert_answer_if_in_progress" ON exam_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.id = attempt_id
        AND ea.student_id = auth.uid()
        AND ea.status = 'in_progress'
        AND ea.expires_at > NOW()
        AND e.status = 'active'
        AND NOW() BETWEEN e.start_time AND e.end_time
    )
  );

CREATE POLICY "students_update_own_answer" ON exam_answers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.id = attempt_id
        AND ea.student_id = auth.uid()
        AND ea.status = 'in_progress'
        AND ea.expires_at > NOW()
        AND e.status = 'active'
    )
  );

-- ============================================================
-- RANKING VIEW (for admin realtime)
-- ============================================================

CREATE OR REPLACE VIEW exam_ranking AS
SELECT
  ea.exam_id,
  ea.id AS attempt_id,
  s.nis,
  s.full_name,
  s.class_name,
  ea.score,
  ea.total_correct,
  ea.total_answered,
  ea.status,
  ea.start_time,
  ea.finish_time,
  RANK() OVER (PARTITION BY ea.exam_id ORDER BY ea.score DESC NULLS LAST, ea.finish_time ASC NULLS LAST) AS rank
FROM exam_attempts ea
JOIN students s ON s.id = ea.student_id
WHERE ea.status IN ('submitted', 'expired');

-- ============================================================
-- EXAM STATS VIEW
-- ============================================================

CREATE OR REPLACE VIEW exam_stats AS
SELECT
  e.id AS exam_id,
  e.title,
  e.status,
  COUNT(ea.id) AS total_attempts,
  COUNT(ea.id) FILTER (WHERE ea.status = 'submitted') AS total_submitted,
  COUNT(ea.id) FILTER (WHERE ea.status = 'in_progress') AS total_active,
  COUNT(ea.id) FILTER (WHERE ea.status = 'expired') AS total_expired,
  ROUND(AVG(ea.score) FILTER (WHERE ea.score IS NOT NULL), 2) AS avg_score,
  MAX(ea.score) AS max_score,
  MIN(ea.score) FILTER (WHERE ea.score IS NOT NULL) AS min_score
FROM exams e
LEFT JOIN exam_attempts ea ON ea.exam_id = e.id
GROUP BY e.id, e.title, e.status;

-- ============================================================
-- AUTO-EXPIRE ATTEMPTS (scheduled via pg_cron or edge function)
-- ============================================================

CREATE OR REPLACE FUNCTION expire_timed_out_attempts()
RETURNS void AS $$
BEGIN
  UPDATE exam_attempts
  SET
    status = 'expired',
    finish_time = expires_at,
    score = COALESCE(
      (SELECT ROUND((SUM(CASE WHEN ans.is_correct THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100, 2)
       FROM exam_answers ans WHERE ans.attempt_id = exam_attempts.id),
      0
    )
  WHERE status = 'in_progress'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED: Default Admin (password: Admin@123)
-- Run AFTER creating auth user via Supabase dashboard
-- ============================================================

-- INSERT INTO admins (id, email, full_name, role, password_hash)
-- VALUES (
--   '<supabase-auth-uid>',
--   'admin@sekolah.sch.id',
--   'Administrator',
--   'superadmin',
--   crypt('Admin@123', gen_salt('bf'))
-- );
