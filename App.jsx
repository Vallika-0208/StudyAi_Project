import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './components/Dashboard.css';
import { jsPDF } from 'jspdf';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);


const API_BASE = "https://studyai-project-1-m806.onrender.com/api";

// Mee requests ila undali:
// axios.get(`${API_URL}/your-endpoint`)

export default function App() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('studyai_auth') === 'true';
  });
  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('studyai_user') || '';
  });

  // Tabs: 'dashboard' | 'quiz' | 'flashcards' | 'summary' | 'analytics'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [groqConfigured, setGroqConfigured] = useState(false);
  const [firebaseConfigured, setFirebaseConfigured] = useState(false);

  // Input Workspaces: 'upload' | 'manual'
  const [inputMode, setInputMode] = useState('upload');
  const [studyText, setStudyText] = useState('');
  
  // File Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [uploadedMaterialId, setUploadedMaterialId] = useState(null);
  const [materialFilename, setMaterialFilename] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Summary Generator States
  const [summaryContent, setSummaryContent] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  // Quiz Engine State
  const [quizList, setQuizList] = useState([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null); 
  const [answeredState, setAnsweredState] = useState(false); 
  const [quizScore, setQuizScore] = useState(0);
  const [quizError, setQuizError] = useState('');
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizNumQuestions, setQuizNumQuestions] = useState(5);
  const [quizType, setQuizType] = useState('mcq');
  
  // Quiz Timer State
  const [quizTimer, setQuizTimer] = useState(0);
  const [quizTimeLimit, setQuizTimeLimit] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  // Quiz Short Answer & Self Grading
  const [shortAnswerInput, setShortAnswerInput] = useState('');
  const [isSelfGrading, setIsSelfGrading] = useState(false);
  
  // Weak Topics & Quiz History
  const [weakTopics, setWeakTopics] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [quizHistory, setQuizHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Flashcards State
  const [flashcardList, setFlashcardList] = useState([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [cardsError, setCardsError] = useState('');
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  const [learnedCardIds, setLearnedCardIds] = useState(new Set());
  const [flashcardSearch, setFlashcardSearch] = useState('');

  // Previous Study Buddy Chat State (Coach with Memory and Suggestions)
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your LLaMA 3.3 Study Coach. Drag & drop study material (PDF, DOCX, TXT) or paste it manually on the left, then generate quizzes, flashcards, or complete study summaries! Ask me any follow-up questions!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  
  // 7-Day Study Planner State
  const [plannerDays, setPlannerDays] = useState([]);
  const [activePlannerDay, setActivePlannerDay] = useState(0);
  const [isGeneratingPlanner, setIsGeneratingPlanner] = useState(false);
  const [plannerError, setPlannerError] = useState('');
  
  // Analytics Dashboard State
  const [analyticsData, setAnalyticsData] = useState({
    weekly_hours: [2.0, 3.5, 1.5, 4.0, 3.0, 5.0, 2.5],
    streak: 5,
    total_study_time: 21.5,
    flashcards_learned: 0,
    quiz_trend: [],
    avg_score: 0,
    weak_topics: []
  });
  const [aiInsights, setAiInsights] = useState('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);

  // Custom Toast Notifications
  const [toasts, setToasts] = useState([]);

  // Quick tasks for core dashboard
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Study LLaMA 3.3 model specifications', completed: false },
    { id: 2, text: 'Run Flask backend servers locally', completed: true },
    { id: 3, text: 'Complete custom quiz on study notes', completed: false },
  ]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [aiSchedule, setAiSchedule] = useState('');
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [dailyTip, setDailyTip] = useState('');
  const [isTipLoading, setIsTipLoading] = useState(false);

  // Toast Helper
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => setToasts(current => current.filter(t => t.id !== id)));
    }, 4000);
  };

  const handleLogout = () => {
    localStorage.removeItem('studyai_auth');
    localStorage.removeItem('studyai_user');
    localStorage.removeItem('studyai_name');
    setIsAuthenticated(false);
    showToast('Successfully logged out.', 'info');
    navigate('/login');
  };


  const chatEndRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Health checks on mount
  useEffect(() => {
    checkBackendHealth();
    fetchDailyTip();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendStatus('connected');
        setGroqConfigured(data.groq_configured);
        setFirebaseConfigured(data.firebase_configured);
      } else {
        setBackendStatus('disconnected');
      }
    } catch (err) {
      setBackendStatus('disconnected');
    }
  };

  const fetchDailyTip = async () => {
    setIsTipLoading(true);
    try {
      const prompt = "Give a single, punchy study tip (max 15 words) for a dashboard widget.";
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        setDailyTip(data.response);
      } else {
        setDailyTip("Study in intervals and review key notes weekly. 💡");
      }
    } catch (err) {
      setDailyTip("Organize your schedule and get plenty of rest. 📚");
    } finally {
      setIsTipLoading(false);
    }
  };

  // File Upload Logic with progress tracking and validations
  const uploadFile = (file) => {
    // Front-end validations
    const sizeLimit = 10 * 1024 * 1024; // 10MB
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!['pdf', 'docx', 'doc', 'txt'].includes(ext)) {
      showToast('Unsupported file type. Please upload a PDF, DOCX, or TXT file.', 'error');
      setUploadError('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
      return;
    }
    
    if (file.size > sizeLimit) {
      showToast('File size exceeds the 10MB limit.', 'error');
      setUploadError('File size exceeds the 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError('');
    setPreviewText('');
    setUploadedMaterialId(null);
    setMaterialFilename(file.name);
    setShowPreview(false);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload-material`, true);

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentage);
      }
    };

    // Response handler
    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          setUploadedMaterialId(data.id);
          setPreviewText(data.preview);
          setStudyText(data.preview); // Fallback copy to studyText box
          setUploadProgress(100);
          setShowPreview(true);
          showToast('Material uploaded and text extracted successfully!', 'success');
        } catch (err) {
          setUploadError('Failed to parse upload response.');
          showToast('Failed to parse upload response.', 'error');
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          setUploadError(errData.error || 'Failed to upload file.');
          showToast(errData.error || 'Failed to upload file.', 'error');
        } catch (err) {
          setUploadError(`Upload failed with status code ${xhr.status}`);
          showToast(`Upload failed with status code ${xhr.status}`, 'error');
        }
      }
    };

    // Connection error handler
    xhr.onerror = () => {
      setIsUploading(false);
      setUploadError('Network error uploading file. Is the Flask server running?');
      showToast('Network error. Check if the Flask server is running.', 'error');
    };

    xhr.send(formData);
  };

  // Drag and Drop Event Listeners
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  // Save manual text as database material
  const handleSaveManualText = async () => {
    if (!studyText.trim()) {
      showToast('Please enter some study material text first.', 'warning');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    setUploadedMaterialId(null);
    setMaterialFilename('manual_input.txt');

    try {
      const response = await fetch(`${API_BASE}/upload-material`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: studyText, filename: 'manual_input.txt' })
      });

      if (response.ok) {
        const data = await response.json();
        setUploadedMaterialId(data.id);
        setPreviewText(data.preview);
        setUploadProgress(100);
        setShowPreview(true);
        showToast('Manual study material saved successfully!', 'success');
      } else {
        const err = await response.json();
        setUploadError(err.error || 'Failed to save text.');
        showToast(err.error || 'Failed to save text.', 'error');
      }
    } catch (err) {
      setUploadError('Connection error saving study material.');
      showToast('Connection error saving study material.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // State for tracking question correctness in current quiz session
  const [userAnswers, setUserAnswers] = useState([]);

  // useEffect for Quiz Timer
  useEffect(() => {
    let interval = null;
    if (timerActive && quizTimer > 0) {
      interval = setInterval(() => {
        setQuizTimer(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            clearInterval(interval);
            handleQuizTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, quizTimer]);

  const handleQuizTimeout = () => {
    showToast("Time expired! Submitting quiz results.", "warning");
    setAnsweredState(true);
    // Grade unfinished questions as wrong
    const answeredCount = userAnswers.length;
    const remainingCount = quizList.length - answeredCount;
    
    let updatedAnswers = [...userAnswers];
    for (let i = 0; i < remainingCount; i++) {
      updatedAnswers.push({
        questionIdx: answeredCount + i,
        isCorrect: false,
        topic: quizList[answeredCount + i]?.topic || 'General'
      });
    }
    
    setUserAnswers(updatedAnswers);
    setCurrentQuizIdx(quizList.length);
    finishQuiz(updatedAnswers);
  };

  // Sync data on mount
  useEffect(() => {
    fetchQuizHistory();
    fetchPlanner();
    fetchAnalytics();
  }, []);

  const fetchQuizHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/quiz-history`);
      if (res.ok) {
        const data = await res.json();
        setQuizHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch quiz history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchPlanner = async () => {
    try {
      const res = await fetch(`${API_BASE}/planner`);
      if (res.ok) {
        const data = await res.json();
        if (data.planner_data) {
          setPlannerDays(data.planner_data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch planner:', err);
    }
  };

  const fetchAnalytics = async () => {
    setIsAnalyticsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analytics`);
      if (res.ok) {
        const data = await res.json();
        // Synchronize learned count from local Set
        data.flashcards_learned = learnedCardIds.size;
        setAnalyticsData(data);
        
        if (data.avg_score || (data.weak_topics && data.weak_topics.length > 0)) {
          generateAiInsights(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  const generateAiInsights = async (analytics) => {
    setIsGeneratingInsights(true);
    try {
      const res = await fetch(`${API_BASE}/generate-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avg_score: analytics.avg_score,
          streak: analytics.streak,
          weak_topics: analytics.weak_topics,
          weekly_hours: analytics.weekly_hours
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiInsights(data.insights);
      }
    } catch (err) {
      console.error('Failed to generate insights:', err);
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Generate Quizzes via backend with custom settings and timer
  const handleGenerateQuiz = async () => {
    if (!studyText.trim() && !uploadedMaterialId) {
      showToast('Please upload a file or paste text first.', 'warning');
      return;
    }
    setIsGeneratingQuiz(true);
    setQuizError('');
    setQuizList([]);
    setCurrentQuizIdx(0);
    setQuizScore(0);
    setSelectedOption(null);
    setAnsweredState(false);
    setUserAnswers([]);
    setShortAnswerInput('');
    setIsSelfGrading(false);
    setTimerActive(false);
    setActiveTab('quiz');

    try {
      const response = await fetch(`${API_BASE}/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: uploadedMaterialId,
          text: uploadedMaterialId ? undefined : studyText,
          difficulty: quizDifficulty,
          num_questions: quizNumQuestions,
          quiz_type: quizType
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.quiz && data.quiz.length > 0) {
          setQuizList(data.quiz);
          
          // Configure timer: 40 seconds for MCQs, 80 seconds for Short Answers, per question
          const secondsPerQ = quizType === 'short' ? 80 : 45;
          const totalTime = data.quiz.length * secondsPerQ;
          setQuizTimer(totalTime);
          setQuizTimeLimit(totalTime);
          setTimerActive(true);
          showToast(`Quiz generated! Timer started: ${Math.floor(totalTime / 60)}m ${totalTime % 60}s`, 'info');
        } else {
          setQuizError('Failed to generate quiz questions. Try using longer notes.');
          showToast('Failed to generate quiz questions.', 'error');
        }
      } else {
        const err = await response.json();
        setQuizError(err.error || 'Server error generating quiz.');
        showToast(err.error || 'Server error generating quiz.', 'error');
      }
    } catch (err) {
      setQuizError('Network error. Check if the backend server is running.');
      showToast('Network error generating quiz.', 'error');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Generate Flashcards via backend
  const handleGenerateFlashcards = async () => {
    if (!studyText.trim() && !uploadedMaterialId) {
      showToast('Please upload a file or paste text first.', 'warning');
      return;
    }
    setIsGeneratingCards(true);
    setCardsError('');
    setFlashcardList([]);
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    setFlashcardSearch('');
    setActiveTab('flashcards');

    try {
      const response = await fetch(`${API_BASE}/generate-flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: uploadedMaterialId,
          text: uploadedMaterialId ? undefined : studyText
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.flashcards && data.flashcards.length > 0) {
          setFlashcardList(data.flashcards);
          showToast('8 Active-recall flashcards generated successfully!', 'success');
        } else {
          setCardsError('Failed to generate proper flashcards. Try again.');
          showToast('Failed to generate proper flashcards.', 'error');
        }
      } else {
        const err = await response.json();
        setCardsError(err.error || 'Server error generating flashcards.');
        showToast(err.error || 'Server error generating flashcards.', 'error');
      }
    } catch (err) {
      setCardsError('Network error. Check if the backend server is running.');
      showToast('Network error generating flashcards.', 'error');
    } finally {
      setIsGeneratingCards(false);
    }
  };

  // Generate AI Study Summary via LLaMA 3.3
  const handleGenerateSummary = async () => {
    if (!studyText.trim() && !uploadedMaterialId) {
      showToast('Please upload a file or paste text first.', 'warning');
      return;
    }
    setIsGeneratingSummary(true);
    setSummaryError('');
    setSummaryContent('');
    setActiveTab('summary');

    try {
      const response = await fetch(`${API_BASE}/generate-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: uploadedMaterialId,
          text: uploadedMaterialId ? undefined : studyText
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSummaryContent(data.summary);
        showToast('Study summary generated with exam tips!', 'success');
      } else {
        const err = await response.json();
        setSummaryError(err.error || 'Server error generating summary.');
        showToast(err.error || 'Server error generating summary.', 'error');
      }
    } catch (err) {
      setSummaryError('Network error. Check if the backend server is running.');
      showToast('Network error generating summary.', 'error');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Generate 7-Day study planner via backend
  const handleGeneratePlanner = async () => {
    if (!studyText.trim() && !uploadedMaterialId) {
      showToast('Please upload a file or paste text first to generate a plan.', 'warning');
      return;
    }
    setIsGeneratingPlanner(true);
    setPlannerError('');
    
    try {
      const response = await fetch(`${API_BASE}/generate-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: uploadedMaterialId,
          text: uploadedMaterialId ? undefined : studyText
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.planner && data.planner.length > 0) {
          setPlannerDays(data.planner);
          setActivePlannerDay(0);
          showToast('7-Day study planner generated successfully!', 'success');
          fetchAnalytics();
        } else {
          setPlannerError('Failed to parse 7-day planner structure.');
          showToast('Failed to generate 7-day planner.', 'error');
        }
      } else {
        const err = await response.json();
        setPlannerError(err.error || 'Server error generating planner.');
        showToast(err.error || 'Server error generating planner.', 'error');
      }
    } catch (err) {
      setPlannerError('Network error generating planner.');
      showToast('Network error generating planner.', 'error');
    } finally {
      setIsGeneratingPlanner(false);
    }
  };

  // 7-Day Study Planner Operations
  const handleTogglePlannerTask = (dayIdx, taskId) => {
    const updated = [...plannerDays];
    const task = updated[dayIdx].tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      setPlannerDays(updated);
      savePlannerState(updated);
      fetchAnalytics(); // Refresh analytics completion rate
    }
  };

  const handleDeletePlannerTask = (dayIdx, taskId) => {
    const updated = [...plannerDays];
    updated[dayIdx].tasks = updated[dayIdx].tasks.filter(t => t.id !== taskId);
    setPlannerDays(updated);
    savePlannerState(updated);
    showToast('Task removed from planner.', 'info');
    fetchAnalytics();
  };

  const handleEditPlannerTask = (dayIdx, taskId, newText, newDuration, newPriority) => {
    const updated = [...plannerDays];
    const task = updated[dayIdx].tasks.find(t => t.id === taskId);
    if (task) {
      if (newText !== undefined) task.task = newText;
      if (newDuration !== undefined) task.duration = parseInt(newDuration) || task.duration;
      if (newPriority !== undefined) task.priority = newPriority;
      setPlannerDays(updated);
      savePlannerState(updated);
      showToast('Task updated successfully.', 'success');
    }
  };

  const handleAddPlannerTask = (dayIdx, taskText, duration, priority, type) => {
    if (!taskText.trim()) return;
    const updated = [...plannerDays];
    const newTask = {
      id: `task-${Date.now()}`,
      task: taskText.trim(),
      duration: parseInt(duration) || 45,
      break_duration: 10,
      priority: priority || 'Medium',
      type: type || 'Study',
      completed: false
    };
    updated[dayIdx].tasks.push(newTask);
    setPlannerDays(updated);
    savePlannerState(updated);
    showToast('Task scheduled.', 'success');
    fetchAnalytics();
  };

  const savePlannerState = async (planData) => {
    try {
      await fetch(`${API_BASE}/planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planner_data: planData })
      });
    } catch (err) {
      console.error('Failed to sync planner:', err);
    }
  };

  // Flashcards Operations
  const handleToggleCardLearned = (cardId) => {
    setLearnedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
        showToast('Flashcard marked as unlearned.', 'info');
      } else {
        next.add(cardId);
        showToast('Flashcard marked as learned! 🎓', 'success');
      }
      saveFlashcardsState(next);
      // Update analytics in place
      setAnalyticsData(curr => ({ ...curr, flashcards_learned: next.size }));
      return next;
    });
  };

  const saveFlashcardsState = async (learnedSet) => {
    try {
      await fetch(`${API_BASE}/flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: uploadedMaterialId || "current_deck",
          cards_list: flashcardList,
          learned_card_ids: Array.from(learnedSet)
        })
      });
    } catch (err) {
      console.error('Failed to save flashcards state:', err);
    }
  };

  const handleShuffleCards = () => {
    if (flashcardList.length === 0) return;
    const shuffled = [...flashcardList].sort(() => Math.random() - 0.5);
    setFlashcardList(shuffled);
    setCurrentCardIdx(0);
    setIsCardFlipped(false);
    showToast('Flashcards shuffled!', 'success');
  };

  // Exporters: PDF and TXT File Downloads
  const downloadSummaryPDF = () => {
    if (!summaryContent) return;
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("StudyAI Summary Report", 14, 20);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);
    
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(summaryContent, 180);
    let y = 35;
    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 6;
    });
    doc.save("studyai-summary.pdf");
    showToast('Summary PDF downloaded!', 'success');
  };

  const downloadQuizReportPDF = () => {
    if (quizList.length === 0) return;
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.text("StudyAI Quiz Report Card", 14, 20);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()} | Score: ${quizScore} / ${quizList.length}`, 14, 25);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);
    
    let y = 35;
    quizList.forEach((q, idx) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("Helvetica", "bold");
      const qLines = doc.splitTextToSize(`Q${idx + 1}. ${q.question} (${q.topic || 'General'})`, 180);
      qLines.forEach(l => {
        doc.text(l, 14, y);
        y += 6;
      });
      
      doc.setFont("Helvetica", "normal");
      doc.text(`Correct Answer: ${q.answer}`, 18, y);
      y += 6;
      
      const explanationLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, 175);
      explanationLines.forEach(l => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(l, 18, y);
        y += 6;
      });
      y += 4;
    });
    doc.save("studyai-quiz-report.pdf");
    showToast('Quiz Report PDF downloaded!', 'success');
  };

  const exportFlashcards = () => {
    if (flashcardList.length === 0) return;
    let content = "=== STUDYAI FLASHCARDS ===\n\n";
    flashcardList.forEach((fc, idx) => {
      const learned = learnedCardIds.has(fc.id) ? "LEARNED" : "UNLEARNED";
      content += `Card ${idx + 1} [Topic: ${fc.topic || 'General'} | Difficulty: ${fc.difficulty || 'Medium'} | Status: ${learned}]\n`;
      content += `FRONT: ${fc.front}\n`;
      content += `BACK:  ${fc.back}\n`;
      content += "--------------------------------------\n\n";
    });
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "studyai-flashcards.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Flashcards exported!', 'success');
  };

  const exportStudyPlan = () => {
    if (plannerDays.length === 0) return;
    let content = "=== STUDYAI 7-DAY STUDY PLAN ===\n\n";
    plannerDays.forEach((dayData) => {
      content += `=== ${dayData.day} ===\n`;
      content += `AI Daily Tips: ${dayData.ai_tips ? dayData.ai_tips.join(", ") : 'Focus and study smart!'}\n\n`;
      dayData.tasks.forEach((t) => {
        content += `- [${t.completed ? 'X' : ' '}] ${t.task} (${t.duration}m study, ${t.break_duration}m break) [Priority: ${t.priority} | ${t.type}]\n`;
      });
      content += "\n";
    });
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "studyai-7day-plan.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Study Plan exported!', 'success');
  };

  const handleCopySummary = () => {
    if (!summaryContent) return;
    navigator.clipboard.writeText(summaryContent);
    showToast('Summary copied to clipboard!', 'success');
  };

  // Helper to extract suggested questions from LLM response
  const parseSuggestedQuestions = (text) => {
    const parts = text.split(/suggested questions:/i);
    if (parts.length > 1) {
      const qText = parts[1];
      const qLines = qText.split('\n')
        .map(line => line.replace(/^\d+[\.\-\s]*/, '').trim())
        .filter(line => line.length > 0);
      return qLines.slice(0, 3);
    }
    return [];
  };

  // Chat message submission with context memory and suggested questions parsing
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    setSuggestedQuestions([]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg].map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        const responseText = data.response;
        // Clean out suggested questions from main speech bubble display
        const mainResponse = responseText.split(/suggested questions:/i)[0].trim();
        const extractedQuestions = parseSuggestedQuestions(responseText);
        
        setChatMessages(prev => [...prev, { role: 'assistant', content: mainResponse }]);
        setSuggestedQuestions(extractedQuestions);
      } else {
        const errorData = await response.json();
        setChatMessages(prev => [
          ...prev, 
          { role: 'assistant', content: `Error: ${errorData.error || 'Failed to get response.'}` }
        ]);
        showToast('AI Coach error getting response.', 'error');
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev, 
        { role: 'assistant', content: 'Connection Error: Make sure the Flask backend is running.' }
      ]);
      showToast('Network error connecting to AI Coach.', 'error');
    } finally {
      setIsChatLoading(false);
    }
  };

  // Task Planner operations
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    setTasks(prev => [
      ...prev,
      { id: Date.now(), text: newTaskInput.trim(), completed: false }
    ]);
    setNewTaskInput('');
    showToast('Task added to core dashboard.', 'success');
  };

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    showToast('Task removed.', 'info');
  };

  const generateAiSchedule = async () => {
    const incompleteTasks = tasks.filter(t => !t.completed).map(t => t.text);
    if (incompleteTasks.length === 0) {
      setAiSchedule("All tasks completed!");
      return;
    }
    setIsScheduleLoading(true);
    setAiSchedule('');

    try {
      const prompt = `Create a short, step-by-step study schedule for these tasks: ${incompleteTasks.join(', ')}. Keep it extremely brief (max 3 simple bullet points).`;
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        // Remove suggested questions if any
        const mainPlan = data.response.split(/suggested questions:/i)[0].trim();
        setAiSchedule(mainPlan);
        showToast('Priority plan generated!', 'success');
      } else {
        setAiSchedule("Could not connect to priority generator.");
      }
    } catch (err) {
      setAiSchedule("Error connecting to server.");
    } finally {
      setIsScheduleLoading(false);
    }
  };

  // Quiz Interaction MCQ / True False / Short Answer
  const handleOptionSelect = (option) => {
    if (answeredState) return;
    setSelectedOption(option);
    setAnsweredState(true);
    const isCorrect = option === quizList[currentQuizIdx].answer;
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
    setUserAnswers(prev => [...prev, {
      questionIdx: currentQuizIdx,
      isCorrect,
      topic: quizList[currentQuizIdx].topic || 'General'
    }]);
  };

  const handleShortAnswerSubmit = (e) => {
    e.preventDefault();
    if (!shortAnswerInput.trim()) {
      showToast('Please type your answer before submitting.', 'warning');
      return;
    }
    setAnsweredState(true);
    setIsSelfGrading(true);
  };

  const handleSelfGrade = (isCorrect) => {
    setIsSelfGrading(false);
    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
    setUserAnswers(prev => [...prev, {
      questionIdx: currentQuizIdx,
      isCorrect,
      topic: quizList[currentQuizIdx].topic || 'General'
    }]);
  };

  const handleNextQuiz = () => {
    const nextIdx = currentQuizIdx + 1;
    setSelectedOption(null);
    setAnsweredState(false);
    setShortAnswerInput('');
    setIsSelfGrading(false);
    
    if (nextIdx >= quizList.length) {
      setTimerActive(false);
      finishQuiz(userAnswers);
    }
    setCurrentQuizIdx(nextIdx);
  };

  const finishQuiz = async (answersData) => {
    // Process weak topics
    const incorrect = answersData.filter(a => !a.isCorrect);
    const topicsMap = {};
    incorrect.forEach(ans => {
      topicsMap[ans.topic] = (topicsMap[ans.topic] || 0) + 1;
    });
    const weakList = Object.keys(topicsMap);
    setWeakTopics(weakList);
    
    const suggList = weakList.map(topic => `Review definitions and formula sheets regarding: ${topic}`);
    setSuggestions(suggList);

    // Save quiz history to backend
    try {
      const response = await fetch(`${API_BASE}/quiz-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: quizScore + (isSelfGrading ? 0 : 0), // handle final sync
          total: quizList.length,
          difficulty: quizDifficulty,
          quiz_type: quizType,
          weak_topics: weakList
        })
      });
      if (response.ok) {
        showToast('Assessment saved successfully!', 'success');
        fetchQuizHistory();
        fetchAnalytics();
      }
    } catch (err) {
      console.error('Failed to save quiz results:', err);
    }
  };

  // Helper custom renderer for Markdown content (renders headers, list items, bold elements beautifully)
  const renderMarkdown = (markdown) => {
    if (!markdown) return null;
    
    const lines = markdown.split('\n');
    const elements = [];
    let inList = false;
    let listItems = [];

    const flushList = (key) => {
      if (listItems.length > 0) {
        elements.push(<ul key={`list-${key}`} className="md-ul">{[...listItems]}</ul>);
        listItems = [];
        inList = false;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Check if list item
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        inList = true;
        const content = trimmed.substring(2);
        listItems.push(
          <li key={`li-${idx}`} dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(content) }} />
        );
        return;
      } else {
        flushList(idx);
      }

      // Check headers
      if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={`h1-${idx}`} className="md-h1">{trimmed.substring(2)}</h1>);
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={`h2-${idx}`} className="md-h2">{trimmed.substring(3)}</h2>);
      } else if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={`h3-${idx}`} className="md-h3">{trimmed.substring(4)}</h3>);
      } else if (trimmed === '') {
        elements.push(<div key={`spacer-${idx}`} className="md-spacer" />);
      } else {
        elements.push(
          <p key={`p-${idx}`} className="md-p" dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(trimmed) }} />
        );
      }
    });

    // Handle trailing lists
    flushList('final');

    return <div className="markdown-rendered">{elements}</div>;
  };

  const parseInlineMarkdown = (text) => {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
      
    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code `code`
    html = html.replace(/`(.*?)`/g, '<code class="md-inline-code">$1</code>');
    
    return html;
  };

  const currentQuiz = quizList[currentQuizIdx];
  const currentCard = flashcardList[currentCardIdx];

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={(email) => { setIsAuthenticated(true); setUserEmail(email); }} showToast={showToast} />
        } />
        <Route path="/signup" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <Signup onLogin={(email) => { setIsAuthenticated(true); setUserEmail(email); }} showToast={showToast} />
        } />
        <Route path="/dashboard" element={
          isAuthenticated ? (
            <div className="dashboard-wrapper">
              {/* Top Navbar */}
              <header className="dashboard-header">
                <div className="header-brand">
                  <span className="brand-icon">🧠</span>
                  <h1>Study<span className="accent-text">AI</span></h1>
                </div>
                
                <div className="header-meta">
                  <div className="status-badge-container">
                    {backendStatus === 'checking' && (
                      <span className="status-badge status-checking">Checking Backend...</span>
                    )}
                    {backendStatus === 'connected' && (
                      <span className={`status-badge status-connected ${groqConfigured ? 'groq-ok' : 'groq-missing'}`}>
                        {groqConfigured 
                          ? `LLaMA 3.3 Active (${firebaseConfigured ? 'Firestore' : 'Local JSON'})` 
                          : 'Backend Connected (No API Key)'}
                      </span>
                    )}
                    {backendStatus === 'disconnected' && (
                      <span className="status-badge status-disconnected">Offline (Port 5000)</span>
                    )}
                  </div>
                  <div className="profile-indicator">
                    <span className="profile-avatar">{userEmail ? userEmail[0].toUpperCase() : 'S'}</span>
                    <span className="profile-name">{userEmail ? userEmail.split('@')[0] : 'Student'}</span>
                  </div>
                  <button onClick={handleLogout} className="logout-btn" title="Sign Out">
                    🚪 Logout
                  </button>
                </div>
              </header>

      {/* Main Workspace Layout (Two-Column Layout) */}
      <div className="workspace-container">
        
        {/* Left Column: Upload System & Input Area */}
        <section className="input-workspace">
          <div className="glass-panel study-notes-panel">
            <div className="panel-header">
              <h2>Study Material</h2>
              <div className="input-mode-toggles">
                <button 
                  className={`mode-toggle-btn ${inputMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setInputMode('upload')}
                >
                  📁 File Upload
                </button>
                <button 
                  className={`mode-toggle-btn ${inputMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setInputMode('manual')}
                >
                  📝 Manual Text
                </button>
              </div>
            </div>
            
            {inputMode === 'upload' ? (
              /* FILE UPLOAD COMPONENT */
              <div className="file-upload-wrapper">
                <div 
                  className={`drag-drop-zone ${dragActive ? 'drag-active' : ''} ${uploadedMaterialId ? 'upload-success' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    {isUploading ? '⏳' : uploadedMaterialId ? '✅' : '📥'}
                  </div>
                  {isUploading ? (
                    <div className="upload-progress-container">
                      <p>Uploading and extracting text...</p>
                      <div className="upload-progress-bar">
                        <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                      <span className="progress-percentage">{uploadProgress}%</span>
                    </div>
                  ) : uploadedMaterialId ? (
                    <div className="upload-success-container">
                      <p className="upload-success-title">Successfully Uploaded!</p>
                      <p className="upload-filename">{materialFilename}</p>
                      <button className="reupload-btn" onClick={() => setUploadedMaterialId(null)}>
                        Upload another file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="drag-prompt">Drag & drop your study document here</p>
                      <p className="formats-prompt">Supports PDF, DOCX, TXT</p>
                      <label className="file-select-label">
                        Browse Files
                        <input 
                          type="file" 
                          accept=".pdf,.docx,.doc,.txt" 
                          onChange={handleFileSelect}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  )}
                  {uploadError && <p className="upload-error-msg">⚠️ {uploadError}</p>}
                </div>

                {/* Extracted Text Preview Toggle */}
                {uploadedMaterialId && previewText && (
                  <div className="preview-container">
                    <button 
                      className="preview-toggle-btn"
                      onClick={() => setShowPreview(prev => !prev)}
                    >
                      {showPreview ? '🙈 Hide Preview' : '👁️ Preview Extracted Content'}
                    </button>
                    {showPreview && (
                      <div className="preview-box">
                        <h5>Extracted Text Preview:</h5>
                        <p>{previewText}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* MANUAL TEXT AREA COMPONENT */
              <div className="manual-input-wrapper">
                <p className="panel-desc">Type or paste your lecture slides, notes, or chapter reviews below.</p>
                <textarea 
                  className="notes-textarea"
                  placeholder="Paste study material here (at least 2-3 sentences for best results)..."
                  value={studyText}
                  onChange={(e) => setStudyText(e.target.value)}
                  disabled={backendStatus !== 'connected'}
                />
                <button 
                  className="save-manual-btn"
                  onClick={handleSaveManualText}
                  disabled={isUploading || !studyText.trim() || backendStatus !== 'connected'}
                >
                  {isUploading ? 'Saving...' : '💾 Save Material ID'}
                </button>
                {uploadedMaterialId && (
                  <p className="manual-save-success">✅ Material registered! ID: {uploadedMaterialId.substring(0,8)}...</p>
                )}
              </div>
            )}

            {/* Quiz Parameters Configurator */}
            <div className="quiz-settings-panel">
              <span className="settings-title">⚙️ Quiz Parameters</span>
              <div className="settings-row">
                <div className="setting-control">
                  <label htmlFor="quiz-type-select">Format</label>
                  <select id="quiz-type-select" value={quizType} onChange={(e) => setQuizType(e.target.value)}>
                    <option value="mcq">MCQ</option>
                    <option value="tf">True/False</option>
                    <option value="short">Short Answer</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div className="setting-control">
                  <label htmlFor="quiz-diff-select">Difficulty</label>
                  <select id="quiz-diff-select" value={quizDifficulty} onChange={(e) => setQuizDifficulty(e.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="setting-control">
                  <label htmlFor="quiz-num-select">Questions</label>
                  <select id="quiz-num-select" value={quizNumQuestions} onChange={(e) => setQuizNumQuestions(parseInt(e.target.value))}>
                    <option value="3">3 Qs</option>
                    <option value="5">5 Qs</option>
                    <option value="10">10 Qs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Core Action triggers */}
            <div className="generator-actions">
              <button 
                className="gen-btn quiz-gen-btn"
                onClick={handleGenerateQuiz}
                disabled={isGeneratingQuiz || (!studyText.trim() && !uploadedMaterialId) || backendStatus !== 'connected'}
              >
                {isGeneratingQuiz ? 'Generating Quiz...' : '📝 Generate Custom Quiz'}
              </button>
              <button 
                className="gen-btn card-gen-btn"
                onClick={handleGenerateFlashcards}
                disabled={isGeneratingCards || (!studyText.trim() && !uploadedMaterialId) || backendStatus !== 'connected'}
              >
                {isGeneratingCards ? 'Generating Cards...' : '🃏 Generate Flashcards'}
              </button>
            </div>
            
            <div className="action-row-split">
              <button 
                className="summary-gen-btn"
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary || (!studyText.trim() && !uploadedMaterialId) || backendStatus !== 'connected'}
              >
                {isGeneratingSummary ? 'Generating AI Summary...' : '✨ Generate AI Summary'}
              </button>
              <button 
                className="planner-gen-btn"
                onClick={handleGeneratePlanner}
                disabled={isGeneratingPlanner || (!studyText.trim() && !uploadedMaterialId) || backendStatus !== 'connected'}
              >
                {isGeneratingPlanner ? 'Generating 7-Day Plan...' : '📅 Generate 7-Day Plan'}
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Interactive Study Aids Workspace */}
        <section className="output-workspace">
          {/* Navigation Tabs */}
          <div className="tab-navigation">
            <button 
              className={`tab-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Core Dashboard
            </button>
            <button 
              className={`tab-link ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              ✨ Summary {summaryContent && '✅'}
            </button>
            <button 
              className={`tab-link ${activeTab === 'quiz' ? 'active' : ''}`}
              onClick={() => setActiveTab('quiz')}
            >
              📝 Quiz {quizList.length > 0 && `(${quizList.length})`}
            </button>
            <button 
              className={`tab-link ${activeTab === 'flashcards' ? 'active' : ''}`}
              onClick={() => setActiveTab('flashcards')}
            >
              🃏 Flashcards {flashcardList.length > 0 && `(${flashcardList.length})`}
            </button>
            <button 
              className={`tab-link ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              📈 Analytics
            </button>
          </div>

          {/* TAB CONTENT: Core Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-grid tab-panel-body">
              {/* Row 1: Metrics */}
              <section className="grid-summary">
                <div className="metric-card shadow-purple">
                  <div className="metric-icon">📅</div>
                  <div className="metric-content">
                    <h3>Task Completion</h3>
                    <p className="metric-value">{completedTasks} / {totalTasks}</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill fill-purple" style={{ width: `${completionRate}%` }}></div>
                    </div>
                    <span className="metric-percentage">{completionRate}% Completed</span>
                  </div>
                </div>

                <div className="metric-card shadow-cyan">
                  <div className="metric-icon">🔥</div>
                  <div className="metric-content">
                    <h3>Streak</h3>
                    <p className="metric-value">5 Days</p>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill fill-cyan" style={{ width: '100%' }}></div>
                    </div>
                    <span className="metric-percentage">Consistent study habits</span>
                  </div>
                </div>
              </section>

              {/* Row 2: Daily Tip */}
              <section className="insight-section">
                <div className="insight-card">
                  <div className="insight-title-group">
                    <span className="insight-sparkle">✨</span>
                    <h4>AI Insight:</h4>
                  </div>
                  <div className="insight-text">
                    {isTipLoading ? (
                      <span className="loading-dots">Loading...</span>
                    ) : (
                      <p>{dailyTip || "Fill in your .env API key to unlock custom AI advice!"}</p>
                    )}
                  </div>
                  <button className="insight-refresh-btn" onClick={fetchDailyTip} disabled={isTipLoading}>🔄</button>
                </div>
              </section>

              {/* Row 3: Study Planner & Chat */}
              <div className="content-layout">
                {/* 7-Day Study Planner */}
                <div className="glass-panel planner-subpanel full-planner-card">
                  <div className="panel-header">
                    <h2>7-Day Study Planner</h2>
                    {plannerDays.length > 0 && (
                      <button className="export-plan-btn" onClick={exportStudyPlan}>
                        📤 Export Plan
                      </button>
                    )}
                  </div>

                  {plannerDays.length === 0 ? (
                    <div className="planner-empty-state">
                      <span>📅</span>
                      <h3>No 7-Day Plan Active</h3>
                      <p>Upload files or paste notes on the left, then click <strong>"Generate 7-Day Plan"</strong> to build a personalized study schedule.</p>
                    </div>
                  ) : (
                    <div className="planner-active-layout">
                      {/* Day Tab Selectors */}
                      <div className="planner-day-selector">
                        {plannerDays.map((day, idx) => (
                          <button
                            key={idx}
                            className={`day-tab-btn ${activePlannerDay === idx ? 'active' : ''}`}
                            onClick={() => setActivePlannerDay(idx)}
                          >
                            D{idx + 1}
                          </button>
                        ))}
                      </div>

                      {/* Active Day Details */}
                      <div className="planner-day-content">
                        {/* Daily AI Tip */}
                        {plannerDays[activePlannerDay].ai_tips && (
                          <div className="planner-day-tip">
                            <span>💡 AI Tip:</span>
                            <p>{plannerDays[activePlannerDay].ai_tips.join(" ")}</p>
                          </div>
                        )}

                        {/* Day's Tasks */}
                        <div className="planner-day-tasks-list">
                          {plannerDays[activePlannerDay].tasks.map((task) => (
                            <div key={task.id} className={`planner-task-item ${task.completed ? 'completed' : ''}`}>
                              <div className="task-left-section">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => handleTogglePlannerTask(activePlannerDay, task.id)}
                                />
                                <span className="task-desc">{task.task}</span>
                              </div>
                              
                              <div className="task-meta-tags">
                                <span className={`priority-tag ${task.priority.toLowerCase()}`}>
                                  {task.priority}
                                </span>
                                <span className="duration-tag">
                                  ⏱️ {task.duration}m + {task.break_duration}m
                                </span>
                                <span className="type-tag">
                                  {task.type}
                                </span>
                                <button 
                                  className="task-delete-btn"
                                  onClick={() => handleDeletePlannerTask(activePlannerDay, task.id)}
                                  title="Delete task"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}

                          {plannerDays[activePlannerDay].tasks.length === 0 && (
                            <div className="empty-day-state">No study tasks scheduled for today.</div>
                          )}
                        </div>

                        {/* Add Task Form for Active Day */}
                        <form 
                          className="planner-add-task-form"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.target;
                            const text = form.taskText.value;
                            const duration = form.taskDuration.value;
                            const priority = form.taskPriority.value;
                            const type = form.taskType.value;
                            handleAddPlannerTask(activePlannerDay, text, duration, priority, type);
                            form.reset();
                          }}
                        >
                          <input name="taskText" type="text" placeholder="Add study task..." required />
                          <div className="form-controls-row">
                            <input name="taskDuration" type="number" placeholder="Min" defaultValue={45} style={{ width: '60px' }} />
                            <select name="taskPriority" defaultValue="Medium">
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                            <select name="taskType" defaultValue="Study">
                              <option value="Study">Study</option>
                              <option value="Revision">Revision</option>
                              <option value="Weak Topic Revision">Weak Rev</option>
                            </select>
                            <button type="submit">+</button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>

                {/* Study Coach Chat */}
                <div className="glass-panel chat-subpanel">
                  <div className="panel-header">
                    <h2>Study Coach</h2>
                    <span className="panel-sub">Context Active</span>
                  </div>
                  
                  <div className="chat-history">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`chat-bubble-wrapper ${msg.role}`}>
                        <div className="chat-avatar">{msg.role === 'assistant' ? '🤖' : '👨‍🎓'}</div>
                        <div className="chat-bubble"><p>{msg.content}</p></div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="chat-bubble-wrapper assistant">
                        <div className="chat-avatar">🤖</div>
                        <div className="chat-bubble loading-bubble">
                          <span className="dot"></span>
                          <span className="dot"></span>
                          <span className="dot"></span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggested questions list */}
                  {suggestedQuestions.length > 0 && !isChatLoading && (
                    <div className="suggested-questions-row">
                      {suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          className="suggested-q-btn"
                          onClick={() => {
                            sendSuggestedQuestion(q);
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="chat-input-form">
                    <input 
                      type="text" 
                      placeholder="Ask the coach..." 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      disabled={isChatLoading || backendStatus !== 'connected'}
                    />
                    <button type="submit" disabled={isChatLoading || !chatInput.trim() || backendStatus !== 'connected'}>Send</button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: AI Summary Tab */}
          {activeTab === 'summary' && (
            <div className="glass-panel study-aid-panel summary-panel tab-panel-body">
              <div className="panel-header">
                <h2>AI Study Summary</h2>
                <div className="summary-utility-buttons">
                  <button className="summary-util-btn" onClick={handleCopySummary} disabled={!summaryContent}>
                    📋 Copy
                  </button>
                  <button className="summary-util-btn" onClick={downloadSummaryPDF} disabled={!summaryContent}>
                    🖨️ PDF
                  </button>
                </div>
              </div>

              {isGeneratingSummary && (
                <div className="study-aid-loading">
                  <div className="loading-spinner"></div>
                  <p>LLaMA 3.3 is reading the study material and generating a comprehensive structured summary (overview, key concepts, definitions, formula sheet, and revision notes)...</p>
                </div>
              )}

              {summaryError && (
                <div className="study-aid-error">
                  <span className="error-icon">⚠️</span>
                  <p>{summaryError}</p>
                </div>
              )}

              {!isGeneratingSummary && !summaryError && !summaryContent && (
                <div className="study-aid-empty">
                  <span>✨</span>
                  <h3>No Summary Active</h3>
                  <p>Upload a file or input text on the left, then click <strong>"Generate AI Summary"</strong> to produce detailed notes.</p>
                </div>
              )}

              {!isGeneratingSummary && summaryContent && (
                <div className="summary-scroll-content">
                  {renderMarkdown(summaryContent)}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: Quiz Mode */}
          {activeTab === 'quiz' && (
            <div className="glass-panel study-aid-panel tab-panel-body">
              <div className="panel-header">
                <h2>Generated Study Quiz</h2>
                {quizList.length > 0 && timerActive && (
                  <span className="quiz-timer-countdown">
                    ⏱️ Time: {Math.floor(quizTimer / 60)}:{(quizTimer % 60).toString().padStart(2, '0')}
                  </span>
                )}
                {quizList.length > 0 && (
                  <span className="score-counter">Score: {quizScore} / {quizList.length}</span>
                )}
              </div>

              {/* State: Generating Quiz */}
              {isGeneratingQuiz && (
                <div className="study-aid-loading">
                  <div className="loading-spinner"></div>
                  <p>LLaMA 3.3 is compiling a custom {quizDifficulty} quiz ({quizNumQuestions} questions, {quizType})...</p>
                </div>
              )}

              {/* State: Error */}
              {quizError && (
                <div className="study-aid-error">
                  <span className="error-icon">⚠️</span>
                  <p>{quizError}</p>
                </div>
              )}

              {/* State: Empty */}
              {!isGeneratingQuiz && !quizError && quizList.length === 0 && (
                <div className="study-aid-empty">
                  <span>📝</span>
                  <h3>No Quiz Active</h3>
                  <p>Paste notes or upload a document on the left, select options, and click <strong>"Generate Custom Quiz"</strong> to begin.</p>
                </div>
              )}

              {/* State: Active Quiz questions */}
              {!isGeneratingQuiz && quizList.length > 0 && (
                <div className="quiz-container">
                  {currentQuizIdx < quizList.length ? (
                    <div className="quiz-question-card">
                      <div className="quiz-progress-header">
                        <span>Question {currentQuizIdx + 1} of {quizList.length} | Topic: {currentQuiz.topic || 'General'}</span>
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill fill-purple" 
                            style={{ width: `${((currentQuizIdx) / quizList.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      <h3 className="quiz-question-text">{currentQuiz.question}</h3>

                      {/* Render based on Question Type */}
                      {currentQuiz.type === 'short' ? (
                        <div className="quiz-short-answer-wrapper">
                          <form onSubmit={handleShortAnswerSubmit}>
                            <textarea
                              className="quiz-short-input"
                              placeholder="Type your explanation / answer here..."
                              value={shortAnswerInput}
                              onChange={(e) => setShortAnswerInput(e.target.value)}
                              disabled={answeredState}
                              required
                            />
                            {!answeredState && (
                              <button type="submit" className="quiz-submit-short-btn">
                                Submit Answer
                              </button>
                            )}
                          </form>

                          {answeredState && (
                            <div className="short-grading-feedback">
                              <p className="model-answer">
                                <strong>Model Answer / Key Points:</strong> {currentQuiz.answer}
                              </p>
                              <p className="feedback-explanation">
                                <strong>Explanation:</strong> {currentQuiz.explanation}
                              </p>

                              {isSelfGrading && (
                                <div className="self-grading-control">
                                  <span>Did you get it right? Self-grade your answer:</span>
                                  <div className="self-grade-buttons">
                                    <button className="grade-btn yes-btn" onClick={() => handleSelfGrade(true)}>
                                      Yes, correct! ✅
                                    </button>
                                    <button className="grade-btn no-btn" onClick={() => handleSelfGrade(false)}>
                                      No, incorrect ❌
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              {!isSelfGrading && (
                                <button className="quiz-next-btn" onClick={handleNextQuiz}>
                                  {currentQuizIdx + 1 === quizList.length ? 'Finish Quiz' : 'Next Question ➡️'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        // MCQ or True/False
                        <div className="quiz-options-grid">
                          {currentQuiz.options && currentQuiz.options.map((option, idx) => {
                            let optionClass = '';
                            if (answeredState) {
                              if (option === currentQuiz.answer) {
                                optionClass = 'correct-opt';
                              } else if (selectedOption === option) {
                                optionClass = 'incorrect-opt';
                              } else {
                                optionClass = 'muted-opt';
                              }
                            }

                            return (
                              <button
                                key={idx}
                                className={`quiz-option-btn ${optionClass}`}
                                onClick={() => handleOptionSelect(option)}
                                disabled={answeredState}
                              >
                                <span className="option-letter">{String.fromCharCode(65 + idx)}.</span>
                                <span className="option-text">{option}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* MCQ / TF Answer Feedback Panel */}
                      {answeredState && currentQuiz.type !== 'short' && (
                        <div className={`quiz-feedback-box ${selectedOption === currentQuiz.answer ? 'fb-correct' : 'fb-incorrect'}`}>
                          <div className="feedback-status-header">
                            {selectedOption === currentQuiz.answer ? '✅ Correct Answer!' : '❌ Incorrect'}
                          </div>
                          <p className="feedback-explanation">
                            <strong>Explanation:</strong> {currentQuiz.explanation}
                          </p>
                          <button className="quiz-next-btn" onClick={handleNextQuiz}>
                            {currentQuizIdx + 1 === quizList.length ? 'Finish Quiz' : 'Next Question ➡️'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Quiz Complete screen
                    <div className="quiz-results-card">
                      <div className="results-badge">🏆</div>
                      <h2>Quiz Completed!</h2>
                      <p className="results-score-desc">
                        You scored <strong>{quizScore}</strong> out of <strong>{quizList.length}</strong> questions correctly ({Math.round((quizScore / quizList.length) * 100)}%).
                      </p>
                      
                      {weakTopics.length > 0 && (
                        <div className="weak-topics-detection">
                          <h5>⚠️ Weak Sub-topics Detected:</h5>
                          <div className="weak-topic-tags">
                            {weakTopics.map((topic, i) => (
                              <span key={i} className="weak-tag">{topic}</span>
                            ))}
                          </div>
                          <div className="suggestions-box">
                            <p><strong>Improvement Suggestions:</strong></p>
                            <ul>
                              {suggestions.map((s, idx) => (
                                <li key={idx}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      <div className="results-grade-message">
                        {quizScore === quizList.length ? "Perfect Score! Excellent retention of the material. 🌟" : 
                         quizScore >= quizList.length * 0.7 ? "Great job! You have a solid grasp of this material. 👍" : 
                         "Keep studying! Try reviewing the material and generating a new quiz. 📚"}
                      </div>

                      <div className="quiz-action-buttons">
                        <button className="restart-quiz-btn" onClick={() => {
                          setCurrentQuizIdx(0);
                          setSelectedOption(null);
                          setAnsweredState(false);
                          setQuizScore(0);
                          setUserAnswers([]);
                          setShortAnswerInput('');
                          setIsSelfGrading(false);
                          setTimerActive(true);
                          setQuizTimer(quizTimeLimit);
                        }}>
                          Retry Quiz
                        </button>
                        <button className="quiz-export-btn" onClick={downloadQuizReportPDF}>
                          🖨️ Download Report PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: Flashcards Mode */}
          {activeTab === 'flashcards' && (
            <div className="glass-panel study-aid-panel tab-panel-body">
              <div className="panel-header">
                <h2>Concepts Flashcards</h2>
                <div className="flashcards-utility-controls">
                  <button className="flash-util-btn" onClick={handleShuffleCards} disabled={flashcardList.length === 0}>
                    🔀 Shuffle
                  </button>
                  <button className="flash-util-btn" onClick={exportFlashcards} disabled={flashcardList.length === 0}>
                    📤 Export
                  </button>
                  {flashcardList.length > 0 && (
                    <span className="card-counter">
                      Learned: {learnedCardIds.size} / {flashcardList.length}
                    </span>
                  )}
                </div>
              </div>

              {/* State: Generating cards */}
              {isGeneratingCards && (
                <div className="study-aid-loading">
                  <div className="loading-spinner"></div>
                  <p>LLaMA 3.3 is extracting key terms and drafting double-sided flashcards for active recall...</p>
                </div>
              )}

              {/* State: Error */}
              {cardsError && (
                <div className="study-aid-error">
                  <span className="error-icon">⚠️</span>
                  <p>{cardsError}</p>
                </div>
              )}

              {/* State: Empty */}
              {!isGeneratingCards && !cardsError && flashcardList.length === 0 && (
                <div className="study-aid-empty">
                  <span>🃏</span>
                  <h3>No Flashcards Loaded</h3>
                  <p>Paste text or upload a document on the left, then click <strong>"Generate Flashcards"</strong> to build active-recall decks.</p>
                </div>
              )}

              {/* State: Active Deck */}
              {!isGeneratingCards && flashcardList.length > 0 && (
                <div className="flashcards-wrapper-layout">
                  {/* Search Bar */}
                  <div className="flashcard-search-box">
                    <input
                      type="text"
                      placeholder="🔍 Search cards by keywords..."
                      value={flashcardSearch}
                      onChange={(e) => setFlashcardSearch(e.target.value)}
                    />
                  </div>

                  {filteredFlashcards.length === 0 ? (
                    <div className="no-cards-found">No flashcards match your search filter.</div>
                  ) : (
                    <>
                      {/* The Flip Card */}
                      <div className="card-perspective" onClick={() => setIsCardFlipped(prev => !prev)}>
                        <div className={`recall-card ${isCardFlipped ? 'flipped' : ''}`}>
                          
                          {/* Front of Card */}
                          <div className="card-face face-front">
                            <div className="face-tag-row">
                              <span className="face-tag">🔑 Concept</span>
                              <span className={`diff-tag ${filteredFlashcards[currentCardIdx].difficulty?.toLowerCase() || 'medium'}`}>
                                {filteredFlashcards[currentCardIdx].difficulty || 'Medium'}
                              </span>
                            </div>
                            <span className="card-topic-label">🏷️ {filteredFlashcards[currentCardIdx].topic || 'General'}</span>
                            <p className="card-concept-text">{filteredFlashcards[currentCardIdx].front}</p>
                            <div className="flip-prompt">Click Card to Flip 🔄</div>
                          </div>

                          {/* Back of Card */}
                          <div className="card-face face-back">
                            <div className="face-tag-row">
                              <span className="face-tag">💡 Explanation</span>
                              <span className={`diff-tag ${filteredFlashcards[currentCardIdx].difficulty?.toLowerCase() || 'medium'}`}>
                                {filteredFlashcards[currentCardIdx].difficulty || 'Medium'}
                              </span>
                            </div>
                            <span className="card-topic-label">🏷️ {filteredFlashcards[currentCardIdx].topic || 'General'}</span>
                            <p className="card-def-text">{filteredFlashcards[currentCardIdx].back}</p>
                            <div className="flip-prompt">Click Card to Flip 🔄</div>
                          </div>

                        </div>
                      </div>

                      {/* Card Actions (Mark learned & nav) */}
                      <div className="card-controls-panel">
                        <button
                          className={`learned-toggle-btn ${learnedCardIds.has(filteredFlashcards[currentCardIdx].id) ? 'marked-learned' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCardLearned(filteredFlashcards[currentCardIdx].id);
                          }}
                        >
                          {learnedCardIds.has(filteredFlashcards[currentCardIdx].id) ? '✅ Learned' : '🎓 Mark Learned'}
                        </button>
                      </div>

                      {/* Deck controls */}
                      <div className="deck-navigation">
                        <button 
                          className="nav-arrow-btn" 
                          onClick={() => {
                            setIsCardFlipped(false);
                            setCurrentCardIdx(prev => Math.max(0, prev - 1));
                          }}
                          disabled={currentCardIdx === 0}
                        >
                          ⬅️ Previous
                        </button>
                        
                        <span className="deck-indicator">
                          {currentCardIdx + 1} / {filteredFlashcards.length}
                        </span>

                        <button 
                          className="nav-arrow-btn" 
                          onClick={() => {
                            setIsCardFlipped(false);
                            setCurrentCardIdx(prev => Math.min(filteredFlashcards.length - 1, prev + 1));
                          }}
                          disabled={currentCardIdx === filteredFlashcards.length - 1}
                        >
                          Next ➡️
                        </button>
                      </div>
                    </>
                  )}
                  
                  <div className="recall-tip">
                    <strong>Recall Practice:</strong> Read the card front and try to explain it aloud before flipping to verify your understanding.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: Analytics Dashboard */}
          {activeTab === 'analytics' && (
            <div className="glass-panel study-aid-panel tab-panel-body analytics-panel-layout">
              <div className="panel-header">
                <h2>Study Analytics & Insights</h2>
                <span className="panel-sub">Refreshes dynamically</span>
              </div>

              {isAnalyticsLoading ? (
                <div className="study-aid-loading">
                  <div className="loading-spinner"></div>
                  <p>Analyzing study records and compiling learning statistics...</p>
                </div>
              ) : (
                <div className="analytics-scroll-container">
                  {/* Stats Grid */}
                  <div className="analytics-metrics-grid">
                    <div className="stat-card p-glow">
                      <span className="stat-icon">🔥</span>
                      <div className="stat-content">
                        <h4>Study Streak</h4>
                        <p>{analyticsData.streak || 5} Days</p>
                      </div>
                    </div>
                    
                    <div className="stat-card c-glow">
                      <span className="stat-icon">📈</span>
                      <div className="stat-content">
                        <h4>Average Score</h4>
                        <p>{analyticsData.avg_score || 0}%</p>
                      </div>
                    </div>

                    <div className="stat-card p-glow">
                      <span className="stat-icon">🎓</span>
                      <div className="stat-content">
                        <h4>Cards Learned</h4>
                        <p>{learnedCardIds.size} Cards</p>
                      </div>
                    </div>

                    <div className="stat-card c-glow">
                      <span className="stat-icon">⏱️</span>
                      <div className="stat-content">
                        <h4>Total Hours</h4>
                        <p>{analyticsData.total_study_time || 21.5}h</p>
                      </div>
                    </div>
                  </div>

                  {/* Chart Row */}
                  <div className="charts-row-layout">
                    {/* Weekly study hours */}
                    <div className="chart-wrapper-card">
                      <h3>Weekly Study Hours</h3>
                      <div className="chart-container-inner">
                        <Bar 
                          data={{
                            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                            datasets: [{
                              label: 'Study Hours',
                              data: analyticsData.weekly_hours || [2.0, 3.5, 1.5, 4.0, 3.0, 5.0, 2.5],
                              backgroundColor: 'rgba(6, 182, 212, 0.65)',
                              borderColor: 'var(--color-secondary)',
                              borderWidth: 1,
                              borderRadius: 4
                            }]
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                              x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Quiz trend */}
                    <div className="chart-wrapper-card">
                      <h3>Quiz Scores Trend</h3>
                      <div className="chart-container-inner">
                        {analyticsData.quiz_trend && analyticsData.quiz_trend.length > 0 ? (
                          <Line 
                            data={{
                              labels: analyticsData.quiz_trend.map((_, i) => `Quiz ${i+1}`),
                              datasets: [{
                                label: 'Score %',
                                data: analyticsData.quiz_trend,
                                borderColor: 'var(--color-primary-light)',
                                backgroundColor: 'rgba(147, 51, 234, 0.15)',
                                fill: true,
                                tension: 0.35,
                                pointBackgroundColor: 'var(--color-primary)'
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { legend: { display: false } },
                              scales: {
                                y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                              }
                            }}
                          />
                        ) : (
                          <div className="chart-empty-placeholder">Take quizzes to view score trends.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Weak topics and AI coach insights */}
                  <div className="analytics-details-layout">
                    <div className="weak-topics-panel-card">
                      <h3>Weak Topics Detected</h3>
                      {analyticsData.weak_topics && analyticsData.weak_topics.length > 0 ? (
                        <div className="weak-topics-list-group">
                          {analyticsData.weak_topics.map((topic, i) => (
                            <div key={i} className="weak-topic-row-item">
                              <span className="topic-bullet">⚠️</span>
                              <span className="topic-text-val">{topic}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="analytics-empty-state">No weak topics detected. Complete quizzes to begin diagnosis!</div>
                      )}
                    </div>

                    <div className="ai-insights-panel-card">
                      <h3>🤖 AI Study Coach Insights</h3>
                      {isGeneratingInsights ? (
                        <div className="skeleton-insights">
                          <div className="pulse-bar"></div>
                          <div className="pulse-bar"></div>
                          <div className="pulse-bar"></div>
                        </div>
                      ) : aiInsights ? (
                        <div className="insights-content">
                          {aiInsights.split('\n').map((line, idx) => (
                            <p key={idx}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <div className="analytics-empty-state">Complete your study planner tasks and quiz assessments to activate AI insights.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </section>

      </div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>

      {/* Floating Toast Notifications Overlay */}
      <div className="toast-container-overlay">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card-alert toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <p className="toast-msg">{t.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}
