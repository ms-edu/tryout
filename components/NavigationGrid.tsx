"use client";
// components/NavigationGrid.tsx
import { useExamStore, AnswerGridItem } from "@/lib/examStore";

interface NavigationGridProps {
  onNavigate: (index: number, questionId: string) => void;
}

export default function NavigationGrid({ onNavigate }: NavigationGridProps) {
  const answerGrid = useExamStore((s) => s.answerGrid);
  const currentIndex = useExamStore((s) => s.currentIndex);
  const totalAnswered = useExamStore((s) => s.totalAnswered);
  const totalQuestions = useExamStore((s) => s.totalQuestions);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">Navigasi Soal</h3>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-500"></div>
          <span className="text-gray-600">Dijawab</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-400"></div>
          <span className="text-gray-600">Ragu</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-200"></div>
          <span className="text-gray-600">Belum</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {answerGrid.map((item: AnswerGridItem) => {
          const isCurrent = item.index === currentIndex;
          let statusClass = "unanswered";
          if (item.flagged) statusClass = "flagged";
          else if (item.answered) statusClass = "answered";

          return (
            <button
              key={item.question_id}
              onClick={() => onNavigate(item.index, item.question_id)}
              className={`nav-grid-item ${statusClass} ${isCurrent ? "current" : ""}`}
              title={`Soal ${item.index + 1}`}
            >
              {item.index + 1}
            </button>
          );
        })}
      </div>

      {/* Progress */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex justify-between text-xs text-gray-600 mb-1.5">
          <span>Progress</span>
          <span className="font-medium">{totalAnswered}/{totalQuestions}</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full">
          <div
            className="h-2 bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
