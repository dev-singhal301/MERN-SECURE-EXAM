import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Trophy, ArrowLeft, Clock, Award, Medal, CheckCircle2, XCircle, Users } from 'lucide-react';

export default function AdminLeaderboard() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Qualification States
  const [topK, setTopK] = useState(10);
  const [isQualifying, setIsQualifying] = useState(false);

  const fetchRankings = async () => {
    setLoading(true);
    const { data: examData } = await supabase.from('exams').select('*').eq('id', examId).single();
    
    const { data: subData } = await supabase
      .from('submissions')
      .select('*')
      .eq('exam_id', examId)
      .eq('is_terminated', false)
      .order('score', { ascending: false })
      .order('time_taken_seconds', { ascending: true })
      .order('submitted_at', { ascending: true });

    setExam(examData);
    setRankings(subData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRankings();
  }, [examId]);

  const handleQualifyTopK = async () => {
    if (topK <= 0 || rankings.length === 0) return;
    if (!window.confirm(`Are you sure you want to officially mark the Top ${topK} candidates as Qualified for the next round?`)) return;

    setIsQualifying(true);

    // rankings are already sorted by highest score -> fastest time
    const qualifiedIds = rankings.slice(0, topK).map(r => r.id);
    const disqualifiedIds = rankings.slice(topK).map(r => r.id);

    try {
      if (qualifiedIds.length > 0) {
        await supabase.from('submissions').update({ is_qualified: true }).in('id', qualifiedIds);
      }
      if (disqualifiedIds.length > 0) {
        await supabase.from('submissions').update({ is_qualified: false }).in('id', disqualifiedIds);
      }
      await fetchRankings();
    } catch (err) {
      console.error("Error setting qualifications:", err);
      alert("Failed to update qualifications.");
    } finally {
      setIsQualifying(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800 font-black"><Medal className="w-4 h-4 inline mr-1 text-amber-600" />#1</span>;
    if (rank === 2) return <span className="p-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold"><Medal className="w-4 h-4 inline mr-1 text-slate-500" />#2</span>;
    if (rank === 3) return <span className="p-1.5 rounded-lg bg-amber-700/10 text-amber-900 font-bold"><Medal className="w-4 h-4 inline mr-1 text-amber-700" />#3</span>;
    return <span className="text-zinc-500 font-semibold pl-2">#{rank}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-200/80 pb-5">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1.5 text-teal-800 hover:text-teal-900 text-xs font-bold mb-2 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </Link>
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-600" />
            <h1 className="text-xl font-bold text-zinc-900">
              Official Leaderboard: {exam ? exam.title : 'Loading...'}
            </h1>
          </div>
        </div>
        <div className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg">
          Rank Criteria: <strong>Score (High)</strong> → <strong>Time Taken (Fastest)</strong>
        </div>
      </div>

      {/* QUALIFICATION CONTROL PANEL */}
      <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" /> Competition Cutoff
          </h3>
          <p className="text-xs text-zinc-500 mt-1">Select the top candidates to move on to the next round. (Optional)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-1.5">
            <span className="text-xs font-bold text-zinc-600">Top</span>
            <input 
              type="number" 
              min="1" 
              value={topK} 
              onChange={(e) => setTopK(parseInt(e.target.value) || 1)}
              className="w-16 bg-white border border-zinc-300 rounded-md px-2 py-1 text-sm font-bold text-center outline-none focus:border-indigo-500"
            />
            <span className="text-xs font-bold text-zinc-600">Candidates</span>
          </div>
          <button 
            onClick={handleQualifyTopK}
            disabled={isQualifying || rankings.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {isQualifying ? 'Processing...' : 'Mark as Qualified'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 uppercase font-bold tracking-wider text-[11px]">
            <tr>
              <th className="p-4">Rank</th>
              <th className="p-4">Candidate</th>
              <th className="p-4">Score</th>
              <th className="p-4">Time Taken</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 font-medium">
            {loading ? (
              <tr><td colSpan="5" className="p-6 text-center text-zinc-400">Loading standings...</td></tr>
            ) : rankings.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-zinc-400">No qualifying submissions recorded.</td></tr>
            ) : (
              rankings.map((row, idx) => (
                <tr key={row.id} className={`transition ${row.is_qualified ? 'bg-emerald-50/30' : 'hover:bg-zinc-50/70'}`}>
                  <td className="p-4">{getRankBadge(idx + 1)}</td>
                  <td className="p-4">
                    <span className="font-bold text-zinc-900 block">{row.student_name}</span>
                    <span className="text-[11px] text-zinc-400">{row.student_email}</span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 font-extrabold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-100">
                      <Award className="w-3.5 h-3.5 text-teal-600" />
                      {row.score}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-600">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {formatTime(row.time_taken_seconds)}
                    </span>
                  </td>
                  <td className="p-4">
                    {row.is_qualified === true && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] uppercase bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Qualified
                      </span>
                    )}
                    {row.is_qualified === false && (
                      <span className="inline-flex items-center gap-1 text-zinc-500 font-bold text-[10px] uppercase bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                        <XCircle className="w-3 h-3" /> Not Qualified
                      </span>
                    )}
                    {row.is_qualified === null && (
                      <span className="text-zinc-400 text-[10px] italic">Pending</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}