import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowRight, BookOpen } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState({});

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: examsData } = await supabase.from('exams').select('*').eq('is_published', true);
      const { data: subsData } = await supabase.from('submissions').select('*').eq('student_id', user.id);

      const subMap = {};
      (subsData || []).forEach((s) => {
        subMap[s.exam_id] = s;
      });

      setExams(examsData || []);
      setSubmissions(subMap);
    };

    if (user) loadDashboard();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Active Assessments</h1>
        <p className="text-zinc-500 text-xs mt-1">Select an allocated test to begin your proctored session.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {exams.map((exam) => {
          const submission = submissions[exam.id];

          return (
            <div
              key={exam.id}
              className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs flex flex-col justify-between space-y-5"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 text-teal-800 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 tracking-tight">{exam.title}</h3>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{exam.duration_minutes} Minutes Allowed</span>
                </div>
              </div>

              {submission ? (
                <Link
                  to={`/result/${exam.id}`}
                  className="flex items-center justify-center gap-2 py-2.5 bg-zinc-100 text-zinc-700 text-xs font-semibold rounded-xl hover:bg-zinc-200 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" /> View Result
                </Link>
              ) : (
                <Link
                  to={`/exam/${exam.id}`}
                  className="flex items-center justify-center gap-2 py-2.5 bg-teal-800 text-white text-xs font-semibold rounded-xl hover:bg-teal-900 transition shadow-xs"
                >
                  Start Assessment <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}