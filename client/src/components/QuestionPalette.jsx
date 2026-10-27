import React from 'react';

export default function QuestionPalette({ total, current, answers, onSelect }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-xs space-y-4">
      <div className="border-b border-zinc-100 pb-2.5">
        <h3 className="font-bold text-zinc-900 text-xs tracking-tight uppercase">Overview Palette</h3>
      </div>

      <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
        {Array.from({ length: total }).map((_, idx) => {
          const isAnswered =
            answers[idx] !== undefined && (Array.isArray(answers[idx]) ? answers[idx].length > 0 : true);
          const isCurrent = current === idx;

          let btnClass = "bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
          if (isAnswered) btnClass = "bg-teal-700 text-white font-semibold";
          if (isCurrent) btnClass = "ring-2 ring-teal-700 font-bold bg-teal-50 text-teal-900";

          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              className={`h-9 rounded-lg text-xs transition-all cursor-pointer ${btnClass}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-zinc-100 grid grid-cols-2 gap-2 text-[11px] font-medium text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-700 inline-block"></span>
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-200 inline-block"></span>
          <span>Pending</span>
        </div>
      </div>
    </div>
  );
}