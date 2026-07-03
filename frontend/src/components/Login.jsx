import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Login({ onLogin, showToast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateEmail = (emailVal) => {
    const trimmed = (emailVal || '').trim();
    if (!trimmed) return 'Email is required';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!emailRegex.test(trimmed)) {
      return 'Only Gmail (@gmail.com) addresses are allowed';
    }
    return '';
  };

  const validatePassword = (passVal) => {
    if (!passVal) return 'Password is required';
    if (passVal.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (!/[A-Z]/.test(passVal)) {
      return 'Password must contain at least 1 uppercase letter';
    }
    if (!/[0-9]/.test(passVal)) {
      return 'Password must contain at least 1 number';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(passVal)) {
      return 'Password must contain at least 1 special character';
    }
    return '';
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setEmailError(validateEmail(val));
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(validatePassword(val));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const eErr = validateEmail(trimmedEmail);
    const pErr = validatePassword(password);
    
    if (eErr || pErr) {
      setEmailError(eErr);
      setPasswordError(pErr);
      showToast('Please fix validation errors before logging in.', 'warning');
      return;
    }
    
    setIsLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setIsLoading(false);
      localStorage.setItem('studyai_auth', 'true');
      localStorage.setItem('studyai_user', trimmedEmail);
      onLogin(trimmedEmail);
      showToast('Successfully logged in! Welcome back.', 'success');
      navigate('/dashboard');
    }, 800);
  };

  const isEmailValid = email.trim() !== '' && !validateEmail(email);
  const isPasswordValid = password.trim() !== '' && !validatePassword(password);
  const isFormValid = isEmailValid && isPasswordValid;

  return (
    <div className="auth-wrapper">
      <div className="auth-background-effects">
        <div className="glow-bubble glow-purple"></div>
        <div className="glow-bubble glow-cyan"></div>
      </div>
      <div className="auth-card-glass">
        <div className="auth-header">
          <div className="auth-brand">
            <span className="auth-brand-icon">🧠</span>
            <h2>Study<span className="accent-text">AI</span></h2>
          </div>
          <h3>Welcome Back</h3>
          <p className="auth-subtitle">Sign in to continue your personalized learning journey</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group-custom">
            <label htmlFor="login-email">Email Address</label>
            <div className="input-with-icon">
              <span className="input-icon-symbol">📧</span>
              <input
                id="login-email"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={handleEmailChange}
                required
              />
            </div>
            {emailError && (
              <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>
                ⚠️ {emailError}
              </div>
            )}
          </div>
          
          <div className="form-group-custom">
            <label htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <span className="input-icon-symbol">🔒</span>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={handlePasswordChange}
                required
              />
            </div>
            {passwordError && (
              <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>
                ⚠️ {passwordError}
              </div>
            )}
          </div>
          
          <button type="submit" className="auth-submit-btn" disabled={isLoading || !isFormValid}>
            {isLoading ? (
              <span className="spinner-loader-small"></span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Don't have an account? <Link to="/signup" className="auth-link">Sign Up</Link></p>
        </div>
      </div>
    </div>
  );
}
