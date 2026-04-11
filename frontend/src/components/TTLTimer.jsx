/**
 * TTLTimer.jsx — live countdown, turns red under 5 min
 *
 * Props:
 *   deadline  {string}   — "YYYY-MM-DD HH:MM:SS" UTC from backend
 *   onExpire  {function} — called when countdown reaches 0
 */
import { useState, useEffect } from 'react';

function getSecsLeft(deadline) {
  const end = new Date(deadline.includes('Z') ? deadline : deadline + 'Z');
  return Math.max(0, Math.floor((end - Date.now()) / 1000));
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function TTLTimer({ deadline, onExpire }) {
  const [secs, setSecs] = useState(() => getSecsLeft(deadline));

  useEffect(() => {
    setSecs(getSecsLeft(deadline));
    const id = setInterval(() => {
      const remaining = getSecsLeft(deadline);
      setSecs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const isUrgent = secs < 300; // red under 5 minutes

  return (
    <span style={{
      fontFamily: 'monospace',
      fontSize: 13,
      padding: '3px 10px',
      borderRadius: 4,
      background: isUrgent ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)',
      color: isUrgent ? '#f87171' : '#34d399',
      fontWeight: 600,
      letterSpacing: '0.05em',
      transition: 'color 0.3s, background 0.3s',
    }}>
      {secs === 0 ? 'EXPIRED' : formatTime(secs)}
    </span>
  );
}
