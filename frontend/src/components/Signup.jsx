import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Signup({ onLogin, showToast }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [fullNameError, setFullNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

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

  const handleFullNameChange = (e) => {
    const val = e.target.value;
    setFullName(val);
    setFullNameError(!val.trim() ? 'Full name is required' : '');
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
    if (confirmPassword) {
      setConfirmPasswordError(val !== confirmPassword ? 'Passwords do not match' : '');
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const val = e.target.value;
    setConfirmPassword(val);
    setConfirmPasswordError(val !== password ? 'Passwords do not match' : '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    const fErr = !trimmedName ? 'Full name is required' : '';
    const eErr = validateEmail(trimmedEmail);
    const pErr = validatePassword(password);
    const cErr = password !== confirmPassword ? 'Passwords do not match' : '';

    if (fErr || eErr || pErr || cErr) {
      setFullNameError(fErr);
      setEmailError(eErr);
      setPasswordError(pErr);
      setConfirmPasswordError(cErr);
      showToast('Please fix validation errors before registering.', 'warning');
      return;
    }
    
    setIsLoading(true);
    // Simulate API call delay
    setTimeout(() => {
      setIsLoading(false);
      localStorage.setItem('studyai_auth', 'true');
      localStorage.setItem('studyai_user', trimmedEmail);
      localStorage.setItem('studyai_name', trimmedName);
      onLogin(trimmedEmail);
      showToast('Account created successfully! Welcome to StudyAI.', 'success');
      navigate('/dashboard');
    }, 800);
  };

  const isFullNameValid = fullName.trim() !== '';
  const isEmailValid = email.trim() !== '' && !validateEmail(email);
  const isPasswordValid = password.trim() !== '' && !validatePassword(password);
  const isConfirmPasswordValid = confirmPassword.trim() !== '' && confirmPassword === password;
  const isFormValid = isFullNameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid;

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
          <h3>Get Started</h3>
          <p className="auth-subtitle">Create a free account to unlock intelligent study tools</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group-custom">
            <label htmlFor="signup-name">Full Name</label>
            <div className="input-with-icon">
              <span className="input-icon-symbol">👤</span>
              <input
                id="signup-name"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={handleFullNameChange}
                required
              />
            </div>
            {fullNameError && (
              <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>
                ⚠️ {fullNameError}
              </div>
            )}
          </div>
          
          <div className="form-group-custom">
            <label htmlFor="signup-email">Email Address</label>
            <div className="input-with-icon">
              <span className="input-icon-symbol">📧</span>
              <input
                id="signup-email"
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
            <label htmlFor="signup-password">Password</label>
            <div className="input-with-icon">
              <span className="input-icon-symbol">🔒</span>
              <input
                id="signup-password"
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
          
          <div className="form-group-custom">
            <label htmlFor="signup-confirm-password">Confirm Password</label>
            <div className="input-with-icon">
              <span className="input-icon-symbol">✔️</span>
              <input
                id="signup-confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                required
              />
            </div>
            {confirmPasswordError && (
              <div style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.25rem', paddingLeft: '0.5rem' }}>
                ⚠️ {confirmPasswordError}
              </div>
            )}
          </div>
          
          <button type="submit" className="auth-submit-btn" disabled={isLoading || !isFormValid}>
            {isLoading ? (
              <span className="spinner-loader-small"></span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Already have an account? <Link to="/login" className="auth-link">Log In</Link></p>
        </div>
      </div>
    </div>
  );
}
