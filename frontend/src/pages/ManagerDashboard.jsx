/**
 * ManagerDashboard.jsx
 * Four panels: Upload Secrets · Manage Employees · Approve Requests · Grafana Panel
 * All wired to live Flask backend via /api/manager/* routes.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getVaultData,
  getEmployees,
  getSecrets,
  getRequests,
  addEmployee     as apiAddEmployee,
  deleteEmployee  as apiDeleteEmployee,
  createSecret    as apiCreateSecret,
  deleteSecret    as apiDeleteSecret,
  approveRequest  as apiApproveRequest,
  rejectRequest   as apiRejectRequest,
} from '../api/index';

const GRAFANA_URL = import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000/public-dashboards/75eba3382100486c82476e47b777984e';

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard');

  const [stats,     setStats]     = useState({});
  const [employees, setEmployees] = useState([]);
  const [secrets,   setSecrets]   = useState([]);
  const [requests,  setRequests]  = useState([]);
  const [reqFilter, setReqFilter] = useState('');

  const [toast,   setToast]   = useState(null);
  const [loading, setLoading] = useState(false);

  // Employee form
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [empForm, setEmpForm] = useState({ full_name: '', email: '', department: '', password: '' });

  // Secret form
  const [showSecForm, setShowSecForm] = useState(false);
  const [secForm, setSecForm] = useState({ name: '', description: '', value: '', ttl_hours: 24 });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const doLogout = () => { logout(); navigate('/'); };

  // ── Data loaders ────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    try {
      const { data } = await getVaultData();
      setStats(data.stats);
    } catch { showToast('Could not load dashboard stats', 'error'); }
  }, []);

  const loadEmployees = useCallback(async () => {
    try { const { data } = await getEmployees(); setEmployees(data.employees); }
    catch { showToast('Could not load employees', 'error'); }
  }, []);

  const loadSecrets = useCallback(async () => {
    try { const { data } = await getSecrets(); setSecrets(data.secrets); }
    catch { showToast('Could not load secrets', 'error'); }
  }, []);

  const loadRequests = useCallback(async () => {
    try { const { data } = await getRequests(reqFilter); setRequests(data.requests); }
    catch { showToast('Could not load requests', 'error'); }
  }, [reqFilter]);

  useEffect(() => {
    if (view === 'dashboard') loadDashboard();
    if (view === 'employees') loadEmployees();
    if (view === 'secrets')   loadSecrets();
    if (view === 'requests')  loadRequests();
  }, [view, reqFilter]);

  // ── Employee actions ─────────────────────────────────────────
  const handleAddEmployee = async () => {
    if (!empForm.full_name || !empForm.email) { showToast('Name and email are required', 'error'); return; }
    setLoading(true);
    try {
      await apiAddEmployee({ ...empForm, password: empForm.password || 'defaultPass123' });
      showToast('Employee added successfully');
      setEmpForm({ full_name: '', email: '', department: '', password: '' });
      setShowEmpForm(false);
      loadEmployees();
    } catch (e) { showToast(e.response?.data?.error || 'Failed to add employee', 'error'); }
    setLoading(false);
  };

  const handleDeleteEmployee = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    try { await apiDeleteEmployee(id); showToast(`${name} removed`); loadEmployees(); }
    catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  // ── Secret actions ───────────────────────────────────────────
  const handleAddSecret = async () => {
    if (!secForm.name || !secForm.value) { showToast('Name and value are required', 'error'); return; }
    setLoading(true);
    try {
      await apiCreateSecret({ ...secForm, ttl_hours: Number(secForm.ttl_hours) });
      showToast(`"${secForm.name}" stored in Vault`);
      setSecForm({ name: '', description: '', value: '', ttl_hours: 24 });
      setShowSecForm(false);
      loadSecrets();
    } catch (e) { showToast(e.response?.data?.error || 'Failed to store secret', 'error'); }
    setLoading(false);
  };

  const handleDeleteSecret = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This revokes all active grants.`)) return;
    try { await apiDeleteSecret(id); showToast(`"${name}" deleted from Vault`); loadSecrets(); }
    catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  // ── Request actions ──────────────────────────────────────────
  const handleApprove = async (id) => {
    const hours = window.prompt('Grant access for how many hours?', '24');
    if (hours === null) return;
    try {
      await apiApproveRequest(id, Number(hours) || 24);
      showToast(`Approved — access granted for ${hours}h`);
      loadRequests();
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this request?')) return;
    try { await apiRejectRequest(id); showToast('Request rejected'); loadRequests(); }
    catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const fmt = (s) => !s ? '—' : new Date(s + (s.includes('Z') ? '' : 'Z'))
    .toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '⬡' },
    { key: 'employees', label: 'Employees', icon: '👥' },
    { key: 'requests',  label: 'Requests',  icon: '📋' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0c10', color: '#e2e8f0', fontFamily: "'Space Mono',monospace" }}>

      {/* ── Sidebar ── */}
      <nav style={S.sidebar}>
        <div style={S.logo}>Vault<span style={{ color: '#38bdf8' }}>Sec</span></div>
        <div style={S.sidebarSection}>Management</div>
        {navItems.map(n => (
          <div key={n.key}
            style={{ ...S.navItem, ...(view === n.key ? S.navActive : {}) }}
            onClick={() => setView(n.key)}>
            <span>{n.icon}</span><span>{n.label}</span>
          </div>
        ))}
        <div style={S.sidebarBottom}>
          <div style={S.userPill}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>manager</div>
          </div>
          <button style={S.logoutBtn} onClick={doLogout}>← Logout</button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>

        {/* DASHBOARD — Grafana iframe only */}
        {view === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
            <div style={S.viewHeader}>
              <div>
                <div style={S.viewTitle}>Dashboard</div>
                <div style={S.viewSub}>Live monitoring metrics</div>
              </div>
            </div>
            <iframe
              src={GRAFANA_URL}
              style={{ flex: 1, border: 'none', borderRadius: 10, width: '100%', minHeight: 0 }}
              title="Grafana Dashboard"
              allowFullScreen
            />
          </div>
        )}

        {/* EMPLOYEES */}
        {view === 'employees' && (
          <>
            <div style={S.viewHeader}>
              <div><div style={S.viewTitle}>Employees</div><div style={S.viewSub}>Add · view · disable</div></div>
              <button style={S.btnAction} onClick={() => setShowEmpForm(v => !v)}>+ Add Employee</button>
            </div>

            {showEmpForm && (
              <div style={{ ...S.card, marginBottom: 20 }}>
                <div style={S.cardTitle}>Add New Employee</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[['full_name','Full Name','Jane Doe','text'],['email','Email','jane@company.com','email'],['department','Department','Engineering','text'],['password','Password','Min 6 chars','password']].map(([k,l,p,t]) => (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={S.label}>{l}</label>
                      <input style={S.input} type={t} placeholder={p} value={empForm[k]} onChange={e => setEmpForm(f => ({ ...f, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button style={S.btnSubmit} onClick={handleAddEmployee} disabled={loading}>Add Employee</button>
                  <button style={S.btnCancel} onClick={() => setShowEmpForm(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={S.cardTitle}>All Users ({employees.length})</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead><tr>{['Name','Email','Department','Role','Joined','Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {employees.length === 0
                      ? <tr><td colSpan={6} style={S.empty}>No users yet</td></tr>
                      : employees.map(e => (
                        <tr key={e.id}>
                          <td style={S.td}><strong>{e.full_name}</strong></td>
                          <td style={{ ...S.td, color: '#64748b' }}>{e.email}</td>
                          <td style={S.td}>{e.department || '—'}</td>
                          <td style={S.td}><span style={roleBadge(e.role)}>{e.role}</span></td>
                          <td style={{ ...S.td, color: '#64748b' }}>{fmt(e.created_at)}</td>
                          <td style={S.td}>
                            {e.role !== 'manager'
                              ? <button style={S.btnDanger} onClick={() => handleDeleteEmployee(e.id, e.full_name)}>✕ Remove</button>
                              : <span style={{ fontSize: 11, color: '#64748b' }}>protected</span>}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* REQUESTS */}
        {view === 'requests' && (
          <>
            <div style={S.viewHeader}>
              <div><div style={S.viewTitle}>Access Requests</div><div style={S.viewSub}>Grant + set TTL</div></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={{ ...S.input, width: 'auto', padding: '8px 12px' }} value={reqFilter} onChange={e => setReqFilter(e.target.value)}>
                  <option value="">All Statuses</option>
                  {['pending','approved','rejected','expired'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button style={S.btnAction} onClick={loadRequests}>↻ Refresh</button>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead><tr>{['Employee','Secret','Reason','Status','Submitted','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {requests.length === 0
                      ? <tr><td colSpan={6} style={S.empty}>No requests found</td></tr>
                      : requests.map(r => (
                        <tr key={r.id}>
                          <td style={S.td}>
                            <strong>{r.employee_name}</strong><br />
                            <span style={{ fontSize: 11, color: '#64748b' }}>{r.employee_email}</span>
                          </td>
                          <td style={S.td}>{r.secret_name}</td>
                          <td style={{ ...S.td, color: '#64748b', fontSize: 12 }}>{r.reason || '—'}</td>
                          <td style={S.td}><span style={statusBadge(r.status)}>{r.status}</span></td>
                          <td style={{ ...S.td, color: '#64748b' }}>{fmt(r.created_at)}</td>
                          <td style={S.td}>
                            {r.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button style={S.btnApprove} onClick={() => handleApprove(r.id)}>✓ Approve</button>
                                <button style={S.btnReject}  onClick={() => handleReject(r.id)}>✕ Reject</button>
                              </div>
                            ) : <span style={{ color: '#64748b', fontSize: 11 }}>—</span>}
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, ...(toast.type === 'error' ? S.toastError : S.toastOk) }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function roleBadge(role) {
  return { display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: role === 'manager' ? 'rgba(167,139,250,0.15)' : 'rgba(56,189,248,0.15)', color: role === 'manager' ? '#a78bfa' : '#38bdf8' };
}

function statusBadge(status) {
  const map = { pending: ['rgba(251,191,36,0.15)','#fbbf24'], approved: ['rgba(52,211,153,0.15)','#34d399'], rejected: ['rgba(248,113,113,0.15)','#f87171'], expired: ['rgba(100,116,139,0.15)','#64748b'] };
  const [bg, color] = map[status] || map.expired;
  return { display: 'inline-block', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: bg, color };
}

const S = {
  sidebar:       { width: 220, minHeight: '100vh', background: '#0f1219', borderRight: '1px solid #1e2534', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  logo:          { fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, padding: '0 20px', marginBottom: 32, color: '#e2e8f0' },
  sidebarSection:{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', padding: '0 20px', marginBottom: 8, marginTop: 8 },
  navItem:       { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', cursor: 'pointer', color: '#64748b', fontSize: 13, borderLeft: '2px solid transparent', transition: 'all 0.15s' },
  navActive:     { color: '#38bdf8', borderLeftColor: '#38bdf8', background: 'rgba(56,189,248,0.06)' },
  sidebarBottom: { marginTop: 'auto', padding: '0 20px' },
  userPill:      { background: '#161b26', border: '1px solid #1e2534', borderRadius: 8, padding: 12, color: '#e2e8f0' },
  logoutBtn:     { width: '100%', marginTop: 8, padding: 8, background: 'transparent', border: '1px solid #1e2534', borderRadius: 8, color: '#64748b', fontFamily: "'Space Mono',monospace", fontSize: 12, cursor: 'pointer' },
  viewHeader:    { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 },
  viewTitle:     { fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 700 },
  viewSub:       { color: '#64748b', fontSize: 12, marginTop: 2 },
  statsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16, marginBottom: 28 },
  statCard:      { background: '#0f1219', border: '1px solid #1e2534', borderRadius: 10, padding: 20 },
  card:          { background: '#0f1219', border: '1px solid #1e2534', borderRadius: 10, padding: 24, marginBottom: 20 },
  cardTitle:     { fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e2e8f0' },
  grafanaBadge:  { fontSize: 10, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '2px 8px', borderRadius: 100, letterSpacing: '0.1em', textTransform: 'uppercase' },
  grafanaMetric: { background: '#161b26', border: '1px solid #1e2534', borderRadius: 8, padding: 16, textAlign: 'center' },
  table:         { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:            { textAlign: 'left', padding: '10px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', borderBottom: '1px solid #1e2534', fontWeight: 400 },
  td:            { padding: '12px 14px', borderBottom: '1px solid #1e2534', verticalAlign: 'middle', color: '#e2e8f0' },
  empty:         { padding: '40px 14px', textAlign: 'center', color: '#64748b' },
  label:         { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' },
  input:         { background: '#161b26', border: '1px solid #1e2534', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontFamily: "'Space Mono',monospace", fontSize: 13, outline: 'none', width: '100%' },
  btnAction:     { padding: '8px 16px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 8, color: '#38bdf8', fontFamily: "'Space Mono',monospace", fontSize: 12, cursor: 'pointer' },
  btnSubmit:     { padding: '10px 24px', background: '#38bdf8', color: '#000', border: 'none', borderRadius: 8, fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnCancel:     { padding: '10px 24px', background: 'transparent', color: '#64748b', border: '1px solid #1e2534', borderRadius: 8, fontFamily: "'Space Mono',monospace", fontSize: 13, cursor: 'pointer' },
  btnDanger:     { padding: '5px 10px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#f87171', fontFamily: "'Space Mono',monospace", fontSize: 11, cursor: 'pointer' },
  btnApprove:    { padding: '5px 10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 6, color: '#34d399', fontFamily: "'Space Mono',monospace", fontSize: 11, cursor: 'pointer' },
  btnReject:     { padding: '5px 10px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: '#f87171', fontFamily: "'Space Mono',monospace", fontSize: 11, cursor: 'pointer' },
  toast:         { position: 'fixed', bottom: 24, right: 24, padding: '12px 20px', borderRadius: 8, fontSize: 13, zIndex: 9999 },
  toastOk:       { background: '#0f1219', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' },
  toastError:    { background: '#0f1219', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' },
};
