/**
 * index.js — All API calls with Vault path comments
 *
 * Auth      → POST /api/auth/login
 * Manager   → /api/manager/*   (Vault: app/secrets/*)
 * Employee  → /api/employee/*  (Vault: app/secrets/* via grant)
 */
import api from './axios';

// ── AUTH ─────────────────────────────────────────────────────
/** POST /api/auth/login → { token, user } */
export const login = (email, password) =>
  api.post('/api/auth/login', { email, password });

/** GET /api/auth/me → current user profile */
export const getMe = () => api.get('/api/auth/me');

// ── MANAGER: EMPLOYEES ───────────────────────────────────────
/** GET /api/manager/employees */
export const getEmployees = () => api.get('/api/manager/employees');

/** POST /api/manager/employees — { full_name, email, department, password } */
export const addEmployee = (data) => api.post('/api/manager/employees', data);

/** DELETE /api/manager/employees/:id */
export const deleteEmployee = (id) => api.delete(`/api/manager/employees/${id}`);

// ── MANAGER: SECRETS ─────────────────────────────────────────
// Values are encrypted in Vault at path: app/secrets/<name>

/** GET /api/manager/secrets — metadata only, no values */
export const getSecrets = () => api.get('/api/manager/secrets');

/** POST /api/manager/secrets — { name, description, value, ttl_hours } */
export const createSecret = (data) => api.post('/api/manager/secrets', data);

/** DELETE /api/manager/secrets/:id — removes from Vault + DB */
export const deleteSecret = (id) => api.delete(`/api/manager/secrets/${id}`);

// ── MANAGER: REQUESTS ────────────────────────────────────────
/** GET /api/manager/requests?status=pending|approved|rejected|expired */
export const getRequests = (status = '') =>
  api.get(`/api/manager/requests${status ? `?status=${status}` : ''}`);

/** PUT /api/manager/requests/:id/approve — { deadline_hours } */
export const approveRequest = (id, deadlineHours = 24) =>
  api.put(`/api/manager/requests/${id}/approve`, { deadline_hours: deadlineHours });

/** PUT /api/manager/requests/:id/reject */
export const rejectRequest = (id) =>
  api.put(`/api/manager/requests/${id}/reject`);

/** GET /api/manager/vault-data — stats + active grants overview */
export const getVaultData = () => api.get('/api/manager/vault-data');

// ── EMPLOYEE ─────────────────────────────────────────────────
/** GET /api/employee/secrets — secrets available to request */
export const getAvailableSecrets = () => api.get('/api/employee/secrets');

/** POST /api/employee/request — { secret_id, reason } */
export const requestSecretAccess = (secretId, reason) =>
  api.post('/api/employee/request', { secret_id: secretId, reason });

/** GET /api/employee/requests — my submitted requests */
export const getMyRequests = () => api.get('/api/employee/requests');

/** GET /api/employee/grants — my approved grants */
export const getMyGrants = () => api.get('/api/employee/grants');

/**
 * GET /api/employee/grants/:id/value
 * Reads secret value from Vault only if grant is active & not expired.
 * Returns { value, deadline, remaining_hours }
 */
export const getGrantValue = (grantId) =>
  api.get(`/api/employee/grants/${grantId}/value`);
