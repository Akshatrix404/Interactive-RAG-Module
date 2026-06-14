/**
 * HelpDeskWidget.js
 *
 * AWS-style floating chat widget (bottom-right, dark square button).
 * Sends messages to /api/chat/send via the shared `api` axios instance.
 *
 * Props:
 *   user            — current user object (or null if logged out)
 *   onAuthRequired  — callback to open the auth modal when user is null
 *
 * Usage in AmazonReplica.js (already wired up):
 *   import HelpDeskWidget from './HelpDeskWidget';
 *   <HelpDeskWidget user={user} onAuthRequired={() => setAuthModal('login')} />
 */

import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from './AmazonReplica';   // shared axios instance (AuthContext export)

/* ── Icon helpers (self-contained, no external icon lib needed) ─────────── */
const ChatIcon  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const MinIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const SendIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const ImageIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const Sparkle   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="#6c63ff" stroke="none"><path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>;

/* ── Quick-start options shown on the home screen ───────────────────────── */
const QUICK_OPTIONS = [
  'I want to learn about AWS products and services',
  'I need technical support',
  'I have an account and billing issue',
  'I want to return an order',
  'Where is my order?',
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════════════════════ */
export default function HelpDeskWidget({ user, onAuthRequired }) {
  const [open,      setOpen]      = useState(false);
  const [phase,     setPhase]     = useState('home');   // 'home' | 'chat'
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [typing,    setTyping]    = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const endRef = useRef(null);
  const imgRef = useRef(null);

  /* Auto-scroll to latest message */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── Send a message ────────────────────────────────────────────────────── */
  const sendMessage = async (text, imgFile) => {
    const q = (text || input).trim();
    if (!q && !imgFile) return;

    // Require auth before sending
    if (!user) { onAuthRequired(); return; }

    setInput('');
    setImageFile(null);
    setPhase('chat');

    const userMsg = {
      role:    'user',
      content: q || '📷 [Image attached]',
      image:   imgFile ? URL.createObjectURL(imgFile) : null,
    };
    setMessages(prev => [...prev, userMsg]);
    setTyping(true);

    try {
      let queryText = q;
      if (imgFile) {
        queryText = q
          ? `${q} [Image attached: ${imgFile.name}]`
          : `[Image: ${imgFile.name}] Please analyse and help.`;
      }

      const res = await api.post('/chat/send', {
        query:      queryText,
        session_id: sessionId,
        provider:   'auto',
      });

      if (!sessionId) setSessionId(res.data.session_id);
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: res.data.message?.content || 'Sorry, I could not process that.',
      }]);
    } catch (err) {
      if (err?.response?.status === 401) { onAuthRequired(); return; }
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: "I'm having trouble connecting. Please try again.",
      }]);
    } finally {
      setTyping(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => { if (!user) { onAuthRequired(); return; } setOpen(true); }}
        title="Ask AWS"
        style={{
          position: 'fixed', bottom: 28, right: 90, zIndex: 9999,
          width: 52, height: 52, borderRadius: 12,
          background: '#1a1a2e', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          transition: 'transform 0.18s, box-shadow 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.35)'; }}
      >
        <ChatIcon />
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 90, zIndex: 9998,
          width: 370, borderRadius: 16, background: '#fff',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'hdWidgetIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: "'DM Sans', sans-serif",
        }}>

          {/* ── Header ─────────────────────────────────────────────────── */}
          <div style={{ background: 'linear-gradient(135deg,#6c63ff 0%,#4f46e5 100%)', padding: '16px 18px 14px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 17, fontWeight: 700 }}>Ask AWS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                  <Sparkle /> built-in
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <MinIcon />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              {user
                ? `Hi ${user.full_name?.split(' ')[0] || user.username}! How can I help?`
                : 'Get helpful guidance from AWS AI assistant.'}
            </p>

            {/* Inline search bar in header */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', gap: 8, border: '1px solid rgba(255,255,255,0.25)' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Ask a question"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontFamily: 'inherit' }}
              />
              <button onClick={() => imgRef.current?.click()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center' }}>
                <ImageIcon />
              </button>
              <button onClick={() => sendMessage()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center' }}>
                <SendIcon />
              </button>
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files[0]) {
                    setImageFile(e.target.files[0]);
                    toast.success('Image ready to send!');
                  }
                }}
              />
            </div>
            {imageFile && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                📷 {imageFile.name} attached
              </div>
            )}
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340 }}>
            {phase === 'home' ? (
              /* Home screen — quick options */
              <div style={{ padding: '16px 18px' }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Want help getting started?</p>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#555' }}>Tell us a little bit about what you're looking for.</p>
                {QUICK_OPTIONS.map((opt, i) => (
                  <button key={i} onClick={() => sendMessage(opt)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8, padding: '10px 14px', background: '#f4f4ff', border: '1.5px solid #c5c7f5', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#2d2d8e', fontWeight: 500, fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#ebebff'; e.currentTarget.style.borderColor = '#7986cb'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f4f4ff'; e.currentTarget.style.borderColor = '#c5c7f5'; }}>
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              /* Chat screen — message thread */
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.image && (
                      <img src={msg.image} alt="attached" style={{ maxWidth: 160, borderRadius: 8, marginBottom: 4 }} />
                    )}
                    <div style={{
                      maxWidth: '84%', padding: '9px 13px',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: msg.role === 'user' ? 'linear-gradient(135deg,#6c63ff,#4f46e5)' : '#f4f4f8',
                      color: msg.role === 'user' ? '#fff' : '#1a1a2e',
                      fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {typing && (
                  <div style={{ display: 'flex' }}>
                    <div style={{ background: '#f4f4f8', borderRadius: '14px 14px 14px 4px', padding: '10px 14px', display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(d => (
                        <span key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: '#888', display: 'inline-block', animation: `hdDot 1.2s ${d * 0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
          </div>

          {/* ── Footer input (chat mode only) ──────────────────────────── */}
          {phase === 'chat' && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Type a message…"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={() => imgRef.current?.click()} style={{ background: '#f4f4f8', border: 'none', borderRadius: 8, padding: '8px', cursor: 'pointer', color: '#6c63ff', display: 'flex', alignItems: 'center' }}>
                <ImageIcon />
              </button>
              <button onClick={() => sendMessage(input, imageFile)} style={{ background: '#6c63ff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
                <SendIcon />
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ padding: '8px 18px 10px', textAlign: 'center', fontSize: 11, color: '#999', borderTop: '1px solid #f5f5f5' }}>
            By chatting, you agree to this <a href="#" style={{ color: '#4f46e5' }}>disclaimer</a>.
          </div>
        </div>
      )}

      <style>{`
        @keyframes hdWidgetIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes hdDot      { 0%,80%,100% { transform: translateY(0);    } 40% { transform: translateY(-6px); } }
      `}</style>
    </>
  );
}
