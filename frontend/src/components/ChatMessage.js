import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { formatDistanceToNow } from 'date-fns';

function BotIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      <line x1="12" y1="3" x2="12" y2="7"/>
      <circle cx="12" cy="15" r="1" fill="currentColor"/>
    </svg>
  );
}

function SourceIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

const components = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter
        style={oneDark}
        language={match[1]}
        PreTag="div"
        customStyle={{ borderRadius: '8px', fontSize: '13px', margin: '10px 0' }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    ) : (
      <code className={className} {...props}>{children}</code>
    );
  }
};

export function TypingIndicator({ userInitial }) {
  return (
    <div className="message assistant">
      <div className="message-avatar"><BotIcon /></div>
      <div className="message-content">
        <div className="message-bubble">
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatMessage({ message, userInitial }) {
  const isUser = message.role === 'user';
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';

  return (
    <div className={`message ${message.role}`}>
      <div className="message-avatar">
        {isUser ? userInitial : <BotIcon />}
      </div>
      <div className="message-content">
        <div className="message-bubble">
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="message-sources">
            {message.sources.map((src, i) => (
              <span key={i} className="source-tag">
                <SourceIcon /> {src}
              </span>
            ))}
          </div>
        )}
        {timeAgo && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: isUser ? 'right' : 'left' }}>
            {timeAgo}
          </div>
        )}
      </div>
    </div>
  );
}
