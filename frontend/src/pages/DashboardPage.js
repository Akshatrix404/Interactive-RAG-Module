import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import ChatMessage, { TypingIndicator } from '../components/ChatMessage';
import AIStatusBar from '../components/AIStatusBar';
import HistoryModal from '../components/HistoryModal';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

/* ── Icons ─────────────────────────────────────────────────── */
const SendIcon       = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>);
const AttachIcon     = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.9-9.9a4 4 0 115.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>);
const PlusIcon       = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const TrashIcon      = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>);
const LogoutIcon     = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const BotIcon        = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/></svg>);
const HistoryIcon    = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
const MenuIcon       = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>);
const ChatBubbleIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);

/* ── Constants ─────────────────────────────────────────────── */
const RECENT_LIMIT = 5;
const SUGGESTIONS = [
  'Explain Python decorators with examples',
  'How does async/await work in Python?',
  'What are Python list comprehensions?',
  'Explain OOP concepts in Python',
  'What is PEP 8 and why does it matter?',
  'How do generators work in Python?',
  'Explain Python closures',
  'What are Python dataclasses?',
];

/* ── Icon-rail button ──────────────────────────────────────── */
function RailBtn({ icon, label, onClick, active, badge }) {
  return (
    <button
      className={`rail-btn${active ? ' rail-btn-active' : ''}`}
      onClick={onClick}
      title={label}
    >
      {icon}
      {badge > 0 && <span className="rail-badge">{badge}</span>}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [sessions, setSessions]             = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages]             = useState([]);
  const [input, setInput]                   = useState('');
  const [isTyping, setIsTyping]             = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [provider, setProvider]             = useState('auto');
  const [uploading, setUploading]           = useState(false);
  const [showHistory, setShowHistory]       = useState(false);

  // true → full 280 px panel | false → slim 60 px icon rail (desktop) / hidden (mobile)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const fileInputRef   = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || 'U';
  const isMobile    = () => window.innerWidth < 768;

  /* Responsive ───────────────────────────────────────────── */
  useEffect(() => {
    const onResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Scroll ───────────────────────────────────────────────── */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);

  /* Data ─────────────────────────────────────────────────── */
  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try { const res = await api.get('/chat/sessions'); setSessions(res.data); } catch {}
  };

  const loadSession = async (sessionId) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setLoadingMessages(true);
    if (isMobile()) setSidebarOpen(false);
    try {
      const res = await api.get(`/chat/sessions/${sessionId}/messages`);
      setMessages(res.data);
    } catch { toast.error('Could not load messages'); }
    finally { setLoadingMessages(false); }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    if (isMobile()) setSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const deleteSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) { setActiveSessionId(null); setMessages([]); }
      toast.success('Chat deleted');
    } catch { toast.error('Could not delete chat'); }
  };

  const sendMessage = async (queryText) => {
    const query = (queryText || input).trim();
    if (!query || isTyping) return;
    const tempMsg = { id: `temp-${Date.now()}`, role: 'user', content: query, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    setInput('');
    setIsTyping(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      const res = await api.post('/chat/send', { query, session_id: activeSessionId, provider });
      if (!activeSessionId) { setActiveSessionId(res.data.session_id); await fetchSessions(); }
      setMessages(prev => [...prev, res.data.message]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to get response');
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } finally { setIsTyping(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  const uploadSOPFiles = async (files) => {
    if (!files?.length) return;
    const fd = new FormData();
    for (let f of files) fd.append('files', f);
    try {
      setUploading(true);
      await api.post('/admin/upload-sops', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('SOP uploaded and added to RAG');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const recentSessions  = sessions.slice(0, RECENT_LIMIT);
  const hasMoreSessions = sessions.length > RECENT_LIMIT;
  const currentTitle    = activeSessionId
    ? sessions.find(s => s.id === activeSessionId)?.title || 'Chat'
    : 'New Conversation';

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="dashboard">

      {/* Mobile overlay — only when expanded on mobile */}
      {sidebarOpen && isMobile() && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════════════════════════════════════════════════════
          SIDEBAR
          desktop closed → slim icon rail (60 px)
          desktop open   → full panel (280 px)
          mobile  closed → off-screen (translateX -100%)
          mobile  open   → full panel overlay
      ════════════════════════════════════════════════════ */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

        {/* ── Icon Rail ── always visible on desktop ───────── */}
        <div className="sidebar-rail">
          {/* Hamburger / toggle */}
          <RailBtn
            icon={<MenuIcon />}
            label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            onClick={() => setSidebarOpen(p => !p)}
          />

          {/* New Chat */}
          <RailBtn icon={<PlusIcon />}   label="New Chat"            onClick={startNewChat} />

          {/* History */}
          <RailBtn
            icon={<HistoryIcon />}
            label="All Conversations"
            onClick={() => setShowHistory(true)}
            badge={sessions.length > RECENT_LIMIT ? sessions.length : 0}
          />

          {/* Push bottom items down */}
          <div className="rail-spacer" />

          {/* Logout */}
          <RailBtn
            icon={<LogoutIcon />}
            label="Sign out"
            onClick={() => { logout(); toast.success('Signed out'); }}
          />

          {/* User avatar */}
          <button className="rail-avatar" title={user?.full_name}>
            {userInitial}
          </button>
        </div>

        {/* ── Expanded panel (slides in beside rail) ───────── */}
        <div className="sidebar-panel">
          {/* Logo header */}
          <div className="sidebar-header">
            <button
              className="rail-btn"
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar"
              style={{ flexShrink: 0 }}
            >
              <MenuIcon />
            </button>
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon"><ChatBubbleIcon /></div>
              <span className="sidebar-logo-text">HelpDesk AI</span>
            </div>
          </div>

          {/* New Chat */}
          <div className="sidebar-actions">
            <button className="btn-new-chat" onClick={startNewChat}>
              <PlusIcon /> New Chat
            </button>
          </div>

          {/* Recent sessions */}
          <div className="sidebar-sessions">
            {sessions.length === 0 ? (
              <div className="empty-sessions">No chats yet.<br />Start a new conversation!</div>
            ) : (
              <>
                <div className="sessions-label">Recent Chats</div>
                {recentSessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                    onClick={() => loadSession(session.id)}
                  >
                    <div className="session-info">
                      <div className="session-title">{session.title}</div>
                      <div className="session-meta">
                        {session.message_count} msgs ·{' '}
                        {session.created_at
                          ? formatDistanceToNow(new Date(session.created_at), { addSuffix: true })
                          : ''}
                      </div>
                    </div>
                    <button
                      className="session-delete"
                      onClick={(e) => deleteSession(e, session.id)}
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}

                {hasMoreSessions && (
                  <button className="btn-view-history" onClick={() => setShowHistory(true)}>
                    <HistoryIcon />
                    View Full History
                    <span className="history-badge">{sessions.length}</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* User footer */}
          <div className="sidebar-user">
            <div className="user-avatar">{userInitial}</div>
            <div className="user-info">
              <div className="user-name">{user?.full_name}</div>
              <div className="user-email">{user?.email}</div>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => { logout(); toast.success('Signed out'); }}
              title="Sign out"
              style={{ padding: '6px' }}
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════
          CHAT AREA — fills remaining width automatically
      ════════════════════════════════════════════════════ */}
      <main className="chat-area">
        <div className="chat-header">
          <div className="chat-header-title">{currentTitle}</div>
          <AIStatusBar selectedProvider={provider} onProviderChange={setProvider} />
        </div>

        <div className="messages-container">
          {loadingMessages ? (
            <div className="loading-screen" style={{ height: 'auto', flex: 1, gap: 10 }}>
              <div className="loading-spinner" />
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading conversation…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon"><BotIcon /></div>
              <h2 className="welcome-title">
                Hello, {user?.full_name?.split(' ')[0] || 'there'} 👋
              </h2>
              <p className="welcome-subtitle">
                I'm your AI assistant, trained on{' '}
                <strong>Python official docs, Think Python, Automate the Boring Stuff, PEPs</strong>{' '}
                and more — powered by Ollama (local) or Gemini Flash.
              </p>
              <div className="welcome-chips">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="welcome-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} userInitial={userInitial} />
              ))}
              {isTyping && <TypingIndicator />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            {user?.is_admin && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  style={{ display: 'none' }}
                  onChange={(e) => uploadSOPFiles(e.target.files)}
                />
                <button
                  className="attach-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  title="Upload SOP"
                >
                  <AttachIcon />
                </button>
              </>
            )}
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask anything about Python — decorators, async, OOP, PEPs, standard library…"
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isTyping}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              title="Send"
            >
              <SendIcon />
            </button>
          </div>
          <div className="input-hint">
            Enter to send · Shift+Enter for new line · Answers grounded in Python reference docs
          </div>
        </div>
      </main>

      {/* History Modal */}
      {showHistory && (
        <HistoryModal
          sessions={sessions}
          activeSessionId={activeSessionId}
          onClose={() => setShowHistory(false)}
          onSelectSession={loadSession}
          onDeleteSession={deleteSession}
        />
      )}
    </div>
  );
}