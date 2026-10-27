import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Plus, Trash2, CheckCircle2, 
  Layers, Clock, AlertCircle, Tag, Upload, Download, Sparkles 
} from 'lucide-react';

export default function CreateExam() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isPublished, setIsPublished] = useState(false);
  const [showResults, setShowResults] = useState(false); // FIXED: Default unchecked
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  const [hasCategories, setHasCategories] = useState(false);
  const [categoryTitle, setCategoryTitle] = useState('Select Your Track');
  const [categoryMessage, setCategoryMessage] = useState('Please select the track you wish to be tested on. You cannot change this later.');
  
  const [allowAiAssistant, setAllowAiAssistant] = useState(false);
  // NEW: Dynamic AI Configuration State
  const [aiWordLimit, setAiWordLimit] = useState(200);
  const [aiAttemptsLimit, setAiAttemptsLimit] = useState(2);

  const [questions, setQuestions] = useState([{
    question_text: '', type: 'single', options: ['', '', '', ''],
    correct_answers: [0], marks: 1, negative_marks: 0, category: 'General',
  }]);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const addQuestion = () => {
    setQuestions([...questions, {
      question_text: '', type: 'single', options: ['', '', '', ''],
      correct_answers: [0], marks: 1, negative_marks: 0, category: 'General',
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

  const downloadTemplate = () => {
    const headers = "Type,Category,Marks,Negative Marks,Question Statement,Option 1,Option 2,Option 3,Option 4,Correct Answers (0-indexed separated by semicolon)\n";
    const sample1 = 'single,Java,2,0.5,"What is a JVM?","Java Virtual Machine","Java Visual Model","Just Virtual Machine","None",0\n';
    const sample2 = 'multiple,Python,4,1,"Which of these are data types?","List","Tuple","Car","Dog","0;1"\n';
    const sample3 = 'boolean,General,1,0,"The earth is flat.","True","False","","",1\n';
    const sample4 = 'text,C++,10,0,"Explain pointers and memory allocation in C++.","","","","",\n';
    
    const blob = new Blob([headers + sample1 + sample2 + sample3 + sample4], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Exam_Import_Template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(row => row.trim() !== '');
      const importedQuestions = [];
      
      for (let i = 1; i < rows.length; i++) {
        let str = rows[i];
        const cols = [];
        let cur = '';
        let inQuote = false;
        
        for (let j = 0; j < str.length; j++) {
            if (str[j] === '"') {
                inQuote = !inQuote;
            } else if (str[j] === ',' && !inQuote) {
                cols.push(cur.trim());
                cur = '';
            } else {
                cur += str[j];
            }
        }
        cols.push(cur.trim());

        if (cols.length < 5) continue; 

        const type = cols[0].toLowerCase() || 'single';
        const category = cols[1] || 'General';
        const marks = parseFloat(cols[2]) || 1;
        const negative_marks = parseFloat(cols[3]) || 0;
        const question_text = cols[4] || '';
        
        let options = [];
        let correct_answers = [];

        if (type !== 'text') {
          options = [cols[5] || '', cols[6] || '', cols[7] || '', cols[8] || ''];
          const correctStr = cols[9] || '0';
          correct_answers = correctStr.split(';').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        }

        importedQuestions.push({
          type, category, marks, negative_marks, question_text, options,
          correct_answers: correct_answers.length ? correct_answers : [0]
        });
      }

      if (importedQuestions.length > 0) {
        const currentQs = [...questions];
        if (currentQs.length === 1 && currentQs[0].question_text.trim() === '') {
          setQuestions(importedQuestions);
        } else {
          setQuestions([...currentQs, ...importedQuestions]);
        }
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
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

    setLoading(true);

    try {
      const { data: examData, error: examErr } = await supabase
        .from('exams')
        .insert({
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
          created_by: user.id,
        })
        .select()
        .single();

      if (examErr) throw examErr;

      const questionsPayload = questions.map((q) => ({
        exam_id: examData.id,
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
      setErrorMsg(err.message || 'Failed to create assessment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-teal-800 hover:text-teal-900 text-xs font-bold mb-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
          </Link>
          <h1 className="text-xl font-bold text-zinc-900">Create New Assessment</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadTemplate} type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs font-bold hover:bg-zinc-200 transition cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Template
          </button>
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} type="button" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Bulk Import CSV
          </button>
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
                <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="w-4 h-4 accent-teal-700" /> Publish Immediately
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
                Enable Category Selection (Students pick a language/subject before starting)
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
                <textarea rows={2} required value={q.question_text} onChange={(e) => handleQuestionFieldChange(qIdx, 'question_text', e.target.value)} placeholder="Enter the question text or case study..." className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900 focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">Points for Correct Answer</label>
                  <input type="number" step="0.5" min="0" required value={q.marks} onChange={(e) => handleQuestionFieldChange(qIdx, 'marks', e.target.value)} className="w-full px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium text-zinc-900" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">Penalty for Wrong Answer (Negative Marks)</label>
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
                      <input type="text" required disabled={q.type === 'boolean'} value={opt} onChange={(e) => handleOptionChange(qIdx, oIdx, e.target.value)} placeholder={`Option ${oIdx + 1}`} className={`flex-1 px-3 py-2 border rounded-xl text-xs font-medium focus:outline-none ${q.correct_answers.includes(oIdx) ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 font-semibold' : 'border-zinc-200 bg-zinc-50 text-zinc-900'}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link to="/admin" className="px-5 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition">Cancel</Link>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50">
            {loading ? 'Creating Assessment...' : 'Save & Create Exam'}
          </button>
        </div>
      </form>
    </div>
  );
}