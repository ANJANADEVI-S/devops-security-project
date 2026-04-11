/**
 * LoginPage.jsx — shared for both manager and employee roles
 * Reads ?role=manager|employee from URL query params.
 * On success: stores JWT via AuthContext, navigates to correct dashboard.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin } from '../api/index';

export default function LoginPage() {
  const [params] = useSearchParams();
  const role = params.get('role') || 'employee';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const accent = role === 'manager' ? '#38bdf8' : '#34d399';

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      const { data } = await apiLogin(email, password);
      if (data.user.role !== role) {
        setError(`This account is a ${data.user.role}, not a ${role}.`);
        return;
      }
      login(data.token, data.user);
      navigate(role === 'manager' ? '/manager' : '/employee');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.box}>
        <button style={S.back} onClick={() => navigate('/')}>← Back</button>

        <div style={S.title}>
          {role === 'manager' ? 'Manager ' : 'Employee '}
          <span style={{ color: accent }}>Login</span>
        </div>
        <div style={S.desc}>
          {role === 'manager'
            ? 'Sign in to manage secrets, employees, and requests'
            : 'Sign in to browse and request access to secrets'}
        </div>

        {error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ ...S.btn, background: accent, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <div style={S.hint}>
          Manager: <code>admin@company.com</code> / <code>admin123</code><br />
          Employee: <code>alice@company.com</code> / <code>alice123</code>
        </div>
      </div>
    </div>
  );
}

const S = {
  page:     { minHeight: '100vh', background: '#0a0c10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Mono',monospace" },
  box:      { width: '100%', maxWidth: 420, background: '#0f1219', border: '1px solid #1e2534', borderRadius: 12, padding: 40 },
  back:     { background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', marginBottom: 28, fontFamily: "'Space Mono',monospace" },
  title:    { fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 4, color: '#e2e8f0' },
  desc:     { color: '#64748b', fontSize: 12, marginBottom: 28 },
  errorBox: { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: 12, marginBottom: 16 },
  field:    { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 },
  label:    { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' },
  input:    { background: '#161b26', border: '1px solid #1e2534', borderRadius: 8, padding: '10px 14px', color: '#e2e8f0', fontFamily: "'Space Mono',monospace", fontSize: 13, outline: 'none', width: '100%' },
  btn:      { width: '100%', padding: 12, borderRadius: 8, border: 'none', color: '#000', fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
  hint:     { marginTop: 20, fontSize: 11, color: '#374151', lineHeight: 2 },
};
