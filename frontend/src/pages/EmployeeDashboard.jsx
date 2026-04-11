/**
 * EmployeeDashboard.jsx
 * Three panels: Browse Secrets (request access) · My Requests · View Approved Secrets (reveal + TTL countdown)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TTLTimer from '../components/TTLTimer';
import {
  getAvailableSecrets,
  requestSecretAccess,
  getMyRequests,
  getMyGrants,
  getGrantValue,
} from '../api/index';

export default function EmployeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard');

  const [secrets, setSecrets]   = useState([]);
  const [myReqs, setMyReqs]     = useState([]);
  const [grants, setGrants]     = useState([]);
  const [revealedMap, setRevealedMap] = useState({}); // grantId -> { value, remaining_hours }

  // Modal state for request reason
  const [modal, setModal] = useState(null); // { secretId, secretName }
  const [reason, setReason] = useState('');

  const [toast, setToast]   = useState(null);
  const [loading, setLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const doLogout = () => { logout(); navigate('/'); };

  // ── Loaders ────────────────────────────────────
  const loadSecrets = useCallback(async () => {
    try {
      const { data } = await getAvailableSecrets();
      setSecrets(data.secrets);
    } catch { showToast('Could not load secrets', 'error'); }
  }, []);

  const loadMyReqs = useCallback(async () => {
    try {
      const { data } = await getMyRequests();
      setMyReqs(data.requests);
    } catch { showToast('Could not load requests', 'error'); }
  }, []);

  const loadGrants = useCallback(async () => {
    try {
      const { data } = await getMyGrants();
      setGrants(data.grants);
    } catch { showToast('Could not load grants', 'error'); }
  }, []);

  useEffect(() => {
    if (view === 'dashboard') loadMyReqs();
    if (view === 'browse')    loadSecrets();
    if (view === 'requests')  loadMyReqs();
    if (view === 'secrets')   loadGrants();
  }, [view]);

  // ── Request access ─────────────────────────────
  const openModal = (secretId, secretName) => {
    setModal({ secretId, secretName });
    setReason('');
  };
  const closeModal = () => setModal(null);

  const submitRequest = async () => {
    if (!modal) return;
    setLoading(true);
    try {
      await requestSecretAccess(modal.secretId, reason);
      showToast('Request submitted — awaiting manager approval');
      closeModal();
      loadSecrets();
    } catch (e) {
      showToast(e.response?.data?.error || 'Request failed', 'error');
    }
    setLoading(false);
  };

  // ── Reveal secret ──────────────────────────────
  const revealSecret = async (grantId) => {
    if (revealedMap[grantId]) {
      // Toggle hide
      setRevealedMap(m => { const n = { ...m }; delete n[grantId]; return n; });
      return;
    }
    try {
      const { data } = await getGrantValue(grantId);
      setRevealedMap(m => ({ ...m, [grantId]: { value: data.value, remaining_hours: data.remaining_hours, deadline: data.deadline } }));
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not retrieve secret', 'error');
    }
  };

  const fmt = (s) => s ? new Date(s + (s.includes('Z') ? '' : 'Z')).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const navItems = [
    { key: 'dashboard', label: 'Dashboard',      icon: '⬡' },
    { key: 'browse',    label: 'Browse Secrets', icon: '🔐' },
    { key: 'requests',  label: 'My Requests',    icon: '📋' },
    { key: 'secrets',   label: 'My Secrets',     icon: '🗝' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0c10', color: '#e2e8f0', fontFamily: "'Space Mono',monospace" }}>

      {/* Sidebar */}
      <nav style={S.sidebar}>
        <div style={S.sidebarLogo}>Vault<span style={{ color: '#34d399' }}>Sec</span></div>
        <div style={S.sidebarSection}>My Access</div>
        {navItems.map(n => (
          <div key={n.key} style={{ ...S.navItem, ...(view === n.key ? S.navActive : {}) }} onClick={() => setView(n.key)}>
            <span>{n.icon}</span><span>{n.label}</span>
          </div>
        ))}
        <div style={S.sidebarBottom}>
          <div style={S.userPill}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700 }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>employee</div>
          </div>
          <button style={S.logoutBtn} onClick={doLogout}>← Logout</button>
        </div>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>

        {/* ── DASHBOARD ── */}
        {view === 'dashboard' && (
          <>
            <div style={S.viewHeader}>
              <div>
                <div style={S.viewTitle}>Dashboard</div>
                <div style={S.viewSub}>Your secret request activity at a glance</div>
              </div>
              <button style={S.btnAction} onClick={loadMyReqs}>↻ Refresh</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Requested',  val: myReqs.length,                                    color: '#38bdf8', icon: '📤' },
                { label: 'Approved',   val: myReqs.filter(r=>r.status==='approved').length,   color: '#34d399', icon: '✅' },
                { label: 'Rejected',   val: myReqs.filter(r=>r.status==='rejected').length,   color: '#f87171', icon: '❌' },
                { label: 'Expired',    val: myReqs.filter(r=>r.status==='expired').length,    color: '#64748b', icon: '⏰' },
              ].map(c => (
                <div key={c.label} style={{ ...S.statCard, borderTop: `2px solid ${c.color}` }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{c.icon}</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 36, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.val}</div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 14, color: '#e2e8f0' }}>Quick Actions</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button style={S.btnAction} onClick={() => setView('browse')}>🔐 Browse Secrets</button>
                <button style={S.btnAction} onClick={() => setView('requests')}>📋 View My Requests</button>
                <button style={S.btnAction} onClick={() => setView('secrets')}>🗝 My Active Secrets</button>
              </div>
            </div>
          </>
        )}

        {/* ── BROWSE SECRETS ── */}
        {view === 'browse' && (
          <>
            <div style={S.viewHeader}>
              <div>
                <div style={S.viewTitle}>Browse Secrets</div>
                <div style={S.viewSub}>Request access to any secret — manager approval required</div>
              </div>
              <button style={S.btnAction} onClick={loadSecrets}>↻ Refresh</button>
            </div>
            <div style={S.card}>
              <table style={S.table}>
                <thead><tr>{['Name','Description','TTL','Added','Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {secrets.length === 0
                    ? <tr><td colSpan={5} style={S.empty}>No secrets available</td></tr>
                    : secrets.map(s => (
                      <tr key={s.id}>
                        <td style={S.td}><strong>{s.name}</strong></td>
                        <td style={{ ...S.td, color: '#64748b', fontSize: 12 }}>{s.description || '—'}</td>
                        <td style={S.td}>{s.ttl_hours}h</td>
                        <td style={{ ...S.td, color: '#64748b' }}>{fmt(s.created_at)}</td>
                        <td style={S.td}>
                          <button style={S.btnRequest} onClick={() => openModal(s.id, s.name)}>
                            Request →
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── MY REQUESTS ── */}
        {view === 'requests' && (
          <>
            <div style={S.viewHeader}>
              <div>
                <div style={S.viewTitle}>My Requests</div>
                <div style={S.viewSub}>Pending · approved · rejected</div>
              </div>
              <button style={S.btnAction} onClick={loadMyReqs}>↻ Refresh</button>
            </div>

            <div style={S.card}>
              <table style={S.table}>
                <thead><tr>{['Secret','Reason','Status','Submitted','Deadline'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {myReqs.length === 0
                    ? <tr><td colSpan={5} style={S.empty}>No requests yet — browse secrets to request access</td></tr>
                    : myReqs.map(r => (
                      <tr key={r.id}>
                        <td style={S.td}><strong>{r.secret_name}</strong></td>
                        <td style={{ ...S.td, color: '#64748b', fontSize: 12 }}>{r.reason || '—'}</td>
                        <td style={S.td}><span style={badgeStyle(r.status)}>{r.status}</span></td>
                        <td style={{ ...S.td, color: '#64748b' }}>{fmt(r.created_at)}</td>
                        <td style={{ ...S.td, color: r.deadline ? '#fbbf24' : '#64748b' }}>{fmt(r.deadline)}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── MY SECRETS (GRANTS) ── */}
        {view === 'secrets' && (
          <>
            <div style={S.viewHeader}>
              <div>
                <div style={S.viewTitle}>My Secrets</div>
                <div style={S.viewSub}>Reveal · countdown timer · revoke notice</div>
              </div>
              <button style={S.btnAction} onClick={loadGrants}>↻ Refresh</button>
            </div>

            {grants.filter(g => g.status === 'active').length > 0 && (
              <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, padding: '12px 20px', marginBottom: 20, fontSize: 12, color: '#34d399' }}>
                ℹ Access is automatically revoked when the TTL countdown reaches zero. Reveal secrets only when needed.
              </div>
            )}

            <div style={S.card}>
              <table style={S.table}>
                <thead><tr>{['Secret','Granted At','Expires','Time Left','Status','Value'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {grants.length === 0
                    ? <tr><td colSpan={6} style={S.empty}>No grants yet — submit a request and wait for approval</td></tr>
                    : grants.map(g => (
                      <tr key={g.id}>
                        <td style={S.td}><strong>{g.secret_name}</strong></td>
                        <td style={{ ...S.td, color: '#64748b' }}>{fmt(g.granted_at)}</td>
                        <td style={{ ...S.td, color: '#64748b' }}>{fmt(g.deadline)}</td>
                        <td style={S.td}>
                          {g.status === 'active' && g.deadline
                            ? <TTLTimer deadline={g.deadline} onExpire={() => { showToast(`Access to "${g.secret_name}" has expired`,'error'); loadGrants(); }} />
                            : '—'}
                        </td>
                        <td style={S.td}><span style={badgeStyle(g.status)}>{g.status}</span></td>
                        <td style={S.td}>
                          {g.status === 'active' ? (
                            revealedMap[g.id] ? (
                              <div>
                                <div style={S.secretBox}>{revealedMap[g.id].value}</div>
                                <button style={{ ...S.btnRequest, marginTop: 6, fontSize: 11 }} onClick={() => revealSecret(g.id)}>Hide</button>
                              </div>
                            ) : (
                              <button style={S.btnRequest} onClick={() => revealSecret(g.id)}>👁 Reveal</button>
                            )
                          ) : (
                            <span style={{ color: '#64748b', fontSize: 11 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Request Modal ── */}
      {modal && (
        <div style={S.modalOverlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={S.modalBox}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4, color: '#e2e8f0' }}>Request Access</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>{modal.secretName}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              <label style={S.label}>Reason for access</label>
              <textarea
                rows={3}
                style={{ ...S.input, resize: 'vertical' }}
                placeholder="Why do you need this secret?"
                value={reason}
                onChange={e => setReason(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ ...S.btnSubmit, background: '#34d399' }} onClick={submitRequest} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Request'}
              </button>
              <button style={S.btnCancel} onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.type === 'error' ? S.toastError : S.toastSuccess) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function badgeStyle(status) {
  const map = {
    pending:  ['rgba(251,191,36,0.15)',  '#fbbf24'],
    approved: ['rgba(52,211,153,0.15)',  '#34d399'],
    rejected: ['rgba(248,113,113,0.15)', '#f87171'],
    expired:  ['rgba(100,116,139,0.15)', '#64748b'],
    active:   ['rgba(52,211,153,0.15)',  '#34d399'],
  };
  const [bg, color] = map[status] || map.expired;
  return { display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: bg, color };
}

const S = {
  sidebar: { width: 220, minHeight: '100vh', background: '#0f1219', borderRight: '1px solid #1e2534', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  sidebarLogo: { fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, padding: '0 20px', marginBottom: 32, color: '#e2e8f0' },
  sidebarSection: { fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', padding: '0 20px', marginBottom: 8, marginTop: 8 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', cursor: 'pointer', color: '#64748b', fontSize: 13, transition: 'all 0.15s', borderLeft: '2px solid transparent' },
  navActive: { color: '#34d399', borderLeftColor: '#34d399', background: 'rgba(52,211,153,0.06)' },
  sidebarBottom: { marginTop: 'auto', padding: '0 20px' },
  userPill: { background: '#161b26', border: '1px solid #1e2534', borderRadius: 8, padding: 12, color: '#e2e8f0' },
  logoutBtn: { width: '100%', marginTop: 8, padding: 8, background: 'transparent', border: '1px solid #1e2534', borderRadius: 8, color: '#64748b', fontFamily: "'Space Mono',monospace", fontSize: 12, cursor: 'pointer' },
  viewHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 },
  viewTitle: { fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 700 },
  viewSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  card: { background: '#0f1219', border: '1px solid #1e2534', borderRadius: 10, padding: 24, marginBottom: 20 },
  statCard: { background: '#0f1219', border: '1px solid #1e2534', borderRadius: 10, padding: 20 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', borderBottom: '1px solid #1e2534', fontWeight: 400 },
  td: { padding: '12px 14px', borderBottom: '1px solid #1e2534', verticalAlign: 'middle', color: '#e2e8f0' },
  empty: { padding: '40px 14px', textAlign: 'center', color: '#64748b' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' },
  input: { background: '#161b26', border: '1px solid #1e2534', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontFamily: "'Space Mono',monospace", fontSize: 13, outline: 'none', width: '100%' },
  btnAction: { padding: '8px 16px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, color: '#34d399', fontFamily: "'Space Mono',monospace", fontSize: 12, cursor: 'pointer' },
  btnRequest: { padding: '6px 14px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, color: '#34d399', fontFamily: "'Space Mono',monospace", fontSize: 12, cursor: 'pointer' },
  btnSubmit: { padding: '10px 24px', color: '#000', border: 'none', borderRadius: 8, fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnCancel: { padding: '10px 24px', background: 'transparent', color: '#64748b', border: '1px solid #1e2534', borderRadius: 8, fontFamily: "'Space Mono',monospace", fontSize: 13, cursor: 'pointer' },
  secretBox: { background: '#161b26', border: '1px solid #2a3347', borderRadius: 6, padding: '8px 12px', fontFamily: "'Space Mono',monospace", fontSize: 12, color: '#34d399', wordBreak: 'break-all' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalBox: { background: '#0f1219', border: '1px solid #2a3347', borderRadius: 12, padding: 32, width: '100%', maxWidth: 420 },
  toast: { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 8, fontSize: 13, zIndex: 9999 },
  toastSuccess: { background: '#0f1219', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' },
  toastError: { background: '#0f1219', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' },
};
