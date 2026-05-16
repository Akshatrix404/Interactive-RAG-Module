import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';

const PROVIDER_COLORS = {
  ollama:  { bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e', label: '🦙 Ollama' },
  gemini:  { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6', label: '✨ Gemini' },
  offline: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: '⚠ Offline' },
};

export default function AIStatusBar({ onProviderChange, selectedProvider }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 30000); // refresh every 30s
    return () => clearInterval(t);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/chat/status');
      setStatus(res.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading) return null;
  if (!status)  return null;

  const ollamaOn = status?.ollama?.available;
  const geminiOn = status?.gemini?.available;
  const ragOn    = status?.rag?.ready;
  const ragCount = status?.rag?.chunks || 0;

  const activeProvider = ollamaOn ? 'ollama' : geminiOn ? 'gemini' : 'offline';
  const style = PROVIDER_COLORS[activeProvider] || PROVIDER_COLORS.offline;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0', flexWrap: 'wrap',
    }}>
      {/* Active provider badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: style.bg, color: style.color,
        padding: '3px 10px', borderRadius: 20,
        fontSize: 12, fontWeight: 600,
        border: `1px solid ${style.dot}30`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: style.dot, display: 'inline-block' }} />
        {style.label}
        {ollamaOn && status.ollama.active && (
          <span style={{ opacity: 0.7, fontWeight: 400 }}>· {status.ollama.active}</span>
        )}
      </div>

      {/* RAG badge */}
      {ragOn && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: '#fdf4ff', color: '#7c3aed',
          padding: '3px 10px', borderRadius: 20,
          fontSize: 12, fontWeight: 600,
          border: '1px solid #7c3aed30',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', display: 'inline-block' }} />
          📚 RAG · {ragCount.toLocaleString()} chunks
        </div>
      )}

      {/* Provider selector */}
      <select
        value={selectedProvider}
        onChange={e => onProviderChange(e.target.value)}
        style={{
          fontSize: 12, padding: '3px 8px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--bg-white)',
          color: 'var(--text-secondary)', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        title="Choose AI provider"
      >
        <option value="auto">Auto (best available)</option>
        {ollamaOn && <option value="ollama">🦙 Ollama only</option>}
        {geminiOn && <option value="gemini">✨ Gemini only</option>}
      </select>
    </div>
  );
}
