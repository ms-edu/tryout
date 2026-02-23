"use client";
// components/QuestionCard.tsx
import Image from "next/image";
import { Question } from "@/lib/examStore";
import { useExamStore } from "@/lib/examStore";

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
}

export default function QuestionCard({ question, currentIndex, totalQuestions }: QuestionCardProps) {
  const selectedAnswer = useExamStore((s) => s.selectedAnswer);
  const setSelectedAnswer = useExamStore((s) => s.setSelectedAnswer);

  const optionKeys = ["A", "B", "C", "D"];

  return (
    <div className="no-select">
      {/* Question header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-blue-700 text-white text-sm font-bold px-3 py-1 rounded-full">
          Soal {currentIndex + 1} / {totalQuestions}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          question.type === "numerasi"
            ? "bg-orange-100 text-orange-700"
            : "bg-green-100 text-green-700"
        }`}>
          {question.type === "numerasi" ? "Numerasi" : "Literasi"}
        </span>
      </div>

      {/* Question content */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
          {question.content}
        </p>

        {question.image_url && (
          <div className="mt-4">
            <img
              src={question.image_url}
              alt="Gambar soal"
              className="max-w-full max-h-64 object-contain rounded-lg border border-gray-200 mx-auto block"
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((option, idx) => {
          const isSelected = selectedAnswer === option.key;
          return (
            <button
              key={option.key}
              onClick={() => setSelectedAnswer(option.key)}
              className={`answer-option w-full text-left ${isSelected ? "selected" : ""}`}
            >
              <span className="answer-option-key">{optionKeys[idx]}</span>
              <span className="text-gray-800 text-sm leading-relaxed">{option.value}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
