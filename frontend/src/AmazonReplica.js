/**
 * AmazonReplica.js
 *
 * Single-file frontend — contains everything needed to run the app:
 *   • AuthContext  (auth state, login, register, logout, axios instance)
 *   • App          (BrowserRouter + route definitions)
 *   • AmazonPage   (AWS-style landing page — public home route)
 *     ├── AuthModal        (sign-in / create-account modal)
 *     ├── AdminPanel       (RAG SOP upload, stats)
 *     ├── AccountDropdown  (user menu)
 *     └── HelpDeskWidget   (removed — Iris handles all chat)
 *
 * Usage — replace src/index.js import with:
 *   import App from './AmazonReplica';
 *
 * Or keep your existing index.js and just swap the App import.
 *
 * External deps already in package.json:
 *   react, react-dom, react-router-dom, axios, react-hot-toast
 *
 * IrisWidget is imported separately (IrisWidget.js) and rendered at the
 * bottom of AmazonPage for the ecommerce-specific chat flow.
 */

import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import IrisWidget from './IrisWidget';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';


/* ═══════════════════════════════════════════════════════════════════════════
   AUTH CONTEXT
════════════════════════════════════════════════════════════════════════════ */
const AuthCtx = createContext(null);

export const api = axios.create({ baseURL: API_BASE });
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('helpdesk_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('helpdesk_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get('/me');
      setUser(res.data);
    } catch {
      localStorage.removeItem('helpdesk_token');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('helpdesk_token', res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, username, full_name, password) => {
    const res = await api.post('/auth/register', { email, username, full_name, password });
    localStorage.setItem('helpdesk_token', res.data.access_token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('helpdesk_token');
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, api }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};


/* ═══════════════════════════════════════════════════════════════════════════
   ICON HELPERS
════════════════════════════════════════════════════════════════════════════ */

const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const GlobeIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const ChevDown   = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const UserIcon   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const XIcon      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const UploadIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>;
const ArrowRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const ShieldIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;


const MODAL_ANIM = `@keyframes modalIn { from{opacity:0;transform:scale(0.95) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }`;


/* ═══════════════════════════════════════════════════════════════════════════
   AUTH MODAL
════════════════════════════════════════════════════════════════════════════ */
function AuthModal({ mode, onClose, onSwitch }) {
  const { login, register } = useAuth();
  const [form,    setForm]    = useState({ email: '', password: '', username: '', full_name: '' });
  const [loading, setLoading] = useState(false);

  const inp = (field) => ({
    value:    form[field],
    onChange: (e) => setForm({ ...form, [field]: e.target.value }),
    onFocus:  (e) => { e.target.style.borderColor = '#FF9900'; },
    onBlur:   (e) => { e.target.style.borderColor = '#d0d0d0'; },
    style: { width: '100%', padding: '10px 12px', border: '1.5px solid #d0d0d0', borderRadius: 6, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        toast.success('Welcome back!');
      } else {
        if (!form.full_name || !form.username) { toast.error('Please fill all fields'); return; }
        await register(form.email, form.username, form.full_name, form.password);
        toast.success('Account created!');
      }
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Authentication failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative', animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><XIcon /></button>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#232F3E', letterSpacing: -1, marginBottom: 4 }}><span style={{ color: '#FF9900' }}>aws</span></div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '8px 0 4px' }}>{mode === 'login' ? 'Sign in' : 'Create your AWS account'}</h2>
          <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{mode === 'login' ? 'Continue to HelpDesk AI' : 'Start with AWS for free'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 5 }}>Full Name</label>
                <input {...inp('full_name')} placeholder="John Smith" required />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 5 }}>Username</label>
                <input {...inp('username')} placeholder="johnsmith" required />
              </div>
            </>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 5 }}>Email address</label>
            <input {...inp('email')} type="email" placeholder="you@example.com" required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 5 }}>Password</label>
            <input {...inp('password')} type="password" placeholder="At least 6 characters" required minLength={6} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '11px', background: loading ? '#ccc' : '#FF9900', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', color: '#111' }}>
            {loading ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#666' }}>
          {mode === 'login'
            ? <> New to AWS? <button onClick={() => onSwitch('register')} style={{ background: 'none', border: 'none', color: '#FF9900', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Create an account</button></>
            : <> Already have an account? <button onClick={() => onSwitch('login')} style={{ background: 'none', border: 'none', color: '#FF9900', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Sign in</button></>}
        </div>
      </div>
      <style>{MODAL_ANIM}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN PANEL
════════════════════════════════════════════════════════════════════════════ */
function AdminPanel({ onClose }) {
  const [files,         setFiles]         = useState([]);
  const [uploading,     setUploading]     = useState(false);
  const [uploaded,      setUploaded]      = useState([]);
  const [ragStats,      setRagStats]      = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const fileRef = useRef();

  useEffect(() => {
    api.get('/admin/rag-stats').then(r => setRagStats(r.data)).catch(() => {});
    api.get('/admin/uploaded-files').then(r => setExistingFiles(r.data.files || [])).catch(() => {});
  }, []);

  const extColor = (ext) => ({
    '.json': '#f59e0b', '.pdf': '#ef4444', '.csv': '#10b981',
    '.xlsx': '#22c55e', '.xls': '#22c55e', '.docx': '#3b82f6',
    '.md':   '#8b5cf6', '.txt': '#6b7280', '.jpg':  '#ec4899',
    '.jpeg': '#ec4899', '.png': '#ec4899', '.svg':  '#06b6d4',
  }[ext] || '#888');

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      const res = await api.post('/admin/upload-sops', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploaded(res.data.files || []);
      setFiles([]);
      toast.success(`${res.data.files.length} file(s) injected into RAG!`);
      const [stats, existing] = await Promise.all([api.get('/admin/rag-stats'), api.get('/admin/uploaded-files')]);
      setRagStats(stats.data);
      setExistingFiles(existing.data.files || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, width: 680, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e)', padding: '20px 28px', borderRadius: '14px 14px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldIcon /><span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>Admin Panel</span>
              <span style={{ background: '#FF9900', color: '#111', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>ADMIN</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '4px 0 0' }}>Upload knowledge base files — injected directly into Ollama RAG pipeline</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><XIcon /></button>
        </div>

        <div style={{ padding: 28 }}>
          {/* Stats */}
          {ragStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total chunks', value: ragStats.chunks || 0 },
                { label: 'Collection',   value: ragStats.collection || '—' },
                { label: 'Status',       value: ragStats.ready ? '✅ Ready' : '⏳ Loading' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div onDrop={(e) => { e.preventDefault(); setFiles(p => [...p, ...Array.from(e.dataTransfer.files)]); }}
               onDragOver={(e) => e.preventDefault()}
               onClick={() => fileRef.current?.click()}
               style={{ border: '2px dashed #d0d0d0', borderRadius: 10, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', marginBottom: 16 }}
               onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FF9900'; e.currentTarget.style.background = '#fffbf0'; }}
               onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d0d0d0'; e.currentTarget.style.background = '#fafafa'; }}>
            <div style={{ marginBottom: 8, color: '#888' }}><UploadIcon /></div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#333' }}>Drop files here or click to browse</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#999' }}>PDF, DOCX, JSON, CSV, XLSX, TXT, MD, JPG, PNG, SVG</p>
            <input ref={fileRef} type="file" multiple
              accept=".json,.pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.svg"
              style={{ display: 'none' }}
              onChange={(e) => setFiles(p => [...p, ...Array.from(e.target.files)])} />
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>SELECTED ({files.length})</p>
              {files.map((f, i) => {
                const ext = '.' + f.name.split('.').pop();
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, marginBottom: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: extColor(ext) + '18', color: extColor(ext), fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>{ext}</span>
                      <span style={{ fontSize: 13, color: '#333' }}>{f.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#888' }}>{(f.size / 1024).toFixed(1)}kb</span>
                      <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 0, fontSize: 16 }}>×</button>
                    </div>
                  </div>
                );
              })}
              <button onClick={handleUpload} disabled={uploading}
                style={{ width: '100%', padding: '12px', background: uploading ? '#ccc' : '#FF9900', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', color: '#111', marginTop: 8 }}>
                {uploading ? '⏳ Injecting into RAG pipeline…' : `🚀 Upload & Inject ${files.length} file(s)`}
              </button>
            </div>
          )}

          {/* Results */}
          {uploaded.length > 0 && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#166534', margin: '0 0 8px' }}>✅ Successfully injected into RAG</p>
              {uploaded.map((f, i) => <div key={i} style={{ fontSize: 12, color: '#166534', padding: '3px 0' }}>• {f.filename} — {f.chunks} chunks ({f.size_kb}kb)</div>)}
            </div>
          )}

          {/* Existing files */}
          {existingFiles.length > 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8 }}>KNOWLEDGE BASE ({existingFiles.length} files)</p>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {existingFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: i % 2 === 0 ? '#f8fafc' : '#fff', fontSize: 13 }}>
                    <span style={{ background: extColor(f.ext) + '18', color: extColor(f.ext), fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace' }}>{f.ext}</span>
                    <span style={{ flex: 1, color: '#333' }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>{f.size_kb}kb</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => { onClose(); window.location.href = '/dashboard'; }}
            style={{ width: '100%', marginTop: 20, padding: '11px', background: '#1a1a2e', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff' }}>
            → Open Full HelpDesk AI Dashboard
          </button>
        </div>
      </div>
      <style>{MODAL_ANIM}</style>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   ACCOUNT DROPDOWN
════════════════════════════════════════════════════════════════════════════ */
function AccountDropdown({ user, onLogin, onRegister, onLogout, onAdmin }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
        <UserIcon /> {user ? user.full_name?.split(' ')[0] : 'My account'} <ChevDown />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: '#fff', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', minWidth: 220, zIndex: 1000, border: '1px solid #e8e8e8', overflow: 'hidden' }}>
          {user ? (
            <>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{user.full_name}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{user.email}</div>
                {user.is_admin && <span style={{ background: '#FF9900', color: '#111', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>ADMIN</span>}
              </div>
              {user.is_admin && (
                <button onClick={() => { setOpen(false); onAdmin(); }}
                  style={{ width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#FF9900', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f0f0f0' }}>
                  <ShieldIcon /> Admin Features
                </button>
              )}
              <button onClick={() => { setOpen(false); window.location.href = '/dashboard'; }}
                style={{ width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#333', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f0f0f0' }}>
                💬 HelpDesk AI Dashboard
              </button>
              <button onClick={() => { setOpen(false); onLogout(); }}
                style={{ width: '100%', textAlign: 'left', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setOpen(false); onLogin(); }}
                style={{ width: '100%', padding: '13px 16px', background: '#FF9900', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#111', textAlign: 'center' }}>
                Sign in
              </button>
              <div style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#555' }}>
                New customer?{' '}
                <button onClick={() => { setOpen(false); onRegister(); }}
                  style={{ background: 'none', border: 'none', color: '#FF9900', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Start here.
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   AMAZON PAGE  (main public landing page)
════════════════════════════════════════════════════════════════════════════ */
function AmazonPage() {
  const { user, logout } = useAuth();
  const [authModal,  setAuthModal]  = useState(null);
  const [showAdmin,  setShowAdmin]  = useState(false);
  const [activeTab,  setActiveTab]  = useState('North America');

  const regions  = ['North America','South America','Europe','Middle East','Africa','Asia Pacific','Australia and New Zealand'];
  const navLinks = ['AWS Summits','Discover AWS','Products','Solutions','Pricing','Resources'];
  const services = [
    { name: 'Amazon EC2',        desc: 'Virtual Servers in the Cloud',    cat: 'Compute',    badge: 'Popular'    },
    { name: 'Amazon S3',         desc: 'Scalable Storage in the Cloud',   cat: 'Storage',    badge: 'Popular'    },
    { name: 'Amazon RDS',        desc: 'Managed Relational Database',     cat: 'Database',   badge: null         },
    { name: 'AWS Lambda',        desc: 'Run Code without Servers',        cat: 'Compute',    badge: 'Serverless' },
    { name: 'Amazon CloudFront', desc: 'Global Content Delivery Network', cat: 'Networking', badge: null         },
    { name: 'Amazon DynamoDB',   desc: 'Managed NoSQL Database',          cat: 'Database',   badge: 'New'        },
  ];

  const regionCities = {
    'North America': ['AWS GovCloud (US-East)','US East (N. Virginia)','US East (Ohio)','US West (N. California)','US West (Oregon)','Canada (Central)','Canada West (Calgary)'],
    'Europe':        ['EU (Frankfurt)','EU (Ireland)','EU (London)','EU (Milan)','EU (Paris)','EU (Spain)','EU (Stockholm)','EU (Zurich)'],
    'Asia Pacific':  ['Asia Pacific (Mumbai)','Asia Pacific (Singapore)','Asia Pacific (Sydney)','Asia Pacific (Tokyo)','Asia Pacific (Seoul)','Asia Pacific (Hong Kong)'],
  };

  return (
    <div style={{ fontFamily: "'Amazon Ember','Helvetica Neue',Arial,sans-serif", margin: 0, padding: 0, background: '#fff', color: '#111' }}>

      {/* Top Bar */}
      <div style={{ background: '#1a1a2e', color: '#fff', fontSize: 13, padding: '6px 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 20 }}>
        <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}><GlobeIcon /> English <ChevDown /></button>
        <a href="#" style={{ color: '#fff', textDecoration: 'none', fontSize: 13 }}>Contact us</a>
        <a href="#" style={{ color: '#fff', textDecoration: 'none', fontSize: 13 }}>AWS Marketplace</a>
        <button style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13 }}>Support <ChevDown /></button>
        <AccountDropdown user={user} onLogin={() => setAuthModal('login')} onRegister={() => setAuthModal('register')}
          onLogout={() => { logout(); toast.success('Signed out'); }} onAdmin={() => setShowAdmin(true)} />
      </div>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: '#232F3E', letterSpacing: -0.5, marginRight: 32 }}><span style={{ color: '#FF9900' }}>aws</span></div>
        {navLinks.map(link => (
          <a key={link} href="#" style={{ color: '#111', textDecoration: 'none', fontSize: 13.5, fontWeight: 500, padding: '0 14px', height: 60, display: 'flex', alignItems: 'center', borderBottom: '3px solid transparent', transition: 'color 0.15s,border-color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FF9900'; e.currentTarget.style.borderBottomColor = '#FF9900'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#111'; e.currentTarget.style.borderBottomColor = 'transparent'; }}>
            {link}
          </a>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f4f4f4', border: '1px solid #e0e0e0', borderRadius: 6, padding: '6px 12px', marginRight: 16 }}>
          <SearchIcon /><input placeholder="Search" style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: 160 }} />
        </div>
        <a href="#" style={{ color: '#111', textDecoration: 'none', fontSize: 13.5, fontWeight: 500, marginRight: 20 }}>Sign in to console</a>
        <button onClick={() => !user && setAuthModal('register')}
          style={{ background: '#FF9900', border: 'none', borderRadius: 4, padding: '8px 18px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', color: '#111' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e68900'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#FF9900'; }}>
          {user ? `Hi, ${user.full_name?.split(' ')[0]}` : 'Create account'}
        </button>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%)', minHeight: 480, display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', padding: '60px 80px' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', overflow: 'hidden', opacity: 0.6 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ position: 'absolute', right: -20 + i * 30, top: 20 + i * 40, width: 2, height: 180 + i * 20, background: `linear-gradient(to bottom, ${['#FF6B9D','#6C63FF','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#FF9FF3','#48dbfb'][i]}, transparent)`, borderRadius: 2, transform: `rotate(${-5 + i * 2}deg)`, opacity: 0.7 }} />
          ))}
        </div>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 600 }}>
          <h1 style={{ color: '#fff', fontSize: 44, fontWeight: 800, lineHeight: 1.15, margin: '0 0 20px', letterSpacing: -1 }}>
            Adopt industry-first cloud<br/>innovations
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, lineHeight: 1.65, margin: '0 0 32px' }}>
            We think years ahead to innovate on your behalf, delivering the first cloud-native compute, serverless, storage, and relational databases
          </p>
          <button onClick={() => !user && setAuthModal('register')}
            style={{ background: '#fff', border: 'none', borderRadius: 4, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: '#1a1a2e', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}>
            {user ? `Welcome, ${user.full_name?.split(' ')[0]}! ✓` : 'Start free with AWS'}
          </button>
        </div>
      </section>

      {/* Free Tier */}
      <section style={{ padding: '60px 80px', background: '#fff' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px', textAlign: 'center' }}>
          I want to <span style={{ color: '#6c63ff', textDecoration: 'underline', textDecorationStyle: 'wavy' }}>try AWS for free ▾</span>
        </h2>
        <p style={{ textAlign: 'center', color: '#666', margin: '0 0 44px', fontSize: 15 }}>No commitment required — explore 100+ services at no charge</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 1000, margin: '0 auto' }}>
          {[
            { title: 'Gain free, hands-on experience',     body: 'Sign up for AWS and get $100 in AWS Free Tier credits right away, plus up to $100 more as you explore. Test AWS services for up to 6 months at no cost.' },
            { title: 'Track your AWS Free Tier usage',     body: 'Explore AWS services at no cost within specified usage limits. Learn to track your AWS Free Tier usage, manage credits, and set up cost alerts.' },
          ].map((card, i) => (
            <div key={i} style={{ background: '#f9f9fb', border: '1px solid #ebebf0', borderRadius: 12, padding: '28px 32px 24px', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px' }}>{card.title}</h3>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, margin: '0 0 20px' }}>{card.body}</p>
              <span style={{ color: '#6c63ff', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><ArrowRight /></span>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section style={{ padding: '48px 80px', background: '#f7f8fc', borderTop: '1px solid #ebebf0' }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', margin: '0 0 32px' }}>Featured Services</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {services.map((svc, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #ebebf0', borderRadius: 10, padding: '22px 24px', cursor: 'pointer', position: 'relative' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(108,99,255,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              {svc.badge && <span style={{ position: 'absolute', top: 14, right: 14, background: svc.badge === 'Popular' ? '#fff3cd' : svc.badge === 'New' ? '#d1fae5' : '#f0f0ff', color: svc.badge === 'Popular' ? '#856404' : svc.badge === 'New' ? '#065f46' : '#4f46e5', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{svc.badge}</span>}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{svc.cat}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px' }}>{svc.name}</h3>
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5, margin: 0 }}>{svc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Global Infrastructure */}
      <section style={{ padding: '60px 80px', background: '#fff' }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a2e', margin: '0 0 16px' }}>AWS Global Infrastructure</h2>
        <p style={{ fontSize: 15, color: '#444', lineHeight: 1.7, maxWidth: 680, margin: '0 0 36px' }}>
          The AWS Cloud spans 123 Availability Zones within 39 Geographic Regions, with announced plans for more AZs and AWS Regions globally.
        </p>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 32, padding: 4, background: '#f4f4f8', borderRadius: 40, width: 'fit-content' }}>
          {regions.map(r => (
            <button key={r} onClick={() => setActiveTab(r)}
              style={{ padding: '8px 18px', borderRadius: 32, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: activeTab === r ? 'linear-gradient(135deg,#FF9900,#e68900)' : 'none', color: activeTab === r ? '#fff' : '#555', fontFamily: 'inherit' }}>
              {r}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
          <div style={{ background: '#f9f9fb', border: '1px solid #ebebf0', borderRadius: 12, padding: '24px 28px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>AWS Coverage Regions</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 20px' }}>{activeTab}</h3>
            {(regionCities[activeTab] || ['Select a region to see details']).map(r => (
              <div key={r} style={{ padding: '6px 0', fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6c63ff', flexShrink: 0 }} />{r}
              </div>
            ))}
          </div>
          <div style={{ background: 'linear-gradient(135deg,#f0f4ff,#e8eeff)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 280, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(ellipse at 35% 35%,#7986cb 0%,#5c6bc0 40%,#3949ab 70%,#283593 100%)', boxShadow: 'inset -20px -10px 40px rgba(0,0,0,0.2),0 8px 32px rgba(57,73,171,0.3)' }} />
          </div>
        </div>
      </section>

      {/* Feedback banner */}
      <section style={{ padding: '40px 80px', background: 'linear-gradient(135deg,#FFF8E1,#FFF3CD)', borderTop: '1px solid #ffe082', borderBottom: '1px solid #ffe082' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#5d4037' }}>Did you find what you were looking for today?</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#795548' }}>Help us improve your experience on aws.amazon.com</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {['Yes', 'No', 'Somewhat'].map(opt => (
              <button key={opt} style={{ padding: '9px 22px', borderRadius: 4, border: '1.5px solid #FF9900', background: opt === 'Yes' ? '#FF9900' : '#fff', color: opt === 'Yes' ? '#fff' : '#FF9900', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF9900'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { if (opt !== 'Yes') { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#FF9900'; } }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#1a1a2e', padding: '40px 80px 24px', color: 'rgba(255,255,255,0.7)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 32, marginBottom: 32 }}>
          {[
            { title: 'Products',  links: ['Compute','Storage','Databases','Networking','Machine Learning','Analytics'] },
            { title: 'Solutions', links: ['Enterprise','Startups','Public Sector','Healthcare','Financial Services','Media'] },
            { title: 'Resources', links: ['Documentation','Training','AWS re:Post','AWS Blogs','Case Studies','Architecture'] },
            { title: 'Company',   links: ['About AWS','Careers','Press','Events','Contact Us','Marketplace'] },
          ].map((col, i) => (
            <div key={i}>
              <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.title}</h4>
              {col.links.map(link => (
                <a key={link} href="#" style={{ display: 'block', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 13, marginBottom: 8 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#FF9900'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#FF9900' }}>aws</div>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            © {new Date().getFullYear()}, Amazon Web Services, Inc. or its affiliates. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 16 }}>
            {['Privacy', 'Terms', 'Cookie preferences', 'Site map'].map(l => (
              <a key={l} href="#" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF9900'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}>
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>

      {/* Modals */}
      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} onSwitch={setAuthModal} />}
      {showAdmin  && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* Iris ecommerce widget */}
      <IrisWidget user={user} />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   APP + ROUTES  (replaces App.js, LoginPage.js, RegisterPage.js)
════════════════════════════════════════════════════════════════════════════ */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: 16, color: '#666' }}>Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public home — AmazonPage handles auth modals inline */}
          <Route path="/"        element={<AmazonPage />} />
          <Route path="/amazon"  element={<AmazonPage />} />

          {/* Protected dashboard — imported separately if needed */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              {/* Lazy import your DashboardPage here if kept as a separate file */}
              <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
                <h1>Dashboard</h1>
                <p>Import and render your DashboardPage component here.</p>
              </div>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff', color: '#1e293b',
              border: '1px solid #e2e8f0', borderRadius: '10px',
              fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}