import React, { useState, useEffect, useRef } from 'react';
import './Dashboard.css';

const API_BASE = 'http://localhost:5000/api';

export default function Dashboard() {
  // Backend Connection State
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking' | 'connected' | 'disconnected'
  const [groqConfigured, setGroqConfigured] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your LLaMA 3.3 Study Coach. Ask me any academic questions, request explanations, or seek study advice!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Task Planner State
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review LLaMA 3.3 architecture notes', completed: false },
    { id: 2, text: 'Design Flask-React integration interface', completed: true },
    { id: 3, text: 'Draft StudyAI project documentation', completed: false },
  ]);
  const [newTaskInput, setNewTaskInput] = useState('');
  
  // AI Schedule Generator State
  const [aiSchedule, setAiSchedule] = useState('');
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  // AI Daily Tip State
  const [dailyTip, setDailyTip] = useState('');
  const [isTipLoading, setIsTipLoading] = useState(false);

  const chatEndRef = useRef(null);

  // Scroll chat window to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Check Backend Connection & Fetch Daily Tip on Mount
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
      } else {
        setBackendStatus('disconnected');
      }
    } catch (err) {
      console.error('Failed to connect to backend:', err);
      setBackendStatus('disconnected');
    }
  };

  const fetchDailyTip = async () => {
    setIsTipLoading(true);
    try {
      const prompt = "Give a single, punchy, actionable study tip for students. Keep it to one short sentence (max 15 words) and end with an emoji.";
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        setDailyTip(data.response);
      } else {
        setDailyTip("Focus on learning concepts, not just memorizing facts. 💡");
      }
    } catch (err) {
      setDailyTip("Stay organized, take breaks, and test your knowledge frequently. 📚");
    } finally {
      setIsTipLoading(false);
    }
  };

  // Chat message submission
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

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
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        const errorData = await response.json();
        setChatMessages(prev => [
          ...prev, 
          { role: 'assistant', content: `Error: ${errorData.error || 'Failed to get response.'}` }
        ]);
      }
    } catch (err) {
      setChatMessages(prev => [
        ...prev, 
        { role: 'assistant', content: 'Connection Error: Make sure the Flask backend is running.' }
      ]);
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
  };

  const toggleTask = (id) => {
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // AI Schedule Generator (Uses LLaMA 3.3 to structure task completions)
  const generateAiSchedule = async () => {
    const incompleteTasks = tasks.filter(t => !t.completed).map(t => t.text);
    if (incompleteTasks.length === 0) {
      setAiSchedule("All tasks are done! Add some tasks to generate a plan.");
      return;
    }

    setIsScheduleLoading(true);
    setAiSchedule('');

    try {
      const prompt = `Create a short, step-by-step study schedule for the following tasks: ${incompleteTasks.join(', ')}. Keep it extremely brief (max 3 simple bullet points), practical, and realistic.`;
      
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (res.ok) {
        const data = await res.json();
        setAiSchedule(data.response);
      } else {
        setAiSchedule("Could not generate plan. Please verify the Flask backend is configured with a Groq API key.");
      }
    } catch (err) {
      setAiSchedule("Error connecting to backend. Is the server running?");
    } finally {
      setIsScheduleLoading(false);
    }
  };

  // Math metrics calculations
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
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
                {groqConfigured ? 'LLaMA 3.3 Active' : 'Backend Connected (No API Key)'}
              </span>
            )}
            {backendStatus === 'disconnected' && (
              <span className="status-badge status-disconnected">Offline (Port 5000)</span>
            )}
          </div>
          <div className="profile-indicator">
            <span className="profile-avatar">S</span>
            <span className="profile-name">Student</span>
          </div>
        </div>
      </header>

      {/* Main Dashboard Layout Grid */}
      <main className="dashboard-grid">
        
        {/* Top-Row Summary Cards */}
        <section className="grid-summary">
          <div className="metric-card shadow-purple">
            <div className="metric-icon">📅</div>
            <div className="metric-content">
              <h3>Task Completion</h3>
              <p className="metric-value">{completedTasks} / {totalTasks}</p>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill fill-purple" 
                  style={{ width: `${completionRate}%` }}
                ></div>
              </div>
              <span className="metric-percentage">{completionRate}% Completed</span>
            </div>
          </div>

          <div className="metric-card shadow-cyan">
            <div className="metric-icon">⏱️</div>
            <div className="metric-content">
              <h3>Study Duration</h3>
              <p className="metric-value">4.5h <span className="metric-unit">today</span></p>
              <div className="progress-bar-container">
                <div className="progress-bar-fill fill-cyan" style={{ width: '75%' }}></div>
              </div>
              <span className="metric-percentage">75% of Daily Goal (6h)</span>
            </div>
          </div>

          <div className="metric-card shadow-purple">
            <div className="metric-icon">🔥</div>
            <div className="metric-content">
              <h3>Learning Streak</h3>
              <p className="metric-value">5 <span className="metric-unit">days</span></p>
              <div className="progress-bar-container">
                <div className="progress-bar-fill fill-purple" style={{ width: '100%' }}></div>
              </div>
              <span className="metric-percentage">Consistent study habits</span>
            </div>
          </div>
        </section>

        {/* Daily Tip Bar */}
        <section className="insight-section">
          <div className="insight-card">
            <div className="insight-title-group">
              <span className="insight-sparkle">✨</span>
              <h4>AI Micro-Insight:</h4>
            </div>
            <div className="insight-text">
              {isTipLoading ? (
                <span className="loading-dots">Fetching tip from LLaMA 3.3...</span>
              ) : (
                <p>{dailyTip || "Loading daily recommendation..."}</p>
              )}
            </div>
            <button className="insight-refresh-btn" onClick={fetchDailyTip} disabled={isTipLoading} title="Get new insight">
              🔄
            </button>
          </div>
        </section>

        {/* Two Column Section: Left = Tasks, Right = AI Tutor */}
        <div className="content-layout">
          
          {/* Left Column: Tasks Manager */}
          <section className="planner-column">
            <div className="glass-panel">
              <div className="panel-header">
                <h2>Study Planner</h2>
                <button 
                  className="ai-action-btn"
                  onClick={generateAiSchedule}
                  disabled={isScheduleLoading || backendStatus !== 'connected'}
                  title="Generate prioritizing strategy based on tasks"
                >
                  ⚡ AI Priority Plan
                </button>
              </div>

              {/* Task List */}
              <div className="task-list">
                {tasks.map(task => (
                  <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                    <label className="checkbox-container">
                      <input 
                        type="checkbox" 
                        checked={task.completed} 
                        onChange={() => toggleTask(task.id)}
                      />
                      <span className="checkmark"></span>
                      <span className="task-text">{task.text}</span>
                    </label>
                    <button className="delete-task-btn" onClick={() => deleteTask(task.id)}>
                      ✕
                    </button>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <div className="empty-state">No tasks scheduled. Add tasks to start planning!</div>
                )}
              </div>

              {/* Add Task Form */}
              <form onSubmit={handleAddTask} className="add-task-form">
                <input 
                  type="text" 
                  placeholder="Add a new study objective..."
                  value={newTaskInput}
                  onChange={(e) => setNewTaskInput(e.target.value)}
                  maxLength={100}
                />
                <button type="submit">+</button>
              </form>

              {/* AI Plan Output */}
              {(aiSchedule || isScheduleLoading) && (
                <div className="ai-plan-output">
                  <div className="ai-plan-header">
                    <span>🤖</span>
                    <h5>LLaMA 3.3 Priority Strategy</h5>
                  </div>
                  <div className="ai-plan-body">
                    {isScheduleLoading ? (
                      <div className="loader-placeholder">
                        <div className="pulsing-line"></div>
                        <div className="pulsing-line"></div>
                        <div className="pulsing-line"></div>
                      </div>
                    ) : (
                      <div className="ai-schedule-content">
                        {aiSchedule.split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: AI Chat Coach */}
          <section className="chat-column">
            <div className="glass-panel chat-panel">
              <div className="panel-header">
                <h2>AI Study Coach</h2>
                <span className="panel-sub">Powered by Groq LLaMA 3.3</span>
              </div>

              {/* Message Display Area */}
              <div className="chat-history">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-bubble-wrapper ${msg.role}`}>
                    <div className="chat-avatar">
                      {msg.role === 'assistant' ? '🤖' : '👨‍🎓'}
                    </div>
                    <div className="chat-bubble">
                      <p>{msg.content}</p>
                    </div>
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

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input 
                  type="text" 
                  placeholder={backendStatus === 'connected' ? "Ask the AI Coach a question..." : "Waiting for backend connection..."}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isChatLoading || backendStatus !== 'connected'}
                />
                <button type="submit" disabled={isChatLoading || !chatInput.trim() || backendStatus !== 'connected'}>
                  Send
                </button>
              </form>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
