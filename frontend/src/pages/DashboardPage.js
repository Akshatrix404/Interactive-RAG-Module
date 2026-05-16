import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, api } from '../context/AuthContext';
import ChatMessage, { TypingIndicator } from '../components/ChatMessage';
import AIStatusBar from '../components/AIStatusBar';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const SendIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>);
const PlusIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
const TrashIcon = () => (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>);
const LogoutIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
const BotIcon = () => (<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/></svg>);

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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [provider, setProvider] = useState('auto');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || 'U';

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isTyping, scrollToBottom]);
  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try { const res = await api.get('/chat/sessions'); setSessions(res.data); } catch {}
  };

  const loadSession = async (sessionId) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setLoadingMessages(true);
    try { const res = await api.get(`/chat/sessions/${sessionId}/messages`); setMessages(res.data); }
    catch { toast.error('Could not load messages'); }
    finally { setLoadingMessages(false); }
  };

  const startNewChat = () => { setActiveSessionId(null); setMessages([]); setInput(''); textareaRef.current?.focus(); };

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
    const tempUserMsg = { id: `temp-${Date.now()}`, role: 'user', content: query, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMsg]);
    setInput('');
    setIsTyping(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    try {
      const res = await api.post('/chat/send', { query, session_id: activeSessionId, provider });
      const newSessionId = res.data.session_id;
      if (!activeSessionId) { setActiveSessionId(newSessionId); await fetchSessions(); }
      setMessages(prev => [...prev, res.data.message]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to get response');
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally { setIsTyping(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span className="sidebar-logo-text">HelpDesk AI</span>
          </div>
          <button className="btn-new-chat" onClick={startNewChat}><PlusIcon /> New Chat</button>
        </div>

        <div className="sidebar-sessions">
          {sessions.length === 0 ? (
            <div className="empty-sessions">No chats yet.<br/>Start a new conversation!</div>
          ) : (
            <>
              <div className="sessions-label">Recent Chats</div>
              {sessions.map(session => (
                <div key={session.id} className={`session-item ${activeSessionId === session.id ? 'active' : ''}`} onClick={() => loadSession(session.id)}>
                  <div className="session-info">
                    <div className="session-title">{session.title}</div>
                    <div className="session-meta">{session.message_count} msgs · {session.created_at ? formatDistanceToNow(new Date(session.created_at), { addSuffix: true }) : ''}</div>
                  </div>
                  <button className="session-delete" onClick={(e) => deleteSession(e, session.id)} title="Delete"><TrashIcon/></button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">{userInitial}</div>
          <div className="user-info">
            <div className="user-name">{user?.full_name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className="btn btn-ghost" onClick={() => { logout(); toast.success('Signed out'); }} title="Sign out" style={{padding:'6px'}}><LogoutIcon/></button>
        </div>
      </aside>

      {/* Chat Area */}
      <main className="chat-area">
        <div className="chat-header">
          <div className="chat-header-title">
            {activeSessionId ? sessions.find(s => s.id === activeSessionId)?.title || 'Chat' : 'New Conversation'}
          </div>
          <AIStatusBar selectedProvider={provider} onProviderChange={setProvider} />
        </div>

        <div className="messages-container">
          {loadingMessages ? (
            <div className="loading-screen" style={{height:'auto',flex:1,gap:10}}>
              <div className="loading-spinner"/>
              <p style={{fontSize:13,color:'var(--text-muted)'}}>Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon"><BotIcon/></div>
              <h2 className="welcome-title">Hello, {user?.full_name?.split(' ')[0] || 'there'} 👋</h2>
              <p className="welcome-subtitle">
                I'm your AI assistant, trained on <strong>Python official docs, Think Python, Automate the Boring Stuff, PEPs</strong> and more — powered by Ollama (local) or Gemini Flash.
              </p>
              <div className="welcome-chips">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} className="welcome-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => <ChatMessage key={msg.id} message={msg} userInitial={userInitial}/>)}
              {isTyping && <TypingIndicator/>}
            </>
          )}
          <div ref={messagesEndRef}/>
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
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
            <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || isTyping} title="Send"><SendIcon/></button>
          </div>
          <div className="input-hint">Enter to send · Shift+Enter for new line · Answers grounded in Python reference docs</div>
        </div>
      </main>
    </div>
  );
}
