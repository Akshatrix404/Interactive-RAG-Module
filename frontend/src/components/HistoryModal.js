import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const ChatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

export default function HistoryModal({ sessions, onClose, onSelectSession, onDeleteSession, activeSessionId }) {
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(false);
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Trigger open animation
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();

    const handleKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const filtered = sessions.filter(s =>
    s.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (sessionId) => {
    onSelectSession(sessionId);
    handleClose();
  };

  return (
    <div
      className={`history-backdrop ${visible ? 'visible' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className={`history-modal ${visible ? 'visible' : ''}`} ref={modalRef}>
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-modal-title">
            <ChatIcon />
            All Conversations
            <span className="history-count">{sessions.length}</span>
          </div>
          <button className="history-close-btn" onClick={handleClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Search */}
        <div className="history-search-wrap">
          <span className="history-search-icon"><SearchIcon /></span>
          <input
            ref={inputRef}
            className="history-search-input"
            placeholder="Search conversations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="history-search-clear" onClick={() => setSearch('')}>
              <CloseIcon />
            </button>
          )}
        </div>

        {/* List */}
        <div className="history-list">
          {filtered.length === 0 ? (
            <div className="history-empty">
              {search ? `No results for "${search}"` : 'No conversations yet'}
            </div>
          ) : (
            filtered.map(session => (
              <div
                key={session.id}
                className={`history-item ${activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => handleSelect(session.id)}
              >
                <div className="history-item-icon">
                  <ChatIcon />
                </div>
                <div className="history-item-info">
                  <div className="history-item-title">{session.title || 'Untitled Chat'}</div>
                  <div className="history-item-meta">
                    {session.message_count} messages ·{' '}
                    {session.created_at
                      ? formatDistanceToNow(new Date(session.created_at), { addSuffix: true })
                      : ''}
                  </div>
                </div>
                <button
                  className="history-item-delete"
                  title="Delete"
                  onClick={e => {
                    e.stopPropagation();
                    onDeleteSession(e, session.id);
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}