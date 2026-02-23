"use client";
// app/exam/page.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useExamStore, useAuthStore } from "@/lib/examStore";
import { startAttempt, submitAnswer, finishAttempt, getQuestionByIndex } from "@/lib/api";
import { savePendingAnswer, getPendingAnswers, clearPendingAnswers } from "@/lib/offlineStorage";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import NavigationGrid from "@/components/NavigationGrid";

export default function ExamPage() {
  const router = useRouter();
  const {
    attemptId, currentQuestion, currentIndex, totalQuestions, totalAnswered,
    remainingMs, answerGrid, selectedAnswer, isSubmitting, isFinished, finalScore,
    setAttempt, setQuestion, setTotal, setRemainingMs, setAnswerGrid,
    setIsSubmitting, setIsFinished, setIsOnline, isOnline, resetExam,
  } = useExamStore();

  const { studentData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const syncingRef = useRef(false);

  // Disable right-click, copy-paste, devtools shortcuts
  useEffect(() => {
    const blockContextMenu = (e: MouseEvent) => e.preventDefault();
    const blockKeyboard = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && ["c", "v", "u", "s", "a", "p"].includes(e.key.toLowerCase())) ||
        e.key === "F12" || e.key === "F5" ||
        (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("keydown", blockKeyboard);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("keydown", blockKeyboard);
    };
  }, []);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingAnswers();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // SW message handler
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "SYNC_ANSWERS") syncPendingAnswers();
        if (event.data?.type === "SYNC_FINISH") handleFinish();
      });
    }
  }, []);

  // Initialize exam
  useEffect(() => {
    const token = sessionStorage.getItem("exam_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    initExam(token);
  }, []);

  const initExam = async (token: string) => {
    try {
      setLoading(true);
      const result = await startAttempt(token);

      setAttempt(result.attempt_id);
      setTotal(result.total_questions);
      setRemainingMs(result.remaining_ms);
      setQuestion(result.question, result.current_index);

      // If resumed, we may need to rebuild grid
      if (result.answer_grid) {
        setAnswerGrid(result.answer_grid);
      } else {
        // Initialize empty grid
        const emptyGrid = Array.from({ length: result.total_questions }, (_, i) => ({
          index: i,
          question_id: "",
          answered: false,
        }));
        setAnswerGrid(emptyGrid);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncPendingAnswers = async () => {
    if (!attemptId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      const pending = await getPendingAnswers(attemptId);
      const unsynced = pending.filter((p) => !p.synced);
      for (const p of unsynced) {
        try {
          await submitAnswer(attemptId, p.question_id, p.selected_option);
        } catch {}
      }
      if (unsynced.length > 0) await clearPendingAnswers(attemptId);
    } finally {
      syncingRef.current = false;
    }
  };

  const handleSubmitAnswer = async (navigateToIndex?: number) => {
    if (!attemptId || !currentQuestion) return;

    setIsSubmitting(true);
    try {
      if (!isOnline) {
        // Save offline
        await savePendingAnswer(attemptId, currentQuestion.id, selectedAnswer);
        // Register background sync
        if ("serviceWorker" in navigator && "SyncManager" in window) {
          const reg = await navigator.serviceWorker.ready;
          await (reg as any).sync.register("sync-answers");
        }
        // Still navigate to requested index
        if (navigateToIndex !== undefined && navigateToIndex < totalQuestions) {
          // We'll load from server when back online - for now just show next question concept
          setQuestion(currentQuestion, navigateToIndex); // placeholder
        }
        return;
      }

      const result = await submitAnswer(attemptId, currentQuestion.id, selectedAnswer);
      setAnswerGrid(result.answer_grid);

      if (navigateToIndex !== undefined && navigateToIndex < totalQuestions) {
        // Navigate to specific index
        await navigateToQuestion(navigateToIndex);
      } else if (result.next_question && result.next_index !== null) {
        setQuestion(result.next_question, result.next_index);
        setRemainingMs(result.remaining_ms);
      }
    } catch (err: any) {
      if (err.message?.includes("waktu")) {
        handleExpire();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateToQuestion = async (targetIndex: number) => {
    if (!attemptId) return;
    try {
      const result = await getQuestionByIndex(attemptId, targetIndex);
      if (result.question) {
        setQuestion(result.question, targetIndex);
        setRemainingMs(result.remaining_ms);
      }
    } catch (err) {
      console.error("Navigate error:", err);
    }
  };

  const handleNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalQuestions) {
      setShowConfirm(true);
      return;
    }
    handleSubmitAnswer(nextIndex);
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      handleSubmitAnswer(currentIndex - 1);
    }
  };

  const handleNavigate = (index: number, questionId: string) => {
    if (index !== currentIndex) {
      handleSubmitAnswer(index);
    }
  };

  const handleExpire = useCallback(async () => {
    if (!attemptId) return;
    try {
      const result = await finishAttempt(attemptId);
      setIsFinished(result.score);
    } catch {
      setIsFinished(0);
    }
  }, [attemptId]);

  const handleFinish = async () => {
    if (!attemptId) return;
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      // Submit current answer first
      if (currentQuestion && selectedAnswer) {
        await submitAnswer(attemptId, currentQuestion.id, selectedAnswer);
      }
      const result = await finishAttempt(attemptId);
      setIsFinished(result.score);
      sessionStorage.removeItem("exam_token");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- LOADING STATE ----
  if (loading) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xl font-medium">Mempersiapkan ujian...</p>
        </div>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (error) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Tidak Dapat Memulai Ujian</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => router.push("/login")} className="w-full py-3 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800">
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  // ---- FINISHED STATE ----
  if (isFinished) {
    return (
      <div className="min-h-screen bg-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Ujian Selesai</h2>
          <p className="text-gray-500 mb-6">Jawaban Anda telah disimpan</p>
          <div className="bg-blue-50 rounded-xl p-6 mb-6">
            <p className="text-sm text-gray-500 mb-1">Nilai Anda</p>
            <p className="text-5xl font-bold text-blue-700">{finalScore?.toFixed(0)}</p>
            <p className="text-sm text-gray-400 mt-1">dari 100</p>
          </div>
          <p className="text-gray-500 text-sm">Terima kasih telah mengikuti ujian. Silahkan hubungi pengawas.</p>
        </div>
      </div>
    );
  }

  // ---- MAIN EXAM LAYOUT (ANBK STYLE) ----
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-blue-800 text-white px-4 py-2 flex items-center justify-between shadow-md z-10" style={{ height: "var(--cbt-header-height)" }}>
        <div className="flex items-center gap-3">
          <div className="font-bold text-sm">
            <div className="text-blue-200 text-xs">Peserta</div>
            <div>{studentData?.full_name || "—"}</div>
          </div>
          {studentData?.class_name && (
            <div className="text-sm text-blue-200">| Kelas {studentData.class_name}</div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Online indicator */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${isOnline ? "bg-green-600" : "bg-red-600"}`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-300 animate-pulse" : "bg-red-300"}`} />
            {isOnline ? "Online" : "Offline"}
          </div>

          {/* Timer */}
          {remainingMs > 0 && <Timer onExpire={handleExpire} />}
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Question area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {currentQuestion ? (
            <QuestionCard
              question={currentQuestion}
              currentIndex={currentIndex}
              totalQuestions={totalQuestions}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </main>

        {/* Right: Navigation grid */}
        <aside className="w-52 bg-gray-50 border-l border-gray-200 overflow-y-auto p-3 hidden lg:block">
          <NavigationGrid onNavigate={handleNavigate} />
        </aside>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm" style={{ height: "var(--cbt-footer-height)" }}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0 || isSubmitting}
          className="flex items-center gap-2 px-5 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-40 text-gray-700 font-medium rounded-lg transition-colors"
        >
          ← Sebelumnya
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{totalAnswered}/{totalQuestions} dijawab</span>
          {isSubmitting && <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
        </div>

        {currentIndex < totalQuestions - 1 ? (
          <button
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white font-medium rounded-lg transition-colors"
          >
            Selanjutnya →
          </button>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold rounded-lg transition-colors"
          >
            ✓ Selesai
          </button>
        )}
      </footer>

      {/* Confirm finish modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Selesaikan Ujian?</h3>
            <p className="text-gray-600 text-sm mb-1">
              Anda telah menjawab <strong>{totalAnswered}</strong> dari <strong>{totalQuestions}</strong> soal.
            </p>
            {totalAnswered < totalQuestions && (
              <p className="text-orange-600 text-sm mb-4">
                ⚠ Masih ada {totalQuestions - totalAnswered} soal yang belum dijawab.
              </p>
            )}
            <p className="text-gray-500 text-sm mb-5">Setelah diselesaikan, jawaban tidak dapat diubah.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
                Kembali
              </button>
              <button onClick={handleFinish} disabled={isSubmitting} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">
                {isSubmitting ? "Menyimpan..." : "Ya, Selesai"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
