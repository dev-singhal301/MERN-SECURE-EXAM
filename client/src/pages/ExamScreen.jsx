import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useAntiCheat } from '../hooks/useAntiCheat';
import QuestionPalette from '../components/QuestionPalette';
import { AlertOctagon, Clock, Maximize2, ArrowRight, ArrowLeft, Send, AlertTriangle, X, Code2, Sparkles, Loader2, Eraser } from 'lucide-react';

export default function ExamScreen() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]); 
  const [questions, setQuestions] = useState([]); 
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [endTime, setEndTime] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // AI Assistant State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [aiPrompt, setAiPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState([]); 
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);

  const liveState = useRef({
    answers, questions, exam, timeLeft, selectedCategory, aiUsageCount, isSubmitting
  });

  useEffect(() => {
    liveState.current = { answers, questions, exam, timeLeft, selectedCategory, aiUsageCount, isSubmitting };
  }, [answers, questions, exam, timeLeft, selectedCategory, aiUsageCount, isSubmitting]);

  const hasHandledExit = useRef(false);
  const strikesStorageKey = `strikes_${id}_${user?.id || 'guest'}`;
  const categoryStorageKey = `exam_cat_${id}_${user?.id || 'guest'}`;

  const handleTermination = async (strikeCount) => {
    await submitTest(true, strikeCount);
  };

  const { strikes, isFullscreen, isWarningActive, requestFullscreen } = useAntiCheat(
    3,
    handleTermination,
    strikesStorageKey
  );

  useEffect(() => {
    let isMounted = true;

    const fetchExam = async () => {
      if (hasHandledExit.current) return;

      const { data: examData } = await supabase.from('exams').select('*').eq('id', id).single();
      const { data: qData } = await supabase.from('questions').select('*').eq('exam_id', id);

      if (!isMounted) return;

      if (!examData || !qData) {
        if (!hasHandledExit.current) {
          hasHandledExit.current = true;
          alert('Exam not found or inaccessible.');
          navigate('/', { replace: true });
        }
        return;
      }

      if (examData.is_ended) {
        if (!hasHandledExit.current) {
          hasHandledExit.current = true;
          alert('This assessment has concluded and is no longer accepting submissions.');
          navigate('/', { replace: true });
        }
        return;
      }

      const { data: existingSub } = await supabase
        .from('submissions')
        .select('id, status, is_terminated, selected_category, ai_usage_count, end_time')
        .eq('exam_id', id)
        .eq('student_id', user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (existingSub && (existingSub.status === 'completed' || existingSub.is_terminated)) {
        if (!hasHandledExit.current) {
          hasHandledExit.current = true;
          alert('You have already completed or been disqualified from this assessment.');
          navigate('/', { replace: true });
        }
        return;
      }

      const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

      const randomizedQuestions = shuffle(qData).map((q) => {
        const indexedOptions = (q.options || []).map((opt, idx) => ({ text: opt, originalIndex: idx }));
        return { ...q, shuffledOptions: shuffle(indexedOptions) };
      });

      setExam(examData);
      setAllQuestions(randomizedQuestions);

      if (existingSub) {
        setSubmissionId(existingSub.id);
        setAiUsageCount(existingSub.ai_usage_count || 0);
        if (existingSub.end_time) {
          setEndTime(existingSub.end_time);
          const remaining = Math.max(0, Math.floor((new Date(existingSub.end_time).getTime() - Date.now()) / 1000));
          setTimeLeft(remaining);
        } else {
          setTimeLeft(examData.duration_minutes * 60);
        }
      } else {
        setTimeLeft(examData.duration_minutes * 60);
      }

      if (examData.has_categories) {
        const uniqueCats = [...new Set(randomizedQuestions.map(q => q.category))].filter(Boolean);
        setAvailableCategories(uniqueCats);

        const savedCat = existingSub?.selected_category || localStorage.getItem(categoryStorageKey);
        if (savedCat) {
          setSelectedCategory(savedCat);
          setQuestions(randomizedQuestions.filter(q => q.category === savedCat));
        }
      } else {
        setQuestions(randomizedQuestions);
      }

      const savedAnswers = localStorage.getItem(`exam_${id}_${user.id}`);
      if (savedAnswers) setAnswers(JSON.parse(savedAnswers));

      setLoading(false);
    };

    if (user) fetchExam();
    return () => { isMounted = false; };
  }, [id, user, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    const channel = supabase
      .channel(`live_candidate_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'submissions', filter: `student_id=eq.${user.id}` },
        (payload) => {
          if (payload.new && payload.new.is_terminated && payload.new.exam_id === id) {
            if (!hasHandledExit.current) {
              hasHandledExit.current = true;
              alert('Your session has been terminated by the administrator.');
              localStorage.removeItem(`exam_${id}_${user.id}`);
              localStorage.removeItem(strikesStorageKey);
              localStorage.removeItem(categoryStorageKey);
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              navigate(`/result/${id}`, { replace: true });
            }
          }
        }
      ).subscribe();
    return () => supabase.removeChannel(channel);
  }, [id, user, navigate, strikesStorageKey]);

  useEffect(() => {
    if (loading || !endTime) return;
    
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        submitTest(false, strikes);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [loading, endTime, strikes]);

  const handleCategorySelection = (cat) => {
    setSelectedCategory(cat);
    localStorage.setItem(categoryStorageKey, cat);
    setQuestions(allQuestions.filter(q => q.category === cat));
  };

  const handleStartExam = async () => {
    await requestFullscreen();
    
    const calculatedEndTime = new Date(Date.now() + (exam.duration_minutes * 60 * 1000)).toISOString();

    const payload = {
      exam_id: id,
      student_id: user.id,
      student_name: profile?.full_name || 'Student',
      student_email: user.email,
      status: 'in_progress',
      violations_count: strikes,
      is_terminated: false,
      selected_category: selectedCategory,
      ai_usage_count: aiUsageCount
    };

    try {
      const { data: existing } = await supabase.from('submissions')
        .select('id, end_time').eq('exam_id', id).eq('student_id', user.id).maybeSingle();

      const finalEndTime = existing?.end_time || calculatedEndTime;
      payload.end_time = finalEndTime;

      let newSub;
      if (existing) {
        const { data, error } = await supabase.from('submissions').update(payload).eq('id', existing.id).select().single();
        if (error) throw error;
        newSub = data;
      } else {
        const { data, error } = await supabase.from('submissions').insert(payload).select().single();
        if (error) throw error;
        newSub = data;
      }
      
      if (newSub) {
        setSubmissionId(newSub.id);
        setEndTime(newSub.end_time);
      }
    } catch (err) {
      console.error("Database Error starting exam:", err);
      alert("Error starting exam: " + err.message + "\n\nPlease ensure your user profile is configured correctly.");
    }
  };

  const handleSelectOption = (value, type) => {
    const qId = questions[currentIndex].id;
    const nextAnswers = { ...answers };

    if (type === 'text' || type === 'single' || type === 'boolean') {
      nextAnswers[qId] = value;
    } else if (type === 'multiple') {
      const currentList = nextAnswers[qId] || [];
      if (currentList.includes(value)) {
        nextAnswers[qId] = currentList.filter((i) => i !== value);
      } else {
        nextAnswers[qId] = [...currentList, value];
      }
    }
    setAnswers(nextAnswers);
    localStorage.setItem(`exam_${id}_${user.id}`, JSON.stringify(nextAnswers));
  };

  // --- NEW CLEAR SELECTION FUNCTION ---
  const handleClearSelection = () => {
    const qId = questions[currentIndex].id;
    const nextAnswers = { ...answers };
    delete nextAnswers[qId];
    setAnswers(nextAnswers);
    localStorage.setItem(`exam_${id}_${user.id}`, JSON.stringify(nextAnswers));
  };

  const handleAskAI = async () => {
    const maxAttempts = exam?.ai_attempts_limit || 2;
    const wordLimit = exam?.ai_word_limit || 500;
    
    if (aiUsageCount >= maxAttempts) return;
    if (!aiPrompt.trim()) return;

    const currentPrompt = aiPrompt.trim();
    
    setChatHistory(prev => [...prev, { role: 'user', text: currentPrompt }]);
    setAiPrompt(''); 

    const newCount = aiUsageCount + 1;
    setAiUsageCount(newCount);
    if (submissionId) {
      await supabase.from('submissions').update({ ai_usage_count: newCount }).eq('id', submissionId);
    }

    setIsAiLoading(true);

    const currentQText = questions[currentIndex]?.question_text || '';
    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!geminiKey) {
      setAiUsageCount((prev) => prev - 1);
      if (submissionId) supabase.from('submissions').update({ ai_usage_count: aiUsageCount }).eq('id', submissionId);
      
      setChatHistory(prev => [...prev, { role: 'assistant', text: "⚠️ System Error: AI API Key not configured by administrator." }]);
      setIsAiLoading(false);
      return;
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an educational assistant helping a student during an assessment. \nCase Study Context: "${currentQText}"\nStudent's Question: "${currentPrompt}"\n\nProvide a helpful hint or structural guidance. DO NOT provide the direct answer. Provide detailed guidance, keeping your response under ${wordLimit} words.`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 2048, 
            temperature: 0.2 
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { 
          status: response.status, 
          message: errorData?.error?.message || "API request failed" 
        };
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const botReply = data.candidates[0].content.parts[0].text;
        setChatHistory(prev => [...prev, { role: 'assistant', text: botReply }]);
      } else {
        throw new Error("No candidates returned from AI.");
      }
      
    } catch (err) {
      console.error("AI API Error:", err);
      
      setAiUsageCount((prev) => prev - 1);
      if (submissionId) {
        supabase.from('submissions').update({ ai_usage_count: aiUsageCount }).eq('id', submissionId);
      }
      
      if (err?.status === 429 || err?.message?.toLowerCase().includes("quota")) {
        setChatHistory(prev => [...prev, { role: 'assistant', text: "⏳ The AI Assistant has reached its daily limit and is currently resting. Please answer this question manually!" }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', text: "⚠️ The AI Assistant is temporarily unavailable. Please try again later." }]);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const submitTest = async (isTerminated = false, finalStrikes = strikes) => {
    const current = liveState.current; 
    
    if (current.isSubmitting) return;
    setIsSubmitting(true);
    liveState.current.isSubmitting = true;

    const totalDurationSeconds = (current.exam?.duration_minutes || 0) * 60;
    const timeSpentSeconds = Math.max(0, totalDurationSeconds - current.timeLeft);

    let calculatedScore = 0;
    
    current.questions.forEach((q) => {
      const userAns = current.answers[q.id];
      const correct = q.correct_answers || [];
      const positiveMarks = q.marks || 1;
      const negativeMarks = q.negative_marks || 0;

      if (q.type === 'single' || q.type === 'boolean') {
        if (userAns !== undefined) {
          if (correct.includes(userAns)) calculatedScore += positiveMarks;
          else calculatedScore -= negativeMarks;
        }
      } else if (q.type === 'multiple') {
        if (Array.isArray(userAns) && userAns.length > 0) {
          const isCorrect = userAns.length === correct.length && userAns.every((val) => correct.includes(val));
          if (isCorrect) calculatedScore += positiveMarks;
          else calculatedScore -= negativeMarks;
        }
      }
    });

    const payload = {
      exam_id: id,
      student_id: user.id,
      student_name: profile?.full_name || 'Student',
      student_email: user.email,
      answers: current.answers,
      score: calculatedScore,
      violations_count: finalStrikes,
      is_terminated: isTerminated,
      status: isTerminated ? 'terminated' : 'completed',
      time_taken_seconds: timeSpentSeconds,
      selected_category: current.selectedCategory,
      ai_usage_count: current.aiUsageCount,
      submitted_at: new Date().toISOString(),
    };

    try {
      const { data: existing } = await supabase.from('submissions')
        .select('id').eq('exam_id', id).eq('student_id', user.id).maybeSingle();

      if (existing) {
        const { error } = await supabase.from('submissions').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('submissions').insert(payload);
        if (error) throw error;
      }
    } catch (err) {
      console.error("Submission Error:", err);
      alert("CRITICAL ERROR: Failed to save submission to the database!\n\nReason: " + err.message + "\n\nPlease take a screenshot of your answers before leaving this page.");
      setIsSubmitting(false);
      liveState.current.isSubmitting = false;
      return; 
    }

    localStorage.removeItem(`exam_${id}_${user.id}`);
    localStorage.removeItem(strikesStorageKey);
    localStorage.removeItem(categoryStorageKey);

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    navigate(`/result/${id}`, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center font-medium text-zinc-600">
        Initializing Secure Assessment Environment...
      </div>
    );
  }

  if (exam?.has_categories && !selectedCategory) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6">
        <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl space-y-6">
          <div className="w-14 h-14 bg-indigo-950 border border-indigo-800 text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Code2 className="w-7 h-7" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              {exam?.category_selection_title || 'Select Your Track'}
            </h1>
            <p className="text-zinc-400 text-xs leading-relaxed">
              {exam?.category_selection_message || 'Please select the track you wish to be tested on. You cannot change this later.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-4">
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => handleCategorySelection(cat)}
                className="py-4 rounded-xl border border-zinc-700 bg-zinc-800/50 hover:bg-indigo-900/40 hover:border-indigo-600 hover:text-indigo-300 font-bold text-zinc-300 transition cursor-pointer"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isFullscreen && strikes < 3) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6">
        <div className="max-w-lg w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center shadow-2xl space-y-6">
          <div className="w-14 h-14 bg-teal-950 border border-teal-800 text-teal-400 rounded-xl flex items-center justify-center mx-auto">
            <Maximize2 className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">{exam.title}</h1>
            {selectedCategory && (
              <span className="inline-block bg-zinc-800 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded border border-zinc-700 uppercase tracking-wider">
                Track: {selectedCategory}
              </span>
            )}
            <p className="text-zinc-400 text-xs leading-relaxed pt-2">
              {strikes > 0
                ? `You currently have ${strikes} of 3 security strikes. Re-enter fullscreen mode to resume your assessment.`
                : 'This assessment enforces strict proctoring. Exiting fullscreen, switching tabs, or navigating away logs security violations. Reaching 3 strikes will automatically disqualify and terminate your session.'}
            </p>
          </div>
          <button
            onClick={handleStartExam}
            className="w-full py-3 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-xl transition shadow-md shadow-teal-950 cursor-pointer"
          >
            {strikes > 0 ? 'Re-enter Fullscreen & Resume' : 'Enter Fullscreen & Begin'}
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) return null; 

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isFinalTwoMinutes = timeLeft <= 120;
  const maxAttempts = exam?.ai_attempts_limit || 2;

  const answeredCount = Object.keys(answers).filter((qId) => {
    const val = answers[qId];
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim().length > 0;
    return val !== undefined;
  }).length;
  
  const unattemptedCount = questions.length - answeredCount;

  const paletteAnswers = {};
  questions.forEach((q, idx) => {
    paletteAnswers[idx] = answers[q.id];
  });

  // Check if current question has an answer recorded
  const currentAnswer = answers[currentQ.id];
  const hasAnswer = currentAnswer !== undefined && (!Array.isArray(currentAnswer) || currentAnswer.length > 0);

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col select-none relative">
      {/* AI Assistant Drawer */}
      {exam?.allow_ai_assistant && showAiModal && (
        <div className="fixed top-0 right-0 w-96 h-full bg-white border-l border-zinc-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right">
          <div className="p-4 bg-purple-900 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-300" />
              <h3 className="font-bold text-sm">AI Case Study Assistant</h3>
            </div>
            <button onClick={() => setShowAiModal(false)} className="text-purple-300 hover:text-white transition cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-4 bg-purple-50 text-xs font-semibold text-purple-900 border-b border-purple-100 flex justify-between">
            <span>Guidance allowed during this exam</span>
            <span>Used: {aiUsageCount} / {maxAttempts}</span>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <div className="text-xs text-zinc-500 italic bg-zinc-50 p-3 rounded-xl border border-zinc-100 text-center">
              I have full context of Question #{currentIndex + 1}. Ask me for hints or structural guidance regarding this case study.
            </div>
            
            {chatHistory.map((chat, idx) => (
              <div key={idx} className={`p-4 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                chat.role === 'user' 
                  ? 'bg-purple-100 border border-purple-200 text-purple-900 ml-8 rounded-tr-sm shadow-sm' 
                  : 'bg-zinc-100 border border-zinc-200 text-zinc-800 mr-8 rounded-tl-sm shadow-sm'
              }`}>
                <strong className={`block mb-1.5 font-bold ${chat.role === 'user' ? 'text-purple-950' : 'text-zinc-900'}`}>
                  {chat.role === 'user' ? 'You:' : 'AI Guide:'}
                </strong>
                {chat.text}
              </div>
            ))}
            
            {isAiLoading && (
              <div className="bg-zinc-100 border border-zinc-200 text-zinc-500 p-4 mr-8 rounded-xl rounded-tl-sm text-xs flex items-center gap-2 w-max">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing context...
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-200 bg-zinc-50 space-y-3">
            <textarea 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={aiUsageCount >= maxAttempts || isAiLoading}
              placeholder={aiUsageCount >= maxAttempts ? "Usage limit reached." : "Ask for a hint..."}
              className="w-full resize-none h-20 px-3 py-2 text-xs border border-zinc-300 rounded-lg focus:border-purple-600 focus:outline-none disabled:bg-zinc-100"
            />
            <button 
              onClick={handleAskAI}
              disabled={aiUsageCount >= maxAttempts || isAiLoading || !aiPrompt.trim()}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Ask AI
            </button>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2.5 text-zinc-900 font-bold text-base">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Confirm Final Submission</span>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="text-zinc-400 hover:text-zinc-700 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">Are you sure you want to end your assessment?</p>
            <div className="grid grid-cols-2 gap-3 bg-zinc-50 border border-zinc-200/80 p-3.5 rounded-xl text-xs">
              <div><span className="text-zinc-500 block text-[11px]">Attempted</span><span className="text-teal-700 font-bold text-base">{answeredCount} questions</span></div>
              <div><span className="text-zinc-500 block text-[11px]">Unattempted</span><span className="text-amber-700 font-bold text-base">{unattemptedCount} questions</span></div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition cursor-pointer">Return to Exam</button>
              <button onClick={() => { setShowConfirmModal(false); submitTest(false, strikes); }} disabled={isSubmitting} className="flex-1 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer">Yes, Submit</button>
            </div>
          </div>
        </div>
      )}

      {isWarningActive && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white p-6">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-amber-950 border border-amber-800 text-amber-400 rounded-xl flex items-center justify-center animate-pulse mx-auto">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100">Security Breach Detected</h2>
            <p className="text-zinc-400 text-xs leading-relaxed">Violation <strong className="text-amber-400">{strikes} of 3</strong> has been logged.</p>
            <button onClick={requestFullscreen} className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 font-semibold rounded-xl text-white transition cursor-pointer">Resume Examination</button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-zinc-200 px-6 py-3.5 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-zinc-900 text-sm tracking-tight">{exam.title}</h2>
            {selectedCategory && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded uppercase">{selectedCategory}</span>}
            <span className="text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded ml-2">Strikes: <span className={strikes > 0 ? "text-red-600 font-bold" : "text-zinc-800"}>{strikes} / 3</span></span>
          </div>

          <div className="flex items-center gap-3">
            {exam?.allow_ai_assistant && (
              <button 
                onClick={() => setShowAiModal(!showAiModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 text-xs font-bold transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> AI Help ({maxAttempts - aiUsageCount} left)
              </button>
            )}

            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border font-mono text-sm font-bold transition-colors ${isFinalTwoMinutes ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <Clock className="w-4 h-4" />
              <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-7 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wider bg-teal-50 px-2.5 py-1 rounded-md">Question {currentIndex + 1} of {questions.length} - {currentQ.type}</span>
              <span className="text-[11px] font-bold text-zinc-500 tracking-wide bg-zinc-50 px-2.5 py-1 border border-zinc-200 rounded-md">[{currentQ.marks} {currentQ.marks === 1 ? 'Mark' : 'Marks'}]</span>
            </div>

            <p className="text-zinc-900 font-semibold text-lg leading-relaxed whitespace-pre-wrap">{currentQ.question_text}</p>

            <div className="space-y-3 pt-2">
              {currentQ.type === 'text' ? (
                <textarea
                  rows={6}
                  placeholder="Type your detailed response here..."
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleSelectOption(e.target.value, 'text')}
                  className="w-full px-4 py-3 bg-white border border-zinc-300 rounded-xl text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-none"
                />
              ) : (
                currentQ.shuffledOptions.map((opt, oIdx) => {
                  const isSelected = currentQ.type === 'multiple' ? (answers[currentQ.id] || []).includes(opt.originalIndex) : answers[currentQ.id] === opt.originalIndex;
                  return (
                    <label key={oIdx} onClick={() => handleSelectOption(opt.originalIndex, currentQ.type)} className={`flex items-center gap-3.5 p-4 rounded-xl border text-sm font-medium transition-all cursor-pointer ${isSelected ? 'border-teal-700 bg-teal-50/60 text-zinc-950 shadow-xs' : 'border-zinc-200 bg-white hover:bg-zinc-50/80 text-zinc-700'}`}>
                      <input type={currentQ.type === 'multiple' ? 'checkbox' : 'radio'} checked={isSelected} onChange={() => {}} className="w-4 h-4 accent-teal-700 focus:ring-0" />
                      <span className="flex-1">{opt.text}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <button 
              disabled={currentIndex === 0} 
              onClick={() => setCurrentIndex((p) => p - 1)} 
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-300 font-semibold text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-30 disabled:pointer-events-none transition text-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Previous Question
            </button>

            {/* NEW CLEAR SELECTION BUTTON */}
            {hasAnswer && (
              <button 
                onClick={handleClearSelection}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-200 font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition text-xs cursor-pointer"
              >
                <Eraser className="w-4 h-4" /> Clear Selection
              </button>
            )}

            <button 
              disabled={currentIndex === questions.length - 1} 
              onClick={() => setCurrentIndex((p) => p + 1)} 
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-white transition text-xs shadow-xs cursor-pointer"
            >
              Next Question <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <QuestionPalette total={questions.length} current={currentIndex} answers={paletteAnswers} onSelect={(idx) => setCurrentIndex(idx)} />
          <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs space-y-3">
            <button type="button" onClick={() => setShowConfirmModal(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 font-bold text-white transition text-xs shadow-xs cursor-pointer">
              <Send className="w-3.5 h-3.5" /> Submit Assessment
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}