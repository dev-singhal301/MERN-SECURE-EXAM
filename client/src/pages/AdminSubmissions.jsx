import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeft, CheckCircle2, AlertCircle, FileText, Save, Clock, X, AlertOctagon } from 'lucide-react';

export default function AdminSubmissions() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Grading Modal State
  const [selectedSub, setSelectedSub] = useState(null);
  const [manualGrades, setManualGrades] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: examData } = await supabase.from('exams').select('*').eq('id', examId).single();
    const { data: subData } = await supabase.from('submissions').select('*').eq('exam_id', examId).order('submitted_at', { ascending: false });
    const { data: qData } = await supabase.from('questions').select('*').eq('exam_id', examId);
    
    setExam(examData);
    setSubmissions(subData || []);
    setQuestions(qData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [examId]);

  const openGradingModal = (sub) => {
    setSelectedSub(sub);
    setManualGrades(sub.manual_grades || {});
  };

  const handleGradeChange = (qId, value) => {
    setManualGrades(prev => ({
      ...prev,
      [qId]: parseFloat(value) || 0
    }));
  };

  const saveGrades = async () => {
    setIsSaving(true);
    
    // 1. Re-calculate automated MCQ score
    let autoScore = 0;
    questions.forEach((q) => {
      if (q.type === 'text') return; // Skip text for auto-score
      
      const userAns = selectedSub.answers[q.id];
      const correct = q.correct_answers || [];
      
      if (q.type === 'single' || q.type === 'boolean') {
        if (userAns !== undefined && correct.includes(userAns)) autoScore += (q.marks || 1);
        else if (userAns !== undefined) autoScore -= (q.negative_marks || 0);
      } else if (q.type === 'multiple') {
        if (Array.isArray(userAns) && userAns.length > 0) {
          const isCorrect = userAns.length === correct.length && userAns.every(v => correct.includes(v));
          if (isCorrect) autoScore += (q.marks || 1);
          else autoScore -= (q.negative_marks || 0);
        }
      }
    });

    // 2. Add manual text scores
    let textScore = 0;
    Object.values(manualGrades).forEach(val => textScore += val);

    const finalScore = autoScore + textScore;

    // 3. Save to database
    await supabase.from('submissions')
      .update({ 
        score: finalScore, 
        manual_grades: manualGrades,
        is_reviewed: true 
      })
      .eq('id', selectedSub.id);

    setSelectedSub(null);
    fetchData(); // Refresh list
    setIsSaving(false);
  };

  const textQuestions = questions.filter(q => q.type === 'text');

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-teal-800 hover:text-teal-900 text-xs font-bold mb-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">{exam?.title} - Submissions</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 uppercase font-bold tracking-wider text-[11px]">
            <tr>
              <th className="p-4">Candidate</th>
              <th className="p-4">Exam Status</th>
              <th className="p-4">Final Score</th>
              <th className="p-4">Review Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-medium">
            {loading ? (
              <tr><td colSpan="5" className="p-6 text-center text-zinc-400">Loading...</td></tr>
            ) : submissions.length === 0 ? (
              <tr><td colSpan="5" className="p-6 text-center text-zinc-400">No submissions yet.</td></tr>
            ) : (
              submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-zinc-50/70 transition">
                  <td className="p-4">
                    <span className="font-bold text-zinc-900 block">{sub.student_name}</span>
                    <span className="text-[11px] text-zinc-400">{sub.student_email}</span>
                  </td>
                  <td className="p-4">
                    {sub.is_terminated ? (
                      <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[10px] font-bold">
                        <AlertOctagon className="w-3 h-3" /> Terminated
                      </span>
                    ) : sub.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                        <Clock className="w-3 h-3" /> {sub.status === 'in_progress' ? 'In Progress' : 'Pending'}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-teal-800 font-bold">{sub.score}</td>
                  <td className="p-4">
                    {sub.is_reviewed || textQuestions.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Reviewed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                        <AlertCircle className="w-3 h-3" /> Needs Grading
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => openGradingModal(sub)}
                      className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition"
                    >
                      Review & Grade
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Grading Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Grading: {selectedSub.student_name}</h2>
                <p className="text-xs text-zinc-500">Review descriptive answers and assign points.</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="p-2 text-zinc-400 hover:text-zinc-700 bg-zinc-100 rounded-full transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 space-y-6">
              {textQuestions.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-10">This assessment has no descriptive questions to grade.</p>
              ) : (
                textQuestions.map((q, idx) => {
                  const studentAnswer = selectedSub.answers[q.id];
                  return (
                    <div key={q.id} className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className="text-sm font-semibold text-zinc-900 leading-snug">
                          <span className="text-zinc-400 mr-2">Q{idx + 1}.</span>{q.question_text}
                        </h3>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Assign Marks</div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              min="0" 
                              max={q.marks} 
                              step="0.5"
                              value={manualGrades[q.id] !== undefined ? manualGrades[q.id] : ''}
                              onChange={(e) => handleGradeChange(q.id, e.target.value)}
                              className="w-16 px-2 py-1 text-sm font-bold border border-zinc-300 rounded focus:border-teal-700 outline-none text-center"
                            />
                            <span className="text-xs font-semibold text-zinc-400">/ {q.marks}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white border border-zinc-200 p-4 rounded-lg text-sm text-zinc-700 whitespace-pre-wrap">
                        {studentAnswer ? studentAnswer : <span className="text-zinc-400 italic">No answer provided by candidate.</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 bg-zinc-50 sticky bottom-0 flex justify-end gap-3">
              <button onClick={() => setSelectedSub(null)} className="px-5 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-white transition">Cancel</button>
              <button 
                onClick={saveGrades} 
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save & Update Final Score'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}