import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.username || !form.full_name || !form.password) {
      toast.error('Please fill in all fields'); return;
    }
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match'); return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters'); return;
    }
    setLoading(true);
    try {
      await register(form.email, form.username, form.full_name, form.password);
      toast.success('Account created! Welcome aboard 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span className="auth-logo-text">HelpDesk AI</span>
        </div>

        <h1 className="auth-title">Create account</h1>
        <p className="auth-subtitle">Get started with your personal AI help desk</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" type="text" name="full_name" placeholder="John Doe"
              value={form.full_name} onChange={handleChange} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" type="text" name="username" placeholder="johndoe"
              value={form.username} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input className="form-input" type="email" name="email" placeholder="you@example.com"
              value={form.email} onChange={handleChange} autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" name="password" placeholder="Min. 6 characters"
              value={form.password} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input className="form-input" type="password" name="confirm_password" placeholder="Repeat password"
              value={form.confirm_password} onChange={handleChange} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
