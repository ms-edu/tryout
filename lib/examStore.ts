// lib/examStore.ts
import { create } from "zustand";

export interface QuestionOption {
  key: string;
  value: string;
}

export interface Question {
  id: string;
  question_number: number;
  content: string;
  image_url: string | null;
  type: string;
  options: QuestionOption[];
}

export interface AnswerGridItem {
  index: number;
  question_id: string;
  answered: boolean;
  flagged?: boolean;
}

interface ExamState {
  attemptId: string | null;
  currentQuestion: Question | null;
  currentIndex: number;
  totalQuestions: number;
  totalAnswered: number;
  remainingMs: number;
  answerGrid: AnswerGridItem[];
  selectedAnswer: string | null;
  isSubmitting: boolean;
  isFinished: boolean;
  finalScore: number | null;
  isOnline: boolean;
  pendingAnswers: Array<{ question_id: string; selected_option: string | null }>;

  setAttempt: (id: string) => void;
  setQuestion: (q: Question, index: number) => void;
  setTotal: (total: number) => void;
  setRemainingMs: (ms: number) => void;
  setAnswerGrid: (grid: AnswerGridItem[]) => void;
  setSelectedAnswer: (opt: string | null) => void;
  setIsSubmitting: (v: boolean) => void;
  setIsFinished: (score: number) => void;
  setIsOnline: (v: boolean) => void;
  addPendingAnswer: (qa: { question_id: string; selected_option: string | null }) => void;
  clearPendingAnswers: () => void;
  toggleFlag: (questionId: string) => void;
  resetExam: () => void;
}

export const useExamStore = create<ExamState>((set, get) => ({
  attemptId: null,
  currentQuestion: null,
  currentIndex: 0,
  totalQuestions: 0,
  totalAnswered: 0,
  remainingMs: 0,
  answerGrid: [],
  selectedAnswer: null,
  isSubmitting: false,
  isFinished: false,
  finalScore: null,
  isOnline: true,
  pendingAnswers: [],

  setAttempt: (id) => set({ attemptId: id }),
  setQuestion: (q, index) => set({ currentQuestion: q, currentIndex: index, selectedAnswer: null }),
  setTotal: (total) => set({ totalQuestions: total }),
  setRemainingMs: (ms) => set({ remainingMs: ms }),
  setAnswerGrid: (grid) => set({ answerGrid: grid }),
  setSelectedAnswer: (opt) => set({ selectedAnswer: opt }),
  setIsSubmitting: (v) => set({ isSubmitting: v }),
  setIsFinished: (score) => set({ isFinished: true, finalScore: score }),
  setIsOnline: (v) => set({ isOnline: v }),
  addPendingAnswer: (qa) => set((s) => ({ pendingAnswers: [...s.pendingAnswers, qa] })),
  clearPendingAnswers: () => set({ pendingAnswers: [] }),
  toggleFlag: (questionId) =>
    set((s) => ({
      answerGrid: s.answerGrid.map((item) =>
        item.question_id === questionId ? { ...item, flagged: !item.flagged } : item
      ),
    })),
  resetExam: () =>
    set({
      attemptId: null,
      currentQuestion: null,
      currentIndex: 0,
      totalQuestions: 0,
      totalAnswered: 0,
      remainingMs: 0,
      answerGrid: [],
      selectedAnswer: null,
      isSubmitting: false,
      isFinished: false,
      finalScore: null,
      pendingAnswers: [],
    }),
}));

// Auth store
interface AuthState {
  user: any | null;
  role: "student" | "admin" | null;
  studentData: any | null;
  adminData: any | null;
  setAuth: (user: any, role: "student" | "admin", data: any) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  studentData: null,
  adminData: null,
  setAuth: (user, role, data) =>
    set({
      user,
      role,
      studentData: role === "student" ? data : null,
      adminData: role === "admin" ? data : null,
    }),
  clearAuth: () => set({ user: null, role: null, studentData: null, adminData: null }),
}));
