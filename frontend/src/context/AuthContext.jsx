/**
 * AuthContext.jsx — global token + role storage
 *
 * Provides: { user, token, login, logout, isManager, isEmployee }
 * Persists to localStorage so page refresh keeps you logged in.
 */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('vault_token') || null);
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vault_user')) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (token) localStorage.setItem('vault_token', token);
    else localStorage.removeItem('vault_token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('vault_user', JSON.stringify(user));
    else localStorage.removeItem('vault_user');
  }, [user]);

  const login = (tokenValue, userData) => {
    setToken(tokenValue);
    setUser(userData);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const isManager  = user?.role === 'manager';
  const isEmployee = user?.role === 'employee';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isManager, isEmployee }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
