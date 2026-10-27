import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, 
  Layers, Clock, AlertCircle, Tag, Sparkles 
} from 'lucide-react';

export default function EditExam() {
  const { examId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isPublished, setIsPublished] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  const [hasCategories, setHasCategories] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('Select Your Track');
  const [categoryMessage, setCategoryMessage] = useState('Please select the track you wish to be tested on. You cannot change this later.');
  
  const [allowAiAssistant, setAllowAiAssistant] = useState(false);
  // NEW: Dynamic AI Configuration State
  const [aiWordLimit, setAiWordLimit] = useState(200);
  const [aiAttemptsLimit, setAiAttemptsLimit] = useState(2);

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchExamDetails = async () => {
      try {
        const { data: examData, error: examErr } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .single();

        if (examErr) throw examErr;

        setTitle(examData.title || '');
        setDescription(examData.description || '');
        setDurationMinutes(examData.duration_minutes || 30);
        setIsPublished(examData.is_published || false);
        setShowResults(examData.show_results || false);
        setShowDetailedResults(examData.show_detailed_results || false);
        setShowLeaderboard(examData.show_leaderboard || false);
        
        setHasCategories(examData.has_categories || false);
        setCategoryTitle(examData.category_selection_title || 'Select Your Track');
        setCategoryMessage(examData.category_selection_message || 'Please select the track you wish to be tested on. You cannot change this later.');
        
        setAllowAiAssistant(examData.allow_ai_assistant || false);
        setAiWordLimit(examData.ai_word_limit || 500); // Load AI limit
        setAiAttemptsLimit(examData.ai_attempts_limit || 2); // Load AI count

        const { data: qData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('exam_id', examId)
          .order('created_at', { ascending: true });

        if (qErr) throw qErr;

        if (qData && qData.length > 0) {
          setQuestions(qData.map(q => ({
            question_text: q.question_text,
            type: q.type,
            options: q.options || ['', '', '', ''],
            correct_answers: q.correct_answers || [0],
            marks: q.marks,
            negative_marks: q.negative_marks,
            category: q.category || 'General'
          })));
        } else {
          setQuestions([{
            question_text: '', type: 'single', options: ['', '', '', ''],
            correct_answers: [0], marks: 1, negative_marks: 0, category: 'General'
          }]);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load exam data.");
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
  }, [examId]);

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '', type: 'single', options: ['', '', '', ''],
      correct_answers: [0], marks: 1, negative_marks: 0, category: 'General'
    }]);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) return alert('An assessment must have at least one question.');
    setQuestions(questions.filter((_, idx) => idx !== index));
  };

  const handleQuestionFieldChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleTypeChange = (index, newType) => {
    const updated = [...questions];
    updated[index].type = newType;
    if (newType === 'boolean') {
      updated[index].options = ['True', 'False'];
      updated[index].correct_answers = [0];
    } else if (newType === 'text') {
      updated[index].options = [];
      updated[index].correct_answers = [];
    } else {
      updated[index].options = ['', '', '', ''];
      updated[index].correct_answers = [0];
    }
    setQuestions(updated);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const handleCorrectAnswerToggle = (qIndex, oIndex) => {
    const updated = [...questions];
    const currentQ = updated[qIndex];
    if (currentQ.type === 'single' || currentQ.type === 'boolean') {
      currentQ.correct_answers = [oIndex];
    } else if (currentQ.type === 'multiple') {
      const exists = currentQ.correct_answers.includes(oIndex);
      if (exists) {
        if (currentQ.correct_answers.length > 1) {
          currentQ.correct_answers = currentQ.correct_answers.filter((i) => i !== oIndex);
        }
      } else {
        currentQ.correct_answers = [...currentQ.correct_answers, oIndex].sort();
      }
    }
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) return setErrorMsg('Please enter an assessment title.');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) return setErrorMsg(`Question #${i + 1} is missing question text.`);
      
      if (q.type !== 'text') {
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].trim()) return setErrorMsg(`Question #${i + 1}, Option #${j + 1} cannot be empty.`);
        }
        if (q.correct_answers.length === 0) return setErrorMsg(`Question #${i + 1} must have at least one correct option.`);
      }
    }

    setIsSaving(true);

    try {
      const { error: examErr } = await supabase
        .from('exams')
        .update({
          title: title.trim(),
          description: description.trim(),
          duration_minutes: parseInt(durationMinutes, 10),
          is_published: isPublished,
          show_results: showResults,
          show_detailed_results: showDetailedResults,
          show_leaderboard: showLeaderboard,
          has_categories: hasCategories,
          category_selection_title: categoryTitle.trim(),
          category_selection_message: categoryMessage.trim(),
          allow_ai_assistant: allowAiAssistant,
          ai_word_limit: parseInt(aiWordLimit, 10), // Save AI Limit
          ai_attempts_limit: parseInt(aiAttemptsLimit, 10), // Save AI Count
        })
        .eq('id', examId);

      if (examErr) throw examErr;

      const { error: delErr } = await supabase.from('questions').delete().eq('exam_id', examId);
      if (delErr) throw delErr;

      const questionsPayload = questions.map((q) => ({
        exam_id: examId,
        question_text: q.question_text.trim(),
        type: q.type,
        options: q.options.map((opt) => opt.trim()),
        correct_answers: q.correct_answers,
        marks: parseFloat(q.marks),
        negative_marks: parseFloat(q.negative_marks),
        category: hasCategories ? q.category.trim() : 'General',
      }));

      const { error: qErr } = await supabase.from('questions').insert(questionsPayload);
      if (qErr) throw qErr;

      navigate('/admin');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to update assessment.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-zinc-500 font-medium">Loading Assessment Data...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-teal-800 hover:text-teal-900 text-xs font-bold mb-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">Edit Assessment</h1>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-medium rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Layers className="w-4 h-4 text-teal-800" />
            <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Assessment Settings</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Exam Title</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700" />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Instructions / Description</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-none" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700">Duration (Minutes)</label>
              <div className="relative">
                <input type="number" min={1} required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className="w-full pl-9 pr-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700" />
                <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 md:col-span-2">
              <label className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-semibold text-zinc-800 cursor-pointer">
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 accent-teal-700" /> Published
              </label>
              <label className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-semibold text-zinc-800 cursor-pointer">
                <input type="checkbox" checked={showResults} onChange={(e) => setShowResults(e.target.checked)} className="w-4 h-4 accent-teal-700" /> Release Score to Students
              </label>
              <label className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-semibold text-zinc-800 cursor-pointer">
                <input type="checkbox" checked={showDetailedResults} onChange={(e) => setShowDetailedResults(e.target.checked)} className="w-4 h-4 accent-teal-700" /> Show Answer Key Breakdown
              </label>
              <label className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs font-semibold text-zinc-800 cursor-pointer">
                <input type="checkbox" checked={showLeaderboard} onChange={(e) => setShowLeaderboard(e.target.checked)} className="w-4 h-4 accent-teal-700" /> Enable Public Leaderboard
              </label>
              
              <label className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200/80 rounded-xl text-xs font-bold text-teal-900 cursor-pointer col-span-2 mt-2">
                <input type="checkbox" checked={hasCategories} onChange={(e) => setHasCategories(e.target.checked)} className="w-4 h-4 accent-teal-700" /> 
                Enable Category Selection (Language Tracks)
              </label>

              {hasCategories && (
                <div className="col-span-2 p-5 bg-teal-50/40 border border-teal-200/60 rounded-xl space-y-4 mt-2 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">Selection Screen Title</label>
                    <input type="text" value={categoryTitle} onChange={(e) => setCategoryTitle(e.target.value)} placeholder="e.g., Select Your Technology Stack" className="w-full px-3.5 py-2.5 bg-white border border-teal-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">Selection Screen Message</label>
                    <textarea rows={2} value={categoryMessage} onChange={(e) => setCategoryMessage(e.target.value)} placeholder="e.g., Please select the technology you wish to be tested on..." className="w-full px-3.5 py-2.5 bg-white border border-teal-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-none" />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200/80 rounded-xl text-xs font-bold text-purple-900 cursor-pointer col-span-2 mt-2">
                <input type="checkbox" checked={allowAiAssistant} onChange={(e) => setAllowAiAssistant(e.target.checked)} className="w-4 h-4 accent-purple-700" /> 
                <Sparkles className="w-4 h-4" /> Enable AI Assistant
              </label>

              {/* NEW: DYNAMIC CONFIGURATION FOR AI SETTINGS */}
              {allowAiAssistant && (
                <div className="col-span-2 grid grid-cols-2 gap-4 p-5 bg-purple-50/50 border border-purple-200/60 rounded-xl mt-2 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">Attempts per Student</label>
                    <input 
                      type="number" min="1" max="10"
                      value={aiAttemptsLimit} 
                      onChange={(e) => setAiAttemptsLimit(e.target.value)} 
                      className="w-full px-3.5 py-2.5 bg-white border border-purple-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-purple-700/20 focus:border-purple-700" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">Word Limit per Response</label>
                    <input 
                      type="number" min="50" step="50"
                      value={aiWordLimit} 
                      onChange={(e) => setAiWordLimit(e.target.value)} 
                      className="w-full px-3.5 py-2.5 bg-white border border-purple-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-purple-700/20 focus:border-purple-700" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">Questions ({questions.length})</h3>
            <button type="button" onClick={addQuestion} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold hover:bg-teal-100 transition cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Question
            </button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-zinc-100 pb-3 gap-3">
                <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md">Question #{qIdx + 1}</span>
                
                <div className="flex items-center gap-3">
                  {hasCategories && (
                    <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1">
                      <Tag className="w-3.5 h-3.5 text-zinc-400" />
                      <input 
                        type="text" placeholder="Category" value={q.category} 
                        onChange={(e) => handleQuestionFieldChange(qIdx, 'category', e.target.value)}
                        className="bg-transparent text-xs font-bold text-zinc-700 w-28 focus:outline-none"
                      />
                    </div>
                  )}
                  <select value={q.type} onChange={(e) => handleTypeChange(qIdx, e.target.value)} className="px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-700">
                    <option value="single">Single Choice</option>
                    <option value="multiple">Multiple Choice</option>
                    <option value="boolean">True / False</option>
                    <option value="text">Descriptive / Essay</option>
                  </select>
                  <button type="button" onClick={() => removeQuestion(qIdx)} className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700">Question Statement</label>
                <textarea rows={2} required value={q.question_text} onChange={(e) => handleQuestionFieldChange(qIdx, 'question_text', e.target.value)} className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">Points for Correct Answer</label>
                  <input type="number" step="0.5" min="0" required value={q.marks} onChange={(e) => handleQuestionFieldChange(qIdx, 'marks', e.target.value)} className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">Penalty for Wrong Answer</label>
                  <input type="number" step="0.25" min="0" required value={q.negative_marks} onChange={(e) => handleQuestionFieldChange(qIdx, 'negative_marks', e.target.value)} className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900" />
                </div>
              </div>

              {q.type !== 'text' && (
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">Options (Check the correct answers):</label>
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2.5">
                      <button type="button" onClick={() => handleCorrectAnswerToggle(qIdx, oIdx)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition border cursor-pointer ${q.correct_answers.includes(oIdx) ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-zinc-100 border-zinc-300 text-zinc-300'}`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <input type="text" required disabled={q.type === 'boolean'} value={opt} onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)} className={`flex-1 px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none ${q.correct_answers.includes(oIdx) ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 font-semibold' : 'border-zinc-200 bg-zinc-50 text-zinc-900'}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/admin" className="px-5 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition">Cancel</Link>
          <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50">
            {isSaving ? 'Saving Updates...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}