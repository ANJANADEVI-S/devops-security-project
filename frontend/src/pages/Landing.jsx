/**
 * Landing.jsx — role selector, routes to /login?role=manager or /login?role=employee
 */
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Already logged in → go straight to their dashboard
  useEffect(() => {
    if (user?.role === 'manager')  navigate('/manager');
    if (user?.role === 'employee') navigate('/employee');
  }, [user]);

  return (
    <div style={S.page}>
      <div style={S.grid} />
      <div style={S.glow} />
      <div style={S.content}>
        <div style={S.badge}>● Secrets Management Platform</div>
        <div style={S.logo}>
          Vault<span style={{ color: '#38bdf8' }}>Sec</span>
        </div>
        <div style={S.sub}>Secure · Audited · Time-bound</div>
        <div style={S.btnRow}>
          <button style={{ ...S.card, borderColor: '#534AB7' }} onClick={() => navigate('/login?role=manager')}>
            <span style={S.cardRole}>Login as</span>
            <span style={{ ...S.cardLabel, color: '#38bdf8' }}>Manager</span>
            <span style={S.cardHint}>JWT · role: manager</span>
          </button>
          <button style={{ ...S.card, borderColor: '#1D9E75' }} onClick={() => navigate('/login?role=employee')}>
            <span style={S.cardRole}>Login as</span>
            <span style={{ ...S.cardLabel, color: '#34d399' }}>Employee</span>
            <span style={S.cardHint}>JWT · role: employee</span>
          </button>
        </div>
        <div style={S.footer}>HashiCorp Vault · Flask API · Prometheus + Grafana</div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0a0c10', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  grid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#1e2534 1px,transparent 1px),linear-gradient(90deg,#1e2534 1px,transparent 1px)', backgroundSize: '60px 60px', opacity: 0.4 },
  glow: { position: 'absolute', width: 600, height: 600, background: 'radial-gradient(circle,rgba(56,189,248,0.12) 0%,transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  content: { position: 'relative', zIndex: 1, textAlign: 'center', color: '#e2e8f0', fontFamily: "'Space Mono',monospace" },
  badge: { display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 100, padding: '4px 14px', fontSize: 11, color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 },
  logo: { fontFamily: "'Syne',sans-serif", fontSize: 'clamp(48px,8vw,90px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8, color: '#e2e8f0' },
  sub: { fontSize: 13, color: '#64748b', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 40 },
  btnRow: { display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' },
  card: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: '20px 32px', borderRadius: 8, cursor: 'pointer', border: '1px solid', background: '#0f1219', color: '#e2e8f0', fontFamily: "'Space Mono',monospace", textAlign: 'left', minWidth: 200 },
  cardRole: { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' },
  cardLabel: { fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700 },
  cardHint: { fontSize: 11, color: '#64748b' },
  footer: { marginTop: 40, fontSize: 11, color: '#374151', letterSpacing: '0.1em' },
};
